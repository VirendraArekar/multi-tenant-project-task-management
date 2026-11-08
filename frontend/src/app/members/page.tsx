"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiError } from "@/lib/api";
import { Member, Invite, Role } from "@/lib/types";
import InviteModal from "@/components/InviteModal";
import EmptyState from "@/components/EmptyState";
import ErrorAlert from "@/components/ErrorAlert";
import {
  UserPlus,
  Shield,
  ShieldAlert,
  User,
  Trash2,
  Copy,
  Check,
  Clock,
  Mail,
  Users,
} from "lucide-react";

export default function MembersPage() {
  const { currentOrg, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const isOwnerOrAdmin = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN";

  const fetchMembersAndInvites = async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const membersRes = await apiClient<Member[]>(
        `/organizations/${currentOrg.id}/members`,
        {},
        currentOrg.id
      );
      setMembers(membersRes);

      if (isOwnerOrAdmin) {
        const invitesRes = await apiClient<Invite[]>(
          `/organizations/${currentOrg.id}/invites`,
          {},
          currentOrg.id
        );
        setInvites(invitesRes);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load workspace members");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembersAndInvites();
  }, [currentOrg]);

  const handleRoleChange = async (memberUserId: number, newRole: Role) => {
    if (!currentOrg) return;
    setActionError(null);
    try {
      await apiClient<void>(
        `/organizations/${currentOrg.id}/members/${memberUserId}/role`,
        {
          method: "PUT",
          body: JSON.stringify({ role: newRole }),
        },
        currentOrg.id
      );
      await fetchMembersAndInvites();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Failed to update member role");
      }
    }
  };

  const handleRemoveMember = async (memberUserId: number, memberName: string) => {
    if (!currentOrg) return;
    const isSelf = memberUserId === user?.id;
    const confirmMsg = isSelf
      ? "Are you sure you want to leave this workspace?"
      : `Are you sure you want to remove ${memberName} from this workspace?`;
    if (!window.confirm(confirmMsg)) return;

    setActionError(null);
    try {
      await apiClient<void>(
        `/organizations/${currentOrg.id}/members/${memberUserId}`,
        { method: "DELETE" },
        currentOrg.id
      );
      await fetchMembersAndInvites();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Failed to remove member");
      }
    }
  };

  const copyInviteLink = (invite: Invite) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = invite.inviteLink.startsWith("http")
      ? invite.inviteLink
      : `${origin}${invite.inviteLink}`;

    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(invite.token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "OWNER":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Owner
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Shield className="w-3.5 h-3.5 text-indigo-500" />
            Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <User className="w-3.5 h-3.5 text-slate-500" />
            Member
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Team Members</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage workspace access, assign permissions, and generate invite links for {currentOrg?.name}.
            </p>
          </div>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Member</span>
            </button>
          )}
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}
        {actionError && <ErrorAlert message={actionError} onClose={() => setActionError(null)} />}

        {/* Members Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Active Members ({members.length})</h2>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              RBAC Enabled
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title="No members found"
                description="Invite teammates to start collaborating on tasks and projects."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Member</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Joined</th>
                    {isOwnerOrAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {members.map((m) => {
                    const isSelf = m.userId === user?.id;
                    const canModify =
                      isOwnerOrAdmin &&
                      (currentOrg?.role === "OWNER" || m.role === "MEMBER") &&
                      (!isSelf || currentOrg?.role !== "OWNER");

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-bold text-xs flex items-center justify-center uppercase">
                              {m.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {m.fullName} {isSelf && <span className="text-xs text-brand-600 font-normal">(You)</span>}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">UID-{m.userId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                          {m.email}
                        </td>
                        <td className="px-6 py-4">
                          {canModify && !isSelf ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.userId, e.target.value as Role)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                              <option value="MEMBER">Member</option>
                              <option value="ADMIN">Admin</option>
                              {currentOrg?.role === "OWNER" && <option value="OWNER">Owner</option>}
                            </select>
                          ) : (
                            getRoleBadge(m.role)
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </td>
                        {isOwnerOrAdmin && (
                          <td className="px-6 py-4 text-right">
                            {canModify ? (
                              <button
                                onClick={() => handleRemoveMember(m.userId, m.fullName)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                title="Remove member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invites Section */}
        {isOwnerOrAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Pending Invitations ({invites.length})</h2>
              </div>
              <span className="text-xs text-slate-400">7-day link expiration</span>
            </div>

            {invites.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No active pending invitations. Click &quot;Invite Member&quot; to generate an invitation link.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {invites.map((inv) => (
                  <div key={inv.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{inv.email}</div>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                        <span>Invited as <strong>{inv.role}</strong></span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => copyInviteLink(inv)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors self-start sm:self-auto"
                    >
                      {copiedToken === inv.token ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invite Modal */}
        {currentOrg && (
          <InviteModal
            organizationId={currentOrg.id}
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            onInviteCreated={() => fetchMembersAndInvites()}
          />
        )}
      </div>
    </AppShell>
  );
}
