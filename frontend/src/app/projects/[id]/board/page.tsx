"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TaskDrawer } from "@/components/TaskDrawer";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { Task, Member, TaskStatus, TaskPriority, KanbanBoardResponse } from "@/lib/types";
import {
  ArrowLeft,
  Plus,
  AlertCircle,
  Calendar,
  MessageSquare,
  Search,
  Filter,
} from "lucide-react";

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default function KanbanBoardPage({ params }: BoardPageProps) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);
  const { currentOrg } = useAuth();

  const [projectName, setProjectName] = useState("");
  const [columns, setColumns] = useState<Record<TaskStatus, Task[]>>({
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: [],
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  // Drawer & Modal state
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus>("TODO");

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!currentOrg) return;
    setIsLoading(true);
    setError("");

    try {
      const [boardData, memberList] = await Promise.all([
        apiClient<KanbanBoardResponse>(`/organizations/${currentOrg.id}/projects/${projectId}/kanban`),
        apiClient<Member[]>(`/organizations/${currentOrg.id}/members`),
      ]);

      setProjectName(boardData.projectName);
      setColumns({
        TODO: boardData.columns.TODO || [],
        IN_PROGRESS: boardData.columns.IN_PROGRESS || [],
        IN_REVIEW: boardData.columns.IN_REVIEW || [],
        DONE: boardData.columns.DONE || [],
      });
      setMembers(memberList || []);
    } catch (err: any) {
      setError(err.message || "Failed to load kanban board");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, projectId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData("text/plain", String(taskId));
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnColumn = async (targetStatus: TaskStatus) => {
    if (!draggedTaskId || !currentOrg) return;

    // Snapshot current state for rollback
    const previousColumns = { ...columns };

    // Find dragged task
    let movingTask: Task | null = null;
    let sourceStatus: TaskStatus | null = null;

    for (const [status, list] of Object.entries(columns) as [TaskStatus, Task[]][]) {
      const found = list.find((t) => t.id === draggedTaskId);
      if (found) {
        movingTask = found;
        sourceStatus = status;
        break;
      }
    }

    if (!movingTask || !sourceStatus) return;

    // Calculate new position: if column is empty, 65536.0; else last pos + 65536.0
    const targetList = columns[targetStatus].filter((t) => t.id !== draggedTaskId);
    let newPosition = 65536.0;
    if (targetList.length > 0) {
      newPosition = targetList[targetList.length - 1].position + 65536.0;
    }

    // Optimistic UI update
    const updatedTask = {
      ...movingTask,
      status: targetStatus,
      position: newPosition,
      version: movingTask.version + 1, // optimistic version increment
    };

    const newCols = {
      ...columns,
      [sourceStatus]: columns[sourceStatus].filter((t) => t.id !== draggedTaskId),
      [targetStatus]: [...targetList, updatedTask],
    };
    setColumns(newCols);
    setDraggedTaskId(null);

    // Call API to persist
    try {
      const saved = await apiClient<Task>(
        `/organizations/${currentOrg.id}/tasks/${movingTask.id}/move`,
        {
          method: "PATCH",
          body: JSON.stringify({
            targetStatus,
            targetPosition: newPosition,
            version: movingTask.version, // send original version for optimistic locking check
          }),
        }
      );

      // Re-synchronize with server response
      setColumns((current) => {
        const next = { ...current };
        next[targetStatus] = next[targetStatus].map((t) => (t.id === saved.id ? saved : t));
        return next;
      });
    } catch (err: any) {
      // Rollback on failure
      setColumns(previousColumns);
      setError(
        err.status === 409
          ? "Conflict detected: The task was moved by another user. Reloaded latest board state."
          : err.message || "Failed to move task. Reverted changes."
      );
      // Refresh board from server to sync version
      fetchBoard();
    }
  };

  const handleTaskCreated = (newTask: Task) => {
    setColumns((prev) => ({
      ...prev,
      [newTask.status]: [...prev[newTask.status], newTask],
    }));
  };

  const handleTaskUpdated = (updated: Task) => {
    setColumns((prev) => {
      const next = { ...prev };
      for (const status of Object.keys(next) as TaskStatus[]) {
        next[status] = next[status]
          .filter((t) => t.id !== updated.id)
          .concat(updated.status === status ? [updated] : [])
          .sort((a, b) => a.position - b.position);
      }
      return next;
    });
  };

  const handleTaskDeleted = (deletedId: number) => {
    setColumns((prev) => {
      const next = { ...prev };
      for (const status of Object.keys(next) as TaskStatus[]) {
        next[status] = next[status].filter((t) => t.id !== deletedId);
      }
      return next;
    });
  };

  const columnConfig: { status: TaskStatus; title: string; color: string }[] = [
    { status: "TODO", title: "To Do", color: "border-slate-300" },
    { status: "IN_PROGRESS", title: "In Progress", color: "border-indigo-400" },
    { status: "IN_REVIEW", title: "In Review", color: "border-amber-400" },
    { status: "DONE", title: "Done", color: "border-emerald-400" },
  ];

  const priorityBadge: Record<TaskPriority, string> = {
    LOW: "bg-slate-100 text-slate-600",
    MEDIUM: "bg-blue-50 text-blue-700",
    HIGH: "bg-amber-50 text-amber-700",
    URGENT: "bg-red-100 text-red-700 font-bold",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/projects"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {projectName || "Kanban Board"}
              </h1>
              <p className="text-xs text-slate-400">Drag and drop cards across columns to update workflow status.</p>
            </div>
          </div>

          {/* Search & Assignee Filters */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
              />
            </div>

            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Assignees</option>
                {members.map((m) => (
                  <option key={m.userId} value={String(m.userId)}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}

        {/* Kanban Board Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 bg-slate-200/60 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start min-h-[70vh]">
            {columnConfig.map(({ status, title, color }) => {
              const taskList = columns[status] || [];
              const filteredTasks = taskList.filter((task) => {
                const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesAssignee =
                  filterAssignee === "all" || String(task.assigneeId) === filterAssignee;
                return matchesSearch && matchesAssignee;
              });

              return (
                <div
                  key={status}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnColumn(status)}
                  className={`bg-slate-100/70 border-t-4 ${color} rounded-xl p-3 flex flex-col min-h-[60vh] max-h-[80vh] shadow-xs`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1 py-1 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-800">{title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold">
                        {filteredTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setModalInitialStatus(status);
                        setCreateModalOpen(true);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200"
                      title="Add task in this column"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Column Task Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {filteredTasks.length === 0 ? (
                      <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-xs text-slate-400 italic">
                        Drop tasks here
                      </div>
                    ) : (
                      filteredTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setActiveTaskId(task.id)}
                          className="bg-white rounded-lg p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing space-y-2"
                        >
                          {/* Labels & Overdue badge */}
                          <div className="flex flex-wrap gap-1 items-center">
                            {task.isOverdue && (
                              <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>Overdue</span>
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                priorityBadge[task.priority]
                              }`}
                            >
                              {task.priority}
                            </span>
                            {task.labels?.map((label) => (
                              <span
                                key={label.name}
                                style={{ backgroundColor: `${label.color}15`, color: label.color }}
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>

                          {/* Task Title */}
                          <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                            {task.title}
                          </h4>

                          {/* Task Footer */}
                          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                            <div className="flex items-center space-x-2">
                              {task.dueDate && (
                                <span className="flex items-center space-x-1 text-[11px]">
                                  <Calendar className="w-3 h-3" />
                                  <span>{task.dueDate}</span>
                                </span>
                              )}
                              {task.commentCount > 0 && (
                                <span className="flex items-center space-x-0.5 text-[11px]">
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{task.commentCount}</span>
                                </span>
                              )}
                            </div>

                            {task.assigneeName ? (
                              <div
                                title={`Assigned to ${task.assigneeName}`}
                                className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center uppercase"
                              >
                                {task.assigneeName.charAt(0)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Task Detail Drawer */}
        {activeTaskId && currentOrg && (
          <TaskDrawer
            taskId={activeTaskId}
            organizationId={currentOrg.id}
            members={members}
            onClose={() => setActiveTaskId(null)}
            onTaskUpdated={handleTaskUpdated}
            onTaskDeleted={handleTaskDeleted}
          />
        )}

        {/* Create Task Modal */}
        {createModalOpen && currentOrg && (
          <CreateTaskModal
            projectId={projectId}
            organizationId={currentOrg.id}
            members={members}
            initialStatus={modalInitialStatus}
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onTaskCreated={handleTaskCreated}
          />
        )}
      </div>
    </AppShell>
  );
}
