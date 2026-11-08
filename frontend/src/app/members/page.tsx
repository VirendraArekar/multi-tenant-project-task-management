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
  MoreVertical,
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
        {
          method: "DELETE",
        },
        currentOrg.id
      );
      if (isSelf) {
        window.location.href = "/dashboard";
      } else {
        await fetchMembersAndInvites();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Failed to remove member");
      }
    }
  };

  const copyInviteLink = (invite: Invite) => {
    const link =
      invite.inviteLink ||
      `${window.location.origin}/invite/accept?token=${invite.token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(invite.token);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "OWNER":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-3 h-3" />
            Owner
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Shield className="w-3 h-3" />
            Admin
          </span>
        );
      case "MEMBER":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-700/50 text-zinc-300 border border-zinc-700">
            <User className="w-3 h-3" />
            Member
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Members & Roles
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Manage workspace collaborators, permissions, and pending invites.
            </p>
          </div>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-500/20"
            >
              <UserPlus className="w-4 h-4" />
              Invite Teammate
            </button>
          )}
        </div>

        {error && <ErrorAlert message={error} />}
        {actionError && (
          <ErrorAlert
            message={actionError}
            onClose={() => setActionError(null)}
          />
        )}

        {/* Members List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-base font-semibold text-white">
              Workspace Members ({members.length})
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              People with access to this organization and its projects.
            </p>
          </div>

          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-zinc-800/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No members found"
                description="Invite colleagues to collaborate on projects and tasks."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
                    <th className="py-3 px-5 font-medium">User</th>
                    <th className="py-3 px-5 font-medium">Role</th>
                    <th className="py-3 px-5 font-medium">Joined</th>
                    <th className="py-3 px-5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {members.map((m) => {
                    const isSelf = m.userId === user?.id;
                    const canEditRole =
                      isOwnerOrAdmin &&
                      (currentOrg?.role === "OWNER" || m.role === "MEMBER");
                    const canRemove =
                      isOwnerOrAdmin &&
                      (currentOrg?.role === "OWNER" || m.role === "MEMBER" || isSelf);

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-zinc-800/20 transition group"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold text-xs">
                              {m.fullName
                                ? m.fullName.substring(0, 2).toUpperCase()
                                : m.email.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-white flex items-center gap-2">
                                <span>{m.fullName || "Unnamed User"}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-zinc-400 text-xs">
                                {m.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          {canEditRole ? (
                            <select
                              value={m.role}
                              onChange={(e) =>
                                handleRoleChange(
                                  m.userId,
                                  e.target.value as Role
                                )
                              }
                              className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="MEMBER">Member</option>
                              <option value="ADMIN">Admin</option>
                              {currentOrg?.role === "OWNER" && (
                                <option value="OWNER">Owner</option>
                              )}
                            </select>
                          ) : (
                            getRoleBadge(m.role)
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-zinc-400 text-xs">
                          {new Date(m.joinedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {canRemove && (
                            <button
                              onClick={() =>
                                handleRemoveMember(m.userId, m.fullName || m.email)
                              }
                              title={isSelf ? "Leave workspace" : "Remove member"}
                              className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invites (Admins & Owners) */}
        {isOwnerOrAdmin && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Pending Invitations ({invites.length})
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Invited teammates who have not yet accepted their invitation.
                </p>
              </div>
            </div>

            {invites.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                No pending invitations. Use the "Invite Teammate" button above to send one.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {invites.map((invite) => {
                  const isCopied = copiedToken === invite.token;
                  const isExpired = new Date(invite.expiresAt) < new Date();

                  return (
                    <div
                      key={invite.id}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-2 text-sm">
                            <span>{invite.email}</span>
                            {getRoleBadge(invite.role)}
                            {isExpired && (
                              <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">
                                Expired
                              </span>
                            )}
                          </div>
                          <div className="text-zinc-500 text-xs flex items-center gap-3 mt-1">
                            <span>Invited by {invite.inviterName}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expires {new Date(invite.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyInviteLink(invite)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            isCopied
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Link Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {currentOrg && (
        <InviteModal
          organizationId={currentOrg.id}
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onInviteCreated={() => {
            fetchMembersAndInvites();
          }}
        />
      )}
    </AppShell>
  );
}