"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardStats = {
  totalSops: number;
  totalPolicies: number;
  totalDocuments: number;
  pendingApprovals: number;
  upcomingReviews: number;
  sopCounts?: { total: number; unpublished: number; published: number };
  policyCounts?: { total: number; unpublished: number; published: number };
  distribution: { id: string; name: string; count: number }[];
  recentPolicies: {
    id: string;
    serialNo: string;
    title: string;
    type: string;
    version: number;
    departmentName: string;
    updatedAt: string;
  }[];
};

type LogRow = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string | null;
  actor: { id: string; name: string; email: string; role: string } | null;
};

function formatTimeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return d.toLocaleDateString();
}

function actionDotClass(action: string) {
  switch (action) {
    case "LOGIN":
    case "LOGOUT":
      return "bg-blue-500";
    case "CREATE":
      return "bg-emerald-500";
    case "UPDATE":
    case "SOFT_DELETE":
    case "RESTORE":
    case "PUBLISH":
    case "UNPUBLISH":
    case "SUBMIT_FOR_APPROVAL":
    case "APPROVE":
    case "REJECT":
    case "ESCALATE":
      return "bg-amber-500";
    case "DELETE":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

function actionRowClass(action: string) {
  switch (action) {
    case "LOGIN":
    case "LOGOUT":
      return "bg-blue-50/60 hover:bg-blue-50";
    case "CREATE":
      return "bg-emerald-50/60 hover:bg-emerald-50";
    case "UPDATE":
    case "SOFT_DELETE":
    case "RESTORE":
    case "PUBLISH":
    case "UNPUBLISH":
    case "SUBMIT_FOR_APPROVAL":
    case "APPROVE":
    case "REJECT":
    case "ESCALATE":
      return "bg-amber-50/60 hover:bg-amber-50";
    case "DELETE":
      return "bg-red-50/60 hover:bg-red-50";
    default:
      return "hover:bg-slate-50";
  }
}

function actionLabel(action: string) {
  return action.toLowerCase().replace(/_/g, " ");
}

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [overviewTab, setOverviewTab] = useState<"SOP" | "POLICY">("SOP");

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setLogsLoading(true);

    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) setStats(data.data);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    fetch("/api/audit-logs?limit=10")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) setLogs(data.data.logs ?? []);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const sopCounts = stats?.sopCounts ?? { total: stats?.totalSops ?? 0, unpublished: 0, published: 0 };
  const policyCounts = stats?.policyCounts ?? { total: stats?.totalPolicies ?? 0, unpublished: 0, published: 0 };
  const activeCounts = overviewTab === "SOP" ? sopCounts : policyCounts;
  const distribution = stats?.distribution ?? [];
  const recentPolicies = stats?.recentPolicies ?? [];
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Overview</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome back! Here&apos;s what&apos;s happening in the SOP management portal today.
        </p>
      </div>

      {/* Overview type: classical underlined tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0" aria-label="Overview type">
          <button
            type="button"
            onClick={() => setOverviewTab("SOP")}
            className={
              "relative -mb-px border-b-2 px-5 py-3 text-sm font-medium transition-colors " +
              (overviewTab === "SOP"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700")
            }
          >
            SOP
          </button>
          <button
            type="button"
            onClick={() => setOverviewTab("POLICY")}
            className={
              "relative -mb-px border-b-2 px-5 py-3 text-sm font-medium transition-colors " +
              (overviewTab === "POLICY"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700")
            }
          >
            Policy
          </button>
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total {overviewTab === "SOP" ? "SOPs" : "Policies"}</p>
              <p className="text-2xl font-bold text-slate-900">{statsLoading ? "—" : activeCounts.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Unpublished</p>
              <p className="text-2xl font-bold text-slate-900">{statsLoading ? "—" : activeCounts.unpublished.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Published</p>
              <p className="text-2xl font-bold text-slate-900">{statsLoading ? "—" : activeCounts.published.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Updated + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Recently Updated Policies</h2>
            <Link href="/admin/sop" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Policy name</th>
                  <th className="px-5 py-3">Dept</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">Loading…</td>
                  </tr>
                ) : recentPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">No policies yet.</td>
                  </tr>
                ) : (
                  recentPolicies.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-900">{p.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">ID: {p.serialNo}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{p.departmentName}</td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-blue-600">v{p.version}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatTimeAgo(p.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">Activity Feed</h2>
          <ul className="max-h-[320px] overflow-y-auto">
            {logsLoading ? (
              <li className="px-5 py-3 text-sm text-slate-500">Loading…</li>
            ) : logs.length === 0 ? (
              <li className="px-5 py-6 text-center text-sm text-slate-500">No recent activity.</li>
            ) : (
              logs.map((l) => (
                <li key={l.id} className="border-b border-slate-100 last:border-0">
                  <Link href="/admin/logs" className={`block px-5 py-3 transition ${actionRowClass(l.action)}`}>
                    <div className="flex gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${actionDotClass(l.action)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900">
                          {l.actor ? l.actor.name : "System"} {actionLabel(l.action)} {l.entityType}
                          {l.entityTitle ? ` — ${l.entityTitle}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatTimeAgo(l.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* SOP Distribution + Review Reminders */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">
            SOP Distribution (By Department)
          </h2>
          <ul className="space-y-1 px-5 py-4">
            {statsLoading ? (
              <li className="text-sm text-slate-500">Loading…</li>
            ) : distribution.length === 0 ? (
              <li className="text-sm text-slate-500">No departments yet.</li>
            ) : (
              distribution.map((d) => (
                <li key={d.id} className="group">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-900">{d.name}</span>
                    <span className="text-slate-600">{d.count} SOPs</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(d.count / maxCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Review Reminders</h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-600">
              3–6 months out
            </span>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-sm text-slate-500">No review reminders in this window yet.</p>
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-500">
              When documents have review dates, they will appear here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
