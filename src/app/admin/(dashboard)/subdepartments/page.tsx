"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Department = { id: string; name: string };

type ApiResponse =
  | { success: true; data: { departments?: Department[]; total?: number }; message?: string }
  | { success: false; error: { code: string; message: string } };

const PAGE_SIZE = 10;

export default function SubDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = new URL("/api/departments", window.location.origin);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String((page - 1) * PAGE_SIZE));
    if (searchDebounced.trim()) url.searchParams.set("search", searchDebounced.trim());
    fetch(url.toString(), { method: "GET" })
      .then((res) => res.json().catch(() => ({})) as Promise<ApiResponse>)
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.data.departments) {
          setDepartments(data.data.departments);
          setTotal(data.data.total ?? 0);
        } else {
          setError("Unable to load departments.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load departments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, searchDebounced]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Organization</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Sub-departments
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Click a department to view and manage its sub-departments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search departments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 sm:w-56"
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {loading ? "Loading…" : `${start}–${end} of ${total}`}
          </div>
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
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {departments.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{d.name}</div>
                  <div className="text-xs text-slate-500">{d.id}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/departments/${d.id}/subdepartments`}
                    className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    View sub-departments
                  </Link>
                </td>
              </tr>
            ))}
            {departments.length === 0 && !loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-slate-600">
                  No departments yet. Create a department first from the Departments page.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
