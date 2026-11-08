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
  Clock,
  Send,
  Trash2,
  Check,
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
    LOW: "bg-slate-100 text-slate-700",
    MEDIUM: "bg-blue-50 text-blue-700",
    HIGH: "bg-amber-50 text-amber-700",
    URGENT: "bg-rose-50 text-rose-700 font-semibold",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-slate-400">TASK-{task?.id}</span>
            {task?.isOverdue && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                <AlertCircle className="w-3 h-3" />
                <span>Overdue</span>
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono">v{task?.version}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDeleteTask}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
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
                className="w-full text-xl font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:outline-none py-1"
                placeholder="Task title"
              />
            </div>

            {/* Status & Priority Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={task.status}
                  onChange={(e) => handleUpdate({ status: e.target.value as TaskStatus })}
                  className="w-full bg-white border border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={task.priority}
                  onChange={(e) => handleUpdate({ priority: e.target.value as TaskPriority })}
                  className={`w-full border border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 ${priorityColors[task.priority]}`}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Assignee</span>
                </label>
                <select
                  value={task.assigneeId || ""}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    handleUpdate({ assigneeId: val });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Due Date</span>
                </label>
                <input
                  type="date"
                  value={task.dueDate || ""}
                  onChange={(e) => handleUpdate({ dueDate: e.target.value || null })}
                  className="w-full bg-white border border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={4}
                value={task.description || ""}
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={() => handleUpdate({ description: task.description })}
                placeholder="Add a more detailed description..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Labels / Tags */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center space-x-1">
                <Tag className="w-4 h-4 text-slate-400" />
                <span>Labels</span>
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {task.labels?.map((label) => (
                  <span
                    key={label.name}
                    style={{ backgroundColor: `${label.color}15`, color: label.color, borderColor: `${label.color}30` }}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium border"
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
                  <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      placeholder="Label name"
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      className="px-2 py-0.5 text-xs border border-slate-300 rounded focus:outline-none"
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
                      className="p-1 text-emerald-600 hover:text-emerald-700"
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
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    + Add Label
                  </button>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Comments Thread */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <span>Comments & Discussion ({comments.length})</span>
              </h4>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="flex space-x-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium flex items-center space-x-1"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Comment List */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No comments yet. Start the conversation!</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 text-xs">{c.authorName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs whitespace-pre-wrap">{c.content}</p>
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

