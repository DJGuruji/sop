"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDeleteModal } from "@/components/admin/confirm-delete-modal";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
} | null;

type LogRow = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  meta: unknown;
  actor: Actor;
};

type ApiResponse =
  | { success: true; data: { logs: LogRow[]; nextCursor: string | null }; message?: string }
  | { success: false; error: { code: string; message: string } };

function formatActor(a: Actor) {
  if (!a) return "System";
  return `${a.name} (${a.role})`;
}

function actionBadgeClass(action: string): string {
  const base = "inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ";
  switch (action) {
    case "LOGIN":
    case "LOGOUT":
      return base + "bg-blue-100 text-blue-800 ring-blue-200";
    case "CREATE":
      return base + "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "UPDATE":
    case "SOFT_DELETE":
    case "RESTORE":
      return base + "bg-amber-100 text-amber-800 ring-amber-200";
    case "DELETE":
      return base + "bg-red-100 text-red-800 ring-red-200";
    default:
      return base + "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

type MeResponse =
  | { success: true; data: { user: { role: string } } }
  | { success: false; error: { code: string; message: string } };

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canExportCsv, setCanExportCsv] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const actorText = l.actor ? `${l.actor.name} ${l.actor.email} ${l.actor.role}` : "system";
      const hay = `${l.action} ${l.entityType} ${l.entityId} ${l.entityTitle ?? ""} ${actorText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, query]);

  async function load(cursor?: string) {
    const url = new URL("/api/audit-logs", window.location.origin);
    url.searchParams.set("limit", String(pageSize));
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok || data.success === false) {
      setError("Unable to load logs.");
      return { logs: [], nextCursor: null as string | null };
    }
    return { logs: data.data.logs, nextCursor: data.data.nextCursor };
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<MeResponse>)
      .then((data) => {
        if (!cancelled && data.success) {
          const r = data.data.user.role;
          if (r === "SUPER_ADMIN") setIsSuperAdmin(true);
          if (r === "SUPER_ADMIN" || r === "ADMIN") setCanExportCsv(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLogs([]);
    setNextCursor(null);
    void (async () => {
      const result = await load();
      if (cancelled) return;
      setLogs(result.logs);
      setNextCursor(result.nextCursor);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pageSize]);

  async function onConfirmClearAll() {
    if (!isSuperAdmin) return;
    setClearing(true);
    setError(null);
    try {
      const res = await fetch("/api/audit-logs", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        setError("Unable to clear logs.");
        return;
      }
      setShowClearConfirm(false);
      const result = await load();
      setLogs(result.logs);
      setNextCursor(result.nextCursor);
    } finally {
      setClearing(false);
    }
  }

  async function onLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await load(nextCursor);
      setLogs((prev) => [...prev, ...result.logs]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <ConfirmDeleteModal
        open={showClearConfirm}
        title="Clear all audit logs"
        message="Clear all audit logs? This will soft-delete every log entry. Only Super Admin can perform this action."
        confirmLabel="Clear all logs"
        onConfirm={onConfirmClearAll}
        onCancel={() => setShowClearConfirm(false)}
        loading={clearing}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Audit</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Logs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Immutable audit trail of system and user actions (visibility is role-scoped).
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search action, entity, actor…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 sm:w-80"
          />
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {loading ? "Loading…" : `${filtered.length} shown`}
          </div>
          {canExportCsv && (
            <button
              type="button"
              disabled={exportingCsv}
              onClick={async () => {
                setExportingCsv(true);
                try {
                  const res = await fetch("/api/audit-logs/export", { credentials: "include" });
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "audit-logs.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                } finally {
                  setExportingCsv(false);
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {exportingCsv ? "Exporting…" : "Export as CSV"}
            </button>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing || loading}
              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
              title="Clear all audit logs"
              aria-label="Clear all audit logs"
            >
              {clearing ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.map((l) => (
              <tr key={l.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">
                  <div className="font-medium text-slate-900">
                    {new Date(l.createdAt).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="font-medium text-slate-900">{formatActor(l.actor)}</div>
                  {l.actor ? (
                    <div className="mt-1 text-xs text-slate-500">{l.actor.email}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className={actionBadgeClass(l.action)}>{l.action}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">{l.entityType}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-600">
                  No logs to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Tip: logs are append-only; use filters to find activity quickly.
        </p>
        <button
          type="button"
          onClick={() => void onLoadMore()}
          disabled={!nextCursor || loadingMore}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : nextCursor ? "Load more" : "No more"}
        </button>
      </div>
    </div>
    </>
  );
}

