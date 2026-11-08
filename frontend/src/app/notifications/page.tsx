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
        return <UserCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />;
      case "COMMENT_ADDED":
        return <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "TASK_OVERDUE":
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "ROLE_CHANGED":
        return <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const unreadList = notifications.filter((n) => !n.isRead);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Notifications</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time events delivered by the Kafka event bus for {currentOrg?.name}.
            </p>
          </div>
          {unreadList.length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-colors self-start sm:self-auto disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* Notifications Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Bell}
                title="All caught up!"
                description="You don't have any notifications at the moment. As team activities occur, they will appear here."
              />
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                      !n.isRead
                        ? "bg-brand-50/40 dark:bg-brand-950/20"
                        : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-start space-x-3.5">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 mt-0.5">
                        {getIcon(n.type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {n.title}
                          </h4>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-brand-600 dark:bg-brand-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </span>
                      </div>
                    </div>

                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        title="Mark as read"
                        className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => fetchNotifications(page - 1)}
                      disabled={page === 0}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => fetchNotifications(page + 1)}
                      disabled={page >= totalPages - 1}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
