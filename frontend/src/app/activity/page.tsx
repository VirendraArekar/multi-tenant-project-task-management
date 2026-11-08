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
  User,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
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
    let color = "bg-zinc-800 text-zinc-300 border-zinc-700";
    if (action.includes("CREATE")) {
      color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    } else if (action.includes("MOVE")) {
      color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    } else if (action.includes("DELETE") || action.includes("REMOVE")) {
      color = "bg-red-500/10 text-red-400 border-red-500/20";
    } else if (action.includes("ROLE") || action.includes("MEMBER")) {
      color = "bg-purple-500/10 text-purple-400 border-purple-500/20";
    } else if (action.includes("OVERDUE")) {
      color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }

    return (
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${color}`}
      >
        {action.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Activity Log & Audit Trail
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Immutable history of domain events, project updates, and member actions.
            </p>
          </div>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Event Stream</span>
            </div>
            <span className="text-xs text-zinc-400">
              Audit logs are automatically published via Kafka consumers
            </span>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-zinc-800/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Activity}
                title="No activity recorded yet"
                description="Actions like creating projects, moving tasks, assigning teammates, or changing roles will be logged here automatically."
              />
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 sm:px-6 hover:bg-zinc-850/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-semibold text-xs shrink-0 mt-0.5 sm:mt-0">
                      {log.userName
                        ? log.userName.substring(0, 2).toUpperCase()
                        : "SY"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">
                          {log.userName || "System"}
                        </span>
                        {getActionBadge(log.action)}
                        {log.entityName && (
                          <span className="text-zinc-300 font-medium truncate max-w-xs">
                            "{log.entityName}"
                          </span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 self-end sm:self-center">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {new Date(log.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <div>
                Page {page + 1} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => fetchActivityLogs(page - 1)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 rounded-lg transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => fetchActivityLogs(page + 1)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 rounded-lg transition"
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