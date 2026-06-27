"use client";

import React, { useState, useTransition } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

export default function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const res = await changePasswordAction(formData);
        if (res.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          form.reset();
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-[#121420] border border-white/5 p-6 rounded-2xl shadow-lg">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
        Change Password
      </h3>

      {error && (
        <div className="bg-red-500/10 border border-red-500/10 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/10 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Password updated successfully.</span>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Current Password
        </label>
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          New Password
        </label>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Confirm New Password
        </label>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
        Update Password
      </button>
    </form>
  );
}
