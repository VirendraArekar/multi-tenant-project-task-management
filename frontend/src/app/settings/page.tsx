"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiError } from "@/lib/api";
import { Organization } from "@/lib/types";
import ErrorAlert from "@/components/ErrorAlert";
import {
  Building,
  User,
  Shield,
  Save,
  CheckCircle2,
  Calendar,
  Hash,
  Globe,
} from "lucide-react";

export default function SettingsPage() {
  const { currentOrg, user, refreshOrgs } = useAuth();
  const [orgName, setOrgName] = useState(currentOrg?.name || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnerOrAdmin =
    currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN";

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    if (!orgName.trim()) {
      setError("Organization name cannot be empty");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await apiClient<Organization>(
        `/organizations/${currentOrg.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: orgName.trim() }),
        },
        currentOrg.id
      );

      setSuccess(true);
      await refreshOrgs();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update organization details");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Workspace Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage organization preferences, tenant details, and view your account profile for {currentOrg?.name}.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {success && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            <span>Workspace details saved successfully.</span>
          </div>
        )}

        {/* Workspace Info & Rename Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/70 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Organization Details
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tenant attributes used for multi-tenant isolation and routing.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <form onSubmit={handleUpdateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Workspace Name
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={!isOwnerOrAdmin || saving}
                    placeholder="Enter workspace name"
                    className="flex-1 px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                  />
                  {isOwnerOrAdmin && (
                    <button
                      type="submit"
                      disabled={saving || orgName === currentOrg?.name}
                      className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? "Saving..." : "Save Changes"}</span>
                    </button>
                  )}
                </div>
                {!isOwnerOrAdmin && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Only workspace Owners and Admins can rename this organization.
                  </p>
                )}
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Tenant ID</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {currentOrg?.id}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Slug</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {currentOrg?.slug}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Your Role</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {currentOrg?.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* User Account Profile */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Personal Profile
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your authenticated user identity and credentials.
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Full Name</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {user?.fullName}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Email Address</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {user?.email}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
