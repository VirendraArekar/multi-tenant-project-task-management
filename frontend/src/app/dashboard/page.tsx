"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { DashboardData } from "@/lib/types";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Layers,
  ArrowRight,
  TrendingUp,
  FolderKanban,
  Activity,
  UserCheck,
} from "lucide-react";

export default function DashboardPage() {
  const { currentOrg } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentOrg) return;
    setIsLoading(true);
    setError("");

    apiClient<DashboardData>(`/organizations/${currentOrg.id}/dashboard`)
      .then((res) => setData(res))
      .catch((err) => setError(err.message || "Failed to load dashboard metrics"))
      .finally(() => setIsLoading(false));
  }, [currentOrg]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workspace Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Real-time project aggregates, workload distribution, and audit feed for {currentOrg?.name}.
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors self-start sm:self-auto"
          >
            <FolderKanban className="w-4 h-4" />
            <span>View Projects</span>
          </Link>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-slate-200 rounded-xl" />
            ))}
          </div>
        ) : !data || data.totalTasks === 0 ? (
          <EmptyState
            icon={Layers}
            title="No tasks in this workspace yet"
            description="Create your first project and add tasks to see real-time kanban counts, workload distribution, and activity feeds."
            actionLabel="Create Project"
            onAction={() => (window.location.href = "/projects")}
          />
        ) : (
          <>
            {/* Overdue alert banner if any overdue tasks */}
            {data.overdueTasks > 0 && (
              <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold">{data.overdueTasks} task(s) are overdue!</span> Please review assignments and update target completion dates.
                </div>
              </div>
            )}

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Tasks
                  </span>
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <ListTodo className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-slate-900">{data.totalTasks}</div>
                <div className="mt-1 text-xs text-slate-500">Across all projects</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    In Progress
                  </span>
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-indigo-600">
                  {data.countsByStatus?.IN_PROGRESS || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">Currently active</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Completed
                  </span>
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-emerald-600">
                  {data.countsByStatus?.DONE || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">Resolved tasks</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    My Open Tasks
                  </span>
                  <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-brand-600">
                  {data.myOpenTasks}
                </div>
                <div className="mt-1 text-xs text-slate-500">Assigned to you</div>
              </div>
            </div>

            {/* Split Grid: Status Breakdown & Team Workload */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Breakdown */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Status Pipeline</h3>
                <div className="space-y-4">
                  {(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map((status) => {
                    const count = data.countsByStatus[status] || 0;
                    const percent = data.totalTasks > 0 ? Math.round((count / data.totalTasks) * 100) : 0;
                    const colorMap = {
                      TODO: "bg-slate-500",
                      IN_PROGRESS: "bg-indigo-600",
                      IN_REVIEW: "bg-amber-500",
                      DONE: "bg-emerald-500",
                    };
                    const labelMap = {
                      TODO: "To Do",
                      IN_PROGRESS: "In Progress",
                      IN_REVIEW: "In Review",
                      DONE: "Done",
                    };
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span className="text-slate-700">{labelMap[status]}</span>
                          <span className="text-slate-500">
                            {count} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full ${colorMap[status]} transition-all duration-500`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workload by Teammate */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Team Workload</h3>
                {data.tasksPerMember.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tasks assigned to teammates yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.tasksPerMember.map((m) => (
                      <div key={m.userId} className="py-2.5 flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                            {m.userName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{m.userName}</div>
                            <div className="text-xs text-slate-400">{m.userEmail}</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {m.taskCount} tasks
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Audit Feed */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-brand-600" />
                  <span>Recent Activity Feed</span>
                </h3>
                <Link
                  href="/activity"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
                >
                  <span>Full Audit Trail</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {data.recentActivity.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recentActivity.map((act) => (
                    <div key={act.id} className="py-3 flex items-start space-x-3 text-sm">
                      <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg mt-0.5">
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-800 text-xs">
                          <span className="font-semibold text-slate-900">
                            {act.userName || act.userEmail || "System"}
                          </span>{" "}
                          {act.details || act.action}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {new Date(act.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
