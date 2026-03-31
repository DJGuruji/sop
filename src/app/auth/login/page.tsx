"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function UserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha("login");
      if (!recaptchaToken) {
        setError("reCAPTCHA failed");
        return;
      }
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, recaptchaToken }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { success: true; data: { redirectTo: string } }
        | { success: false; error: { message: string } };
      if (!res.ok || data.success === false) {
        setError("Invalid credentials");
        return;
      }
      router.push(data.data.redirectTo ?? "/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">User Access</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in to your account</h1>
          <p className="mt-1 text-sm text-slate-600">Enter your corporate email and password.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-3 text-center text-sm text-slate-600">
          <a href="/auth/forgot-password" className="font-medium text-slate-800 hover:text-slate-900">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}

