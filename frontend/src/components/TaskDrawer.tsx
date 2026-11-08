"use client";

import React, { useState, useEffect } from "react";
import { Task, Member, Comment, TaskStatus, TaskPriority, Label } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { ErrorAlert } from "./ErrorAlert";
import {
  X,
  Calendar,
  User as UserIcon,
  Tag,
  MessageSquare,
  AlertCircle,
  Send,
  Trash2,
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
} from "lucide-react";

interface TaskDrawerProps {
  taskId: number | null;
  organizationId: number;
  members: Member[];
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (deletedTaskId: number) => void;
}

export function TaskDrawer({
  taskId,
  organizationId,
  members,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDrawerProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [newTagText, setNewTagText] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Fetch full task details & comments
  useEffect(() => {
    if (!taskId) return;
    setIsLoading(true);
    setError("");

    Promise.all([
      apiClient<Task>(`/organizations/${organizationId}/tasks/${taskId}`),
      apiClient<{ content: Comment[] }>(`/organizations/${organizationId}/tasks/${taskId}/comments?size=50`),
    ])
      .then(([taskData, commentData]) => {
        setTask(taskData);
        setComments(commentData.content || []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load task details");
      })
      .finally(() => setIsLoading(false));
  }, [taskId, organizationId]);

  if (!taskId) return null;

  const handleUpdate = async (updates: Partial<Task>) => {
    if (!task) return;
    setError("");

    const payload = {
      title: updates.title !== undefined ? updates.title : task.title,
      description: updates.description !== undefined ? updates.description : task.description,
      status: updates.status !== undefined ? updates.status : task.status,
      priority: updates.priority !== undefined ? updates.priority : task.priority,
      assigneeId: updates.assigneeId !== undefined ? updates.assigneeId : task.assigneeId,
      dueDate: updates.dueDate !== undefined ? updates.dueDate : task.dueDate,
      labels: updates.labels !== undefined ? updates.labels : task.labels,
      version: task.version, // Required for optimistic locking
    };

    try {
      const updated = await apiClient<Task>(
        `/organizations/${organizationId}/tasks/${task.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      setTask(updated);
      onTaskUpdated(updated);
    } catch (err: any) {
      setError(err.message || "Failed to update task");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !task) return;

    setIsSubmitting(true);
    try {
      const added = await apiClient<Comment>(
        `/organizations/${organizationId}/tasks/${task.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );
      setComments((prev) => [...prev, added]);
      setNewComment("");
      setTask((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : null);
    } catch (err: any) {
      setError(err.message || "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLabel = () => {
    if (!newTagText.trim() || !task) return;
    const newLabels: Label[] = [...task.labels, { name: newTagText.trim(), color: newTagColor }];
    handleUpdate({ labels: newLabels });
    setNewTagText("");
    setIsAddingTag(false);
  };

  const handleRemoveLabel = (labelName: string) => {
    if (!task) return;
    const filtered = task.labels.filter((l) => l.name !== labelName);
    handleUpdate({ labels: filtered });
  };

  const handleDeleteTask = async () => {
    if (!task || !confirm("Are you sure you want to delete this task?")) return;
    try {
      await apiClient(`/organizations/${organizationId}/tasks/${task.id}`, {
        method: "DELETE",
      });
      onTaskDeleted(task.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete task");
    }
  };

  const priorityColors: Record<TaskPriority, string> = {
    LOW: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    MEDIUM: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
    HIGH: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
    URGENT: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out">
        {/* Jira-style Breadcrumb Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className="flex items-center space-x-1 text-brand-600 dark:text-brand-400">
              <CheckSquare className="w-4 h-4" />
              <span>ISSUE</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
            <span className="font-mono text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800">
              TASK-{task?.id}
            </span>
            {task?.isOverdue && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                <AlertCircle className="w-3 h-3" />
                <span>Overdue</span>
              </span>
            )}
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">rev.{task?.version}</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={handleDeleteTask}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Delete issue"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 dark:border-brand-900 dark:border-t-brand-400 rounded-full animate-spin" />
          </div>
        ) : task ? (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}

            {/* Editable Title */}
            <div>
              <input
                type="text"
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                onBlur={() => handleUpdate({ title: task.title })}
                className="w-full text-xl font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-brand-500 focus:outline-none py-1 transition-colors"
                placeholder="Task title"
              />
            </div>

            {/* Jira-style Meta Details Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={task.status}
                  onChange={(e) => handleUpdate({ status: e.target.value as TaskStatus })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={task.priority}
                  onChange={(e) => handleUpdate({ priority: e.target.value as TaskPriority })}
                  className={`w-full border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 ${priorityColors[task.priority]}`}
                >
                  <option value="LOW">Low (↓)</option>
                  <option value="MEDIUM">Medium (=)</option>
                  <option value="HIGH">High (↑)</option>
                  <option value="URGENT">Urgent (⇈)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Assignee</span>
                </label>
                <select
                  value={task.assigneeId || ""}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    handleUpdate({ assigneeId: val });
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Due Date</span>
                </label>
                <input
                  type="date"
                  value={task.dueDate || ""}
                  onChange={(e) => handleUpdate({ dueDate: e.target.value || null })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Description
              </label>
              <textarea
                rows={4}
                value={task.description || ""}
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={() => handleUpdate({ description: task.description })}
                placeholder="Add acceptance criteria or technical details..."
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
              />
            </div>

            {/* Labels / Tags */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Labels</span>
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {task.labels?.map((label) => (
                  <span
                    key={label.name}
                    style={{ backgroundColor: `${label.color}18`, color: label.color, borderColor: `${label.color}35` }}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-medium border"
                  >
                    <span>{label.name}</span>
                    <button
                      onClick={() => handleRemoveLabel(label.name)}
                      className="hover:opacity-75 focus:outline-none ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {isAddingTag ? (
                  <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      placeholder="Label name"
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      className="px-2 py-0.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-none"
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={handleAddLabel}
                      className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(false)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                  >
                    + Add Label
                  </button>
                )}
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Comments Thread */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <span>Activity & Comments ({comments.length})</span>
              </h4>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="flex space-x-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white rounded-lg disabled:opacity-50 text-sm font-medium flex items-center space-x-1 shadow-xs transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Comment List */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">No comments yet. Start the conversation!</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{c.authorName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-xs whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TaskDrawer;
