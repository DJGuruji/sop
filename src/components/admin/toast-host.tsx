"use client";

import { useEffect, useState } from "react";
import { APP_TOAST_SUCCESS, type AppToastDetail } from "@/lib/app-toast";

export function AdminToastHost() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // Browser timers are numeric IDs; avoid NodeJS.Timeout from merged @types/node.
    let hideTimer: number | undefined;
    function onToast(e: Event) {
      const ce = e as CustomEvent<AppToastDetail>;
      const message = ce.detail?.message;
      if (!message) return;
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      setToast(message);
      hideTimer = window.setTimeout(() => setToast(null), 4000);
    }
    window.addEventListener(APP_TOAST_SUCCESS, onToast as EventListener);
    return () => {
      window.removeEventListener(APP_TOAST_SUCCESS, onToast as EventListener);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-6 right-6 z-[100] max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg"
    >
      {toast}
    </div>
  );
}
