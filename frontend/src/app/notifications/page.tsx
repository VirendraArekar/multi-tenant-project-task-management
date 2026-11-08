"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiError } from "@/lib/api";
import { NotificationItem, PageResponse } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import ErrorAlert from "@/components/ErrorAlert";
import {
  Bell,
  CheckCheck,
  Check,
  MessageSquare,
  UserCheck,
  AlertTriangle,
  Shield,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

export default function NotificationsPage() {
  const { currentOrg, setUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async (pageNumber: number = 0) => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<PageResponse<NotificationItem>>(
        `/organizations/${currentOrg.id}/notifications?page=${pageNumber}&size=20&sort=createdAt,desc`,
        {},
        currentOrg.id
      );
      setNotifications(res.content);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load notifications");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(0);
  }, [currentOrg]);

  const handleMarkAsRead = async (id: number) => {
    if (!currentOrg) return;
    try {
      await apiClient<void>(
        `/organizations/${currentOrg.id}/notifications/${id}/read`,
        { method: "PATCH" },
        currentOrg.id
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentOrg) return;
    setMarkingAll(true);
    try {
      await apiClient<void>(
        `/organizations/${currentOrg.id}/notifications/read-all`,
        { method: "PATCH" },
        currentOrg.id
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to mark all notifications as read");
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "TASK_ASSIGNED":
        return <UserCheck className="w-4 h-4 text-blue-400" />;
      case "COMMENT_ADDED":
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case "TASK_OVERDUE":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "ROLE_CHANGED":
      case "MEMBER_JOINED":
        return <Shield className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  const unreadCountInList = notifications.filter((n) => !n.isRead).length;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Notifications
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Stay updated on task assignments, comments, overdue items, and workspace changes.
            </p>
          </div>
          {unreadCountInList > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4 text-blue-400" />
              Mark all as read
            </button>
          )}
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-zinc-800/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Bell}
                title="No notifications yet"
                description="When tasks are assigned, commented on, or overdue, alerts will appear right here."
              />
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex items-start gap-4 transition ${
                    item.isRead
                      ? "bg-zinc-900/50 hover:bg-zinc-850"
                      : "bg-blue-950/15 hover:bg-blue-950/25 border-l-4 border-l-blue-500"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={`text-sm font-semibold truncate ${
                          item.isRead ? "text-zinc-200" : "text-white"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {new Date(item.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {!item.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(item.id)}
                      title="Mark as read"
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <div>
                Page {page + 1} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => fetchNotifications(page - 1)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-800 rounded-lg transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => fetchNotifications(page + 1)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-800 rounded-lg transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}