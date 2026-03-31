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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const token = await executeRecaptcha("forgot_password");
      if (!token) {
        setMessage("reCAPTCHA failed.");
        return;
      }
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, recaptchaToken: token }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { success: true }
        | { success: false; error: { message: string } };
      if (!res.ok || data.success === false) {
        setMessage("Unable to send reset link.");
        return;
      }
      setMessage("If this email exists, password reset instructions were sent.");
      setTimeout(() => router.push("/auth/login"), 1200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-slate-600">Enter your email to receive reset instructions.</p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
}
