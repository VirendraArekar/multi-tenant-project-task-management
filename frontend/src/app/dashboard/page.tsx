"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { DashboardData, TaskStatus } from "@/lib/types";
import {
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  Layers,
  ArrowRight,
  TrendingUp,
  FolderKanban,
  Activity,
  UserCheck,
  PieChart,
  BarChart3,
  Flame,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  const { currentOrg } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredSlice, setHoveredSlice] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    setIsLoading(true);
    setError("");

    apiClient<DashboardData>(`/organizations/${currentOrg.id}/dashboard`)
      .then((res) => setData(res))
      .catch((err) => setError(err.message || "Failed to load dashboard metrics"))
      .finally(() => setIsLoading(false));
  }, [currentOrg]);

  // Donut chart calculations
  const total = data?.totalTasks || 0;
  const todoCount = data?.countsByStatus?.TODO || 0;
  const inProgCount = data?.countsByStatus?.IN_PROGRESS || 0;
  const inReviewCount = data?.countsByStatus?.IN_REVIEW || 0;
  const doneCount = data?.countsByStatus?.DONE || 0;

  const circumference = 2 * Math.PI * 40; // r=40 -> ~251.32

  const todoLen = total > 0 ? (todoCount / total) * circumference : 0;
  const inProgLen = total > 0 ? (inProgCount / total) * circumference : 0;
  const inReviewLen = total > 0 ? (inReviewCount / total) * circumference : 0;
  const doneLen = total > 0 ? (doneCount / total) * circumference : 0;

  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Mock 7-day velocity data points for the dynamic SVG area chart
  const velocityPoints = [
    { day: "Mon", created: 8, completed: 5 },
    { day: "Tue", created: 14, completed: 9 },
    { day: "Wed", created: 11, completed: 12 },
    { day: "Thu", created: 19, completed: 15 },
    { day: "Fri", created: 16, completed: 18 },
    { day: "Sat", created: 7, completed: 8 },
    { day: "Sun", created: 9, completed: Math.max(6, Math.min(22, doneCount)) },
  ];

  const maxVal = Math.max(...velocityPoints.flatMap((p) => [p.created, p.completed]), 20);
  const svgWidth = 520;
  const svgHeight = 160;
  const padding = 25;

  const getX = (idx: number) =>
    padding + (idx * (svgWidth - padding * 2)) / (velocityPoints.length - 1);
  const getY = (val: number) =>
    svgHeight - padding - (val / maxVal) * (svgHeight - padding * 2);

  // SVG path generators for area & line
  const completedPathD = velocityPoints.reduce((acc, p, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(p.completed)}`;
  }, "");

  const completedAreaD = `${completedPathD} L ${getX(velocityPoints.length - 1)} ${
    svgHeight - padding
  } L ${getX(0)} ${svgHeight - padding} Z`;

  const createdPathD = velocityPoints.reduce((acc, p, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(p.created)}`;
  }, "");

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Engineering Analytics & Overview
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                Live Metrics
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time pipeline metrics, team velocity curves, and audit stream for{" "}
              <strong>{currentOrg?.name}</strong>.
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <FolderKanban className="w-4 h-4" />
            <span>Open Kanban Boards</span>
          </Link>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800/60 rounded-xl" />
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
              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 rounded-xl text-red-800 dark:text-red-300 shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/60 rounded-lg text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block">
                      {data.overdueTasks} task(s) currently past their due date!
                    </span>
                    <span className="text-xs text-red-600 dark:text-red-400">
                      Automated overdue scheduler has flagged these tasks. Please inspect sprint deadlines.
                    </span>
                  </div>
                </div>
                <Link
                  href="/projects"
                  className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                >
                  <span>Review Tasks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Issues
                  </span>
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                    <ListTodo className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
                  {data.totalTasks}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Across all active projects
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    In Progress
                  </span>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/70 rounded-lg text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {data.countsByStatus?.IN_PROGRESS || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Active in development
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Resolved / Done
                  </span>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/70 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {data.countsByStatus?.DONE || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {completionPct}% completion rate
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    My Assigned Tasks
                  </span>
                  <div className="p-2 bg-brand-50 dark:bg-brand-950/70 rounded-lg text-brand-600 dark:text-brand-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-bold text-brand-600 dark:text-brand-400">
                  {data.myOpenTasks}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Assigned to your user
                </div>
              </div>
            </div>

            {/* WONDERFUL DYNAMIC GRAPHS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dynamic Graph 1: Interactive Radial / Donut Pipeline Gauge */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <PieChart className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Pipeline Distribution Donut
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                    {total} Total Issues
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
                  {/* SVG Donut */}
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 100 100">
                      {/* Background Circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-slate-100 dark:text-slate-800/80 fill-none"
                      />

                      {/* Segment: TODO */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#94a3b8"
                        strokeWidth={hoveredSlice === "TODO" ? "14" : "12"}
                        strokeDasharray={`${todoLen} ${circumference}`}
                        strokeDashoffset="0"
                        className="fill-none transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredSlice("TODO")}
                        onMouseLeave={() => setHoveredSlice(null)}
                      />

                      {/* Segment: IN_PROGRESS */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#3b82f6"
                        strokeWidth={hoveredSlice === "IN_PROGRESS" ? "14" : "12"}
                        strokeDasharray={`${inProgLen} ${circumference}`}
                        strokeDashoffset={`-${todoLen}`}
                        className="fill-none transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredSlice("IN_PROGRESS")}
                        onMouseLeave={() => setHoveredSlice(null)}
                      />

                      {/* Segment: IN_REVIEW */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#a855f7"
                        strokeWidth={hoveredSlice === "IN_REVIEW" ? "14" : "12"}
                        strokeDasharray={`${inReviewLen} ${circumference}`}
                        strokeDashoffset={`-${todoLen + inProgLen}`}
                        className="fill-none transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredSlice("IN_REVIEW")}
                        onMouseLeave={() => setHoveredSlice(null)}
                      />

                      {/* Segment: DONE */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#10b981"
                        strokeWidth={hoveredSlice === "DONE" ? "14" : "12"}
                        strokeDasharray={`${doneLen} ${circumference}`}
                        strokeDashoffset={`-${todoLen + inProgLen + inReviewLen}`}
                        className="fill-none transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredSlice("DONE")}
                        onMouseLeave={() => setHoveredSlice(null)}
                      />
                    </svg>

                    {/* Donut Center KPI */}
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {completionPct}%
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Resolved
                      </span>
                    </div>
                  </div>

                  {/* Interactive Legend */}
                  <div className="space-y-2.5 w-full sm:w-48">
                    <div
                      onMouseEnter={() => setHoveredSlice("TODO")}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        hoveredSlice === "TODO" ? "bg-slate-100 dark:bg-slate-800" : ""
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-slate-400" />
                        <span className="text-slate-700 dark:text-slate-300">To Do</span>
                      </div>
                      <span className="font-mono text-slate-900 dark:text-white">{todoCount}</span>
                    </div>

                    <div
                      onMouseEnter={() => setHoveredSlice("IN_PROGRESS")}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        hoveredSlice === "IN_PROGRESS" ? "bg-blue-50 dark:bg-blue-950/60" : ""
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-slate-700 dark:text-slate-300">In Progress</span>
                      </div>
                      <span className="font-mono text-slate-900 dark:text-white">{inProgCount}</span>
                    </div>

                    <div
                      onMouseEnter={() => setHoveredSlice("IN_REVIEW")}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        hoveredSlice === "IN_REVIEW" ? "bg-purple-50 dark:bg-purple-950/60" : ""
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-purple-500" />
                        <span className="text-slate-700 dark:text-slate-300">In Review</span>
                      </div>
                      <span className="font-mono text-slate-900 dark:text-white">{inReviewCount}</span>
                    </div>

                    <div
                      onMouseEnter={() => setHoveredSlice("DONE")}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        hoveredSlice === "DONE" ? "bg-emerald-50 dark:bg-emerald-950/60" : ""
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-slate-700 dark:text-slate-300">Done</span>
                      </div>
                      <span className="font-mono text-slate-900 dark:text-white">{doneCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Graph 2: 7-Day Velocity & Throughput Wave Area Chart */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Flame className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        Sprint Velocity Wave (Throughput)
                      </h3>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] font-semibold">
                      <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Completed</span>
                      </span>
                      <span className="flex items-center space-x-1 text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span>Created</span>
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Daily issues completed vs created over the past sprint cycle.
                  </p>
                </div>

                {/* SVG Area Chart */}
                <div className="w-full overflow-hidden">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-36 overflow-visible"
                  >
                    <defs>
                      <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.5, 1].map((pct, i) => {
                      const y = padding + pct * (svgHeight - padding * 2);
                      return (
                        <line
                          key={i}
                          x1={padding}
                          y1={y}
                          x2={svgWidth - padding}
                          y2={y}
                          stroke="currentColor"
                          className="text-slate-100 dark:text-slate-800"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {/* Gradient Area Fill */}
                    <path d={completedAreaD} fill="url(#completedGradient)" />

                    {/* Created Line */}
                    <path
                      d={createdPathD}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />

                    {/* Completed Line */}
                    <path
                      d={completedPathD}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      className="transition-all duration-300"
                    />

                    {/* Data Points */}
                    {velocityPoints.map((p, idx) => (
                      <g key={idx}>
                        <circle
                          cx={getX(idx)}
                          cy={getY(p.completed)}
                          r="4"
                          className="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2 hover:r-6 transition-all cursor-pointer"
                        />
                        <text
                          x={getX(idx)}
                          y={svgHeight - 6}
                          textAnchor="middle"
                          className="text-[10px] fill-slate-400 font-mono font-medium"
                        >
                          {p.day}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            </div>

            {/* Split Grid: Team Capacity Bars & Recent Audit Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dynamic Workload Capacity Bars */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Team Capacity & Workload Balance
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {data.tasksPerMember.length} Members
                  </span>
                </div>

                {data.tasksPerMember.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tasks assigned to teammates yet.</p>
                ) : (
                  <div className="space-y-4 pt-1">
                    {data.tasksPerMember.map((m) => {
                      const pct = total > 0 ? Math.round((m.taskCount / total) * 100) : 0;
                      return (
                        <div key={m.userId} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-bold text-[10px] flex items-center justify-center">
                                {m.userName.charAt(0)}
                              </div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {m.userName}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                {m.taskCount} tasks ({pct}%)
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  pct > 30
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                }`}
                              >
                                {pct > 30 ? "Heavy" : "Balanced"}
                              </span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500"
                              style={{ width: `${Math.min(100, pct * 2.5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Activity Audit Feed */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Real-Time Activity Stream
                    </h3>
                  </div>
                  <Link
                    href="/activity"
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Full Audit Log</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {data.recentActivity.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {data.recentActivity.slice(0, 5).map((act) => (
                      <div key={act.id} className="py-2.5 flex items-start space-x-3 text-sm">
                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg mt-0.5 flex-shrink-0">
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 dark:text-slate-200 text-xs truncate">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {act.userName || act.userEmail || "System"}
                            </span>{" "}
                            {act.details || act.action}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(act.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
