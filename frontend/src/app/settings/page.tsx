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
  const { currentOrg, user, refreshOrganizations } = useAuth();
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
      await refreshOrganizations();
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
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Workspace Settings
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage organization preferences, tenant details, and view your account profile.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Workspace details saved successfully.</span>
          </div>
        )}

        {/* Workspace Info & Rename Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Organization Details
              </h2>
              <p className="text-xs text-zinc-400">
                Tenant attributes used for multi-tenant isolation and routing.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdateOrg} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!isOwnerOrAdmin || saving}
                  className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  required
                />
                {!isOwnerOrAdmin && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Only owners and admins can rename this organization.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Slug (Immutable Key)
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-800/40 border border-zinc-700/60 rounded-lg text-zinc-400 text-sm font-mono">
                  <Globe className="w-4 h-4 text-zinc-500" />
                  <span>{currentOrg?.slug || "—"}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Tenant ID
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-800/40 border border-zinc-700/60 rounded-lg text-zinc-400 text-sm font-mono">
                  <Hash className="w-4 h-4 text-zinc-500" />
                  <span>{currentOrg?.id || "—"}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Your Role
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-800/40 border border-zinc-700/60 rounded-lg text-blue-400 text-sm font-semibold">
                  <Shield className="w-4 h-4" />
                  <span>{currentOrg?.role || "MEMBER"}</span>
                </div>
              </div>
            </div>

            {isOwnerOrAdmin && (
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-500/20"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* User Profile Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">User Profile</h2>
              <p className="text-xs text-zinc-400">
                Your personal account details across all organizations.
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Full Name
              </span>
              <span className="text-white font-medium">
                {user?.fullName || "—"}
              </span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Email Address
              </span>
              <span className="text-white font-medium">{user?.email || "—"}</span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                User ID
              </span>
              <span className="text-zinc-400 font-mono">{user?.id || "—"}</span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Authentication Method
              </span>
              <span className="text-emerald-400 font-medium">
                JWT + Refresh Tokens (BCrypt)
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}