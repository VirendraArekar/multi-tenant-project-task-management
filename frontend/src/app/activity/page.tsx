"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiError } from "@/lib/api";
import { ActivityItem, PageResponse } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import ErrorAlert from "@/components/ErrorAlert";
import {
  Activity,
  Clock,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
} from "lucide-react";

export default function ActivityLogPage() {
  const { currentOrg } = useAuth();
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivityLogs = async (pageNumber: number = 0) => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<PageResponse<ActivityItem>>(
        `/organizations/${currentOrg.id}/activity-logs?page=${pageNumber}&size=25&sort=createdAt,desc`,
        {},
        currentOrg.id
      );
      setLogs(res.content);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load activity logs");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityLogs(0);
  }, [currentOrg]);

  const getActionBadge = (action: string) => {
    let color = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    if (action.includes("CREATE")) {
      color = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    } else if (action.includes("MOVE")) {
      color = "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    } else if (action.includes("DELETE") || action.includes("REMOVE")) {
      color = "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
    } else if (action.includes("ROLE") || action.includes("MEMBER")) {
      color = "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    } else if (action.includes("OVERDUE")) {
      color = "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${color}`}>
        {action.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Activity Log & Audit Trail
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Immutable history of domain events, project updates, and member actions for {currentOrg?.name}.
            </p>
          </div>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* Activity Stream Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Kafka Event Stream</h2>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              Transactional Outbox
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading audit trail...</div>
          ) : logs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Activity}
                title="No activity recorded yet"
                description="Events such as task moves, comments, and member invites will appear in this timeline."
              />
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 sm:px-6 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start space-x-3.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 mt-0.5">
                        {log.userName ? log.userName.charAt(0) : "S"}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {log.userName || log.userEmail || "System"}
                          </span>
                          {getActionBadge(log.action)}
                          <span className="text-xs text-slate-400 font-mono">
                            {log.entityType} #{log.entityId}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {log.details || `Performed ${log.action} on ${log.entityName || "entity"}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
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
                      onClick={() => fetchActivityLogs(page - 1)}
                      disabled={page === 0}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => fetchActivityLogs(page + 1)}
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
