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
  CheckSquare,
  User as UserIcon,
  X,
  ChevronsUp,
  ChevronUp,
  Equal,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default function KanbanBoardPage({ params }: BoardPageProps) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);
  const { currentOrg, user } = useAuth();

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

  // Jira-style quick filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Drawer & Modal state
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus>("TODO");

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

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

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDropOnColumn = async (targetStatus: TaskStatus) => {
    setDragOverColumn(null);
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

    // Calculate new position
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
      version: movingTask.version + 1,
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
            version: movingTask.version,
          }),
        }
      );

      setColumns((current) => {
        const next = { ...current };
        next[targetStatus] = next[targetStatus].map((t) => (t.id === saved.id ? saved : t));
        return next;
      });
    } catch (err: any) {
      setColumns(previousColumns);
      setError(
        err.status === 409
          ? "Conflict detected: The task was moved by another user. Reloaded latest board state."
          : err.message || "Failed to move task. Reverted changes."
      );
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

  const columnConfig: { status: TaskStatus; title: string; headerColor: string; pillColor: string }[] = [
    {
      status: "TODO",
      title: "TO DO",
      headerColor: "border-slate-400 dark:border-slate-600",
      pillColor: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    },
    {
      status: "IN_PROGRESS",
      title: "IN PROGRESS",
      headerColor: "border-blue-500 dark:border-blue-400",
      pillColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    },
    {
      status: "IN_REVIEW",
      title: "IN REVIEW",
      headerColor: "border-purple-500 dark:border-purple-400",
      pillColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
    },
    {
      status: "DONE",
      title: "DONE",
      headerColor: "border-emerald-500 dark:border-emerald-400",
      pillColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    },
  ];

  // Jira-style Priority icon helper
  const renderPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case "URGENT":
        return (
          <span title="Urgent Priority" className="inline-flex items-center">
            <ChevronsUp className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          </span>
        );
      case "HIGH":
        return (
          <span title="High Priority" className="inline-flex items-center">
            <ChevronUp className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 flex-shrink-0" />
          </span>
        );
      case "MEDIUM":
        return (
          <span title="Medium Priority" className="inline-flex items-center">
            <Equal className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          </span>
        );
      case "LOW":
        return (
          <span title="Low Priority" className="inline-flex items-center">
            <ChevronDown className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          </span>
        );
    }
  };

  // Filter tasks helper
  const filterTask = (task: Task) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAssignee =
      filterAssignee === "all" || String(task.assigneeId) === filterAssignee;

    const matchesPriority =
      filterPriority === "all" || task.priority === filterPriority;

    const matchesMyTasks = !onlyMyTasks || (user && task.assigneeId === user.id);

    return matchesSearch && matchesAssignee && matchesPriority && matchesMyTasks;
  };

  const totalTasks = Object.values(columns).reduce((acc, list) => acc + list.length, 0);
  const totalFiltered = Object.values(columns).reduce(
    (acc, list) => acc + list.filter(filterTask).length,
    0
  );
  const hasActiveFilters = searchQuery !== "" || filterAssignee !== "all" || filterPriority !== "all" || onlyMyTasks;

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilterAssignee("all");
    setFilterPriority("all");
    setOnlyMyTasks(false);
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Navigation & Jira-style Board Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <Link
              href="/projects"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Back to projects"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {projectName || "Kanban Board"}
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {totalTasks} issues
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jira-style agile board • Drag cards to transition workflow status
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <button
            onClick={() => {
              setModalInitialStatus("TODO");
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Issue</span>
          </button>
        </div>

        {/* Jira-style Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-44 sm:w-56"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Filter: Only My Tasks */}
            <button
              onClick={() => setOnlyMyTasks(!onlyMyTasks)}
              className={clsx(
                "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center space-x-1.5",
                onlyMyTasks
                  ? "bg-brand-50 dark:bg-brand-950/70 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              )}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Only my issues</span>
            </button>

            {/* Assignee Filter Dropdown */}
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Assignees</option>
              {members.map((m) => (
                <option key={m.userId} value={String(m.userId)}>
                  {m.fullName}
                </option>
              ))}
            </select>

            {/* Priority Filter Dropdown */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Priorities</option>
              <option value="URGENT">Urgent (⇈)</option>
              <option value="HIGH">High (↑)</option>
              <option value="MEDIUM">Medium (=)</option>
              <option value="LOW">Low (↓)</option>
            </select>

            {/* Clear All Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium px-2 py-1"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing <strong className="text-slate-800 dark:text-slate-200">{totalFiltered}</strong> of {totalTasks} issues
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}

        {/* Kanban Board Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start min-h-[72vh]">
            {columnConfig.map(({ status, title, headerColor, pillColor }) => {
              const taskList = columns[status] || [];
              const filteredTasks = taskList.filter(filterTask);
              const isOver = dragOverColumn === status;

              return (
                <div
                  key={status}
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDropOnColumn(status)}
                  className={clsx(
                    "rounded-xl p-3 flex flex-col min-h-[64vh] max-h-[82vh] transition-all duration-200 shadow-xs border",
                    isOver
                      ? "bg-brand-50/70 dark:bg-brand-950/40 border-brand-400 dark:border-brand-500 ring-2 ring-brand-500/20"
                      : "bg-slate-100/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80"
                  )}
                >
                  {/* Column Header */}
                  <div className={clsx("flex items-center justify-between px-1 py-1.5 mb-3 border-t-4 rounded-t", headerColor)}>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs tracking-wider text-slate-800 dark:text-slate-200">{title}</span>
                      <span className={clsx("text-xs px-2 py-0.5 rounded-full font-bold", pillColor)}>
                        {filteredTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setModalInitialStatus(status);
                        setCreateModalOpen(true);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      title="Add task in this column"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Column Task Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {filteredTasks.length === 0 ? (
                      <div className="border border-dashed border-slate-300 dark:border-slate-800 rounded-lg p-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                        {isOver ? "Release to drop" : "No issues in this column"}
                      </div>
                    ) : (
                      filteredTasks.map((task) => {
                        const isBeingDragged = draggedTaskId === task.id;

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => setActiveTaskId(task.id)}
                            className={clsx(
                              "bg-white dark:bg-slate-800/90 rounded-lg p-3.5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150 cursor-grab active:cursor-grabbing space-y-2.5 group",
                              isBeingDragged && "opacity-40 scale-95 border-brand-500 ring-2 ring-brand-500/20"
                            )}
                          >
                            {/* Jira-style Issue Header: Key & Priority */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                <CheckSquare className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                                <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                  TASK-{task.id}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                {task.isOverdue && (
                                  <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>Overdue</span>
                                  </span>
                                )}
                                <div className="p-1 rounded bg-slate-100 dark:bg-slate-700/50">
                                  {renderPriorityIcon(task.priority)}
                                </div>
                              </div>
                            </div>

                            {/* Task Title */}
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                              {task.title}
                            </h4>

                            {/* Labels */}
                            {task.labels && task.labels.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center pt-0.5">
                                {task.labels.map((label) => (
                                  <span
                                    key={label.name}
                                    style={{
                                      backgroundColor: `${label.color}15`,
                                      color: label.color,
                                      borderColor: `${label.color}30`,
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                                  >
                                    {label.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Task Footer: Due Date, Comments, Assignee */}
                            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                              <div className="flex items-center space-x-2.5">
                                {task.dueDate && (
                                  <span
                                    className={clsx(
                                      "flex items-center space-x-1 text-[11px] font-medium",
                                      task.isOverdue
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-slate-500 dark:text-slate-400"
                                    )}
                                  >
                                    <Calendar className="w-3 h-3" />
                                    <span>{task.dueDate}</span>
                                  </span>
                                )}
                                {task.commentCount > 0 && (
                                  <span className="flex items-center space-x-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{task.commentCount}</span>
                                  </span>
                                )}
                              </div>

                              {task.assigneeName ? (
                                <div
                                  title={`Assigned to ${task.assigneeName}`}
                                  className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-[10px] font-bold flex items-center justify-center uppercase shadow-xs border border-brand-200 dark:border-brand-800"
                                >
                                  {task.assigneeName.charAt(0)}
                                </div>
                              ) : (
                                <div
                                  title="Unassigned"
                                  className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[10px] flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600"
                                >
                                  ?
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
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
