"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY;

function loadRecaptcha(siteKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("browser only"));
    if (window.grecaptcha) return resolve();
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load recaptcha"));
    document.head.appendChild(script);
  });
}

async function executeRecaptcha(action: string) {
  if (!RECAPTCHA_SITE_KEY) return null;
  await loadRecaptcha(RECAPTCHA_SITE_KEY);
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) return null;
  return await new Promise<string | null>((resolve) => {
    grecaptcha.ready(() => {
      grecaptcha.execute(RECAPTCHA_SITE_KEY, { action }).then(resolve).catch(() => resolve(null));
    });
  });
}

type ApiError = { success: false; error: { code: string; message: string } };
type ApiSuccess = { success: true; data: unknown; message?: string };

export default function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const disabled = !token || loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage("Missing reset token.");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha("reset_password");
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword, recaptchaToken: recaptchaToken ?? undefined }),
      });

      const data = (await res.json().catch(() => ({}))) as ApiSuccess | ApiError;
      if (!res.ok || !("success" in data) || data.success === false) {
        setMessage("Unable to reset password. Please request a new reset link and try again.");
        return;
      }

      setMessage("Password updated. Redirecting to login...");
      setTimeout(() => router.push("/auth/login"), 1200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Security</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Reset password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose a strong password you haven’t used before.
          </p>
        </div>

        {!token ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This reset link is missing a token. Please request a new reset link.
          </div>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={disabled}
            />
            <p className="mt-1 text-xs text-slate-500">Minimum 8 characters.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              disabled={disabled}
            />
          </div>

          {message ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={disabled}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

