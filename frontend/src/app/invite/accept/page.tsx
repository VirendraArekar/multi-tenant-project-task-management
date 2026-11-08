"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiError } from "@/lib/api";
import { Invite } from "@/lib/types";
import ErrorAlert from "@/components/ErrorAlert";
import { LayoutGrid, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Mail } from "lucide-react";

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { user, isAuthenticated, refreshOrganizations } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided. Check the link you received.");
      setLoading(false);
      return;
    }

    const fetchInviteDetails = async () => {
      try {
        const data = await apiClient<Invite>(`/invites/${token}`);
        setInvite(data);
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load invitation details. The invite may be invalid or expired.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInviteDetails();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      await apiClient<void>(`/invites/${token}/accept`, {
        method: "POST",
      });
      setSuccess(true);
      await refreshOrganizations();
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to accept invitation");
      }
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-zinc-400 text-sm">Verifying invitation...</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">Invalid Invitation</h2>
        <p className="text-zinc-400 text-sm mt-2 max-w-sm mx-auto">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">Welcome to {invite?.organizationName}!</h2>
        <p className="text-zinc-400 text-sm mt-2">
          Invitation accepted successfully. Redirecting you to the dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Join {invite?.organizationName}
        </h2>
        <p className="text-zinc-400 text-sm mt-1">
          <strong className="text-zinc-200">{invite?.inviterName}</strong> invited you to collaborate on TeamBoard as a <strong className="text-blue-400">{invite?.role}</strong>.
        </p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Target Workspace:</span>
          <span className="font-medium text-white">{invite?.organizationName}</span>
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span>Assigned Role:</span>
          <span className="font-semibold text-blue-400">{invite?.role}</span>
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span>Invited Email:</span>
          <span className="font-medium text-zinc-300">{invite?.email}</span>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="space-y-4 pt-2">
          <p className="text-xs text-zinc-400 text-center">
            You must be logged in to accept this invitation.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push(`/login?returnUrl=/invite/accept?token=${token}`)}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition text-center"
            >
              Log In
            </button>
            <button
              onClick={() => router.push(`/register?returnUrl=/invite/accept?token=${token}`)}
              className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition text-center border border-zinc-700"
            >
              Sign Up
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3 text-xs text-zinc-300 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Signed in as <strong>{user?.email}</strong>.
            </span>
          </div>

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {accepting ? (
              "Accepting..."
            ) : (
              <>
                Accept Invitation
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/30">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">TeamBoard</span>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <InviteContent />
        </Suspense>
      </div>
    </div>
  );
}