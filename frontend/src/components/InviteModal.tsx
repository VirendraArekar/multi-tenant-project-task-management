"use client";

import React, { useState } from "react";
import { Invite, Role } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { X, Copy, Check, Link as LinkIcon, UserPlus } from "lucide-react";

interface InviteModalProps {
  organizationId: number;
  isOpen: boolean;
  onClose: () => void;
  onInviteCreated: (invite: Invite) => void;
}

export function InviteModal({ organizationId, isOpen, onClose, onInviteCreated }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [generatedInvite, setGeneratedInvite] = useState<Invite | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const invite = await apiClient<Invite>(`/organizations/${organizationId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setGeneratedInvite(invite);
      onInviteCreated(invite);
    } catch (err: any) {
      setError(err.message || "Failed to create invitation");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedInvite) return;
    const fullUrl = `${window.location.origin}${generatedInvite.inviteLink}`;
    navigator.clipboard.writeText(fullUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleReset = () => {
    setEmail("");
    setGeneratedInvite(null);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-brand-600" />
            <h3 className="text-lg font-bold text-slate-900">Invite Teammate</h3>
          </div>
          <button onClick={handleReset} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {generatedInvite ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-sm">
              <p className="font-semibold text-emerald-900 mb-1">Invitation link generated!</p>
              <p className="text-xs text-emerald-700">
                Share this link with <strong>{generatedInvite.email}</strong>. They will join as <strong>{generatedInvite.role}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Invite Link (Valid for 7 days)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}${generatedInvite.inviteLink}` : generatedInvite.inviteLink}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-600"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1"
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500">
              Enter their email and assign an initial role. Since there is no email server, the link will be displayed for you to copy directly.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="MEMBER">Member (Can create, view, and move tasks)</option>
                <option value="ADMIN">Admin (Can manage projects, invites, and settings)</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {isLoading ? "Generating Link..." : "Create Invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default InviteModal;

