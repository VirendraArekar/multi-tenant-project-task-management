"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { Project } from "@/lib/types";
import {
  FolderKanban,
  Plus,
  Archive,
  Trash2,
  ExternalLink,
  ArchiveRestore,
  X,
} from "lucide-react";

export default function ProjectsPage() {
  const { currentOrg } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!currentOrg) return;
    setIsLoading(true);
    setError("");

    try {
      const isArchived = activeTab === "archived";
      const res = await apiClient<{ content: Project[] }>(
        `/organizations/${currentOrg.id}/projects?isArchived=${isArchived}&size=50`
      );
      setProjects(res.content || []);
    } catch (err: any) {
      setError(err.message || "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, activeTab]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentOrg) return;

    setIsCreating(true);
    setError("");

    try {
      const created = await apiClient<Project>(
        `/organizations/${currentOrg.id}/projects`,
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
        }
      );
      setIsModalOpen(false);
      setName("");
      setDescription("");
      if (activeTab === "active") {
        setProjects((prev) => [created, ...prev]);
      } else {
        setActiveTab("active");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleArchive = async (projectId: number, archive: boolean) => {
    if (!currentOrg) return;
    try {
      await apiClient(
        `/organizations/${currentOrg.id}/projects/${projectId}/archive?archived=${archive}`,
        { method: "PATCH" }
      );
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err: any) {
      setError(err.message || "Failed to archive project");
    }
  };

  const handleDelete = async (projectId: number) => {
    if (!currentOrg || !confirm("Are you sure? All tasks in this project will be deleted.")) return;
    try {
      await apiClient(`/organizations/${currentOrg.id}/projects/${projectId}`, {
        method: "DELETE",
      });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err: any) {
      setError(err.message || "Failed to delete project");
    }
  };

  const isOwnerOrAdmin = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Organize your initiatives into boards with kanban workflows.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("active")}
            className={`pb-3 ${
              activeTab === "active"
                ? "border-b-2 border-brand-600 text-brand-600 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Active Projects
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={`pb-3 ${
              activeTab === "archived"
                ? "border-b-2 border-brand-600 text-brand-600 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Archived Projects
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-slate-200 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={activeTab === "active" ? "No active projects yet" : "No archived projects"}
            description={
              activeTab === "active"
                ? "Create your first project to start managing tasks on an interactive kanban board."
                : "Archived projects will show up here for reference."
            }
            actionLabel={activeTab === "active" ? "Create Project" : undefined}
            onAction={activeTab === "active" ? () => setIsModalOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-slate-900 text-base">{proj.name}</h3>
                    <div className="flex items-center space-x-1">
                      {isOwnerOrAdmin && (
                        <>
                          <button
                            onClick={() => handleArchive(proj.id, !proj.isArchived)}
                            title={proj.isArchived ? "Unarchive" : "Archive"}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50"
                          >
                            {proj.isArchived ? (
                              <ArchiveRestore className="w-4 h-4" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(proj.id)}
                            title="Delete project"
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-3 mb-4">
                    {proj.description || "No description provided."}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Created by {proj.creatorName || "Teammate"}
                  </span>
                  <Link
                    href={`/projects/${proj.id}/board`}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    <span>Open Board</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Create Project</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Website Redesign"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe the project goals..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !name.trim()}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
