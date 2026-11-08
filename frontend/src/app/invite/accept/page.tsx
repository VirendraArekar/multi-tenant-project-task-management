"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiError } from "@/lib/api";
import { Invite } from "@/lib/types";
import ErrorAlert from "@/components/ErrorAlert";
import { Layers, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Mail } from "lucide-react";

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { user, isAuthenticated, refreshOrgs } = useAuth();

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
      await refreshOrgs();
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
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-500 dark:text-slate-400 text-sm">Verifying invitation...</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Invalid Invitation</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-sm mx-auto">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-6 px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to {invite?.organizationName}!</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
          Invitation accepted successfully. Redirecting you to the workspace dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Join {invite?.organizationName}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          <strong>{invite?.inviterName}</strong> invited you to join as <strong>{invite?.role}</strong>.
        </p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Target Email:</span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{invite?.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Assigned Role:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{invite?.role}</span>
        </div>
      </div>

      {isAuthenticated ? (
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold text-sm shadow-xs transition-colors disabled:opacity-50"
        >
          <span>{accepting ? "Joining..." : `Accept Invite as ${user?.email}`}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => router.push(`/login?redirect=/invite/accept?token=${token}`)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold text-sm shadow-xs transition-colors"
          >
            <span>Sign In to Accept</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="text-center">
            <Link
              href={`/register?email=${encodeURIComponent(invite?.email || "")}&redirect=/invite/accept?token=${token}`}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              Don&apos;t have an account? Create one
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
            <Layers className="w-7 h-7" />
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-800">
          <Suspense fallback={<div className="text-center text-sm text-slate-400 py-8">Loading...</div>}>
            <InviteContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
