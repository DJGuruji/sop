"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/admin/confirm-delete-modal";

type Department = {
  id: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
  subDepartments?: { id: string; name: string }[];
};

type ApiResponse =
  | {
      success: true;
      data: {
        departments?: Department[];
        total?: number;
        department?: Department;
      };
      message?: string;
    }
  | { success: false; error: { code: string; message: string } };

const PAGE_SIZE = 10;

export default function DepartmentsListClient() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const canCreate = useMemo(() => {
    return name.trim().length >= 2;
  }, [name]);

  const prevSearchDebounced = useRef(searchDebounced);

  async function load(overridePage?: number) {
    const p = overridePage ?? page;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/departments", window.location.origin);
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String((p - 1) * PAGE_SIZE));
      if (searchDebounced.trim()) url.searchParams.set("search", searchDebounced.trim());
      const res = await fetch(url.toString(), { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        setError("Unable to load departments.");
        return;
      }
      setDepartments(data.data.departments ?? []);
      setTotal(data.data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  useEffect(() => {
    const usePageOne = searchDebounced !== prevSearchDebounced.current;
    if (usePageOne) prevSearchDebounced.current = searchDebounced;
    void load(usePageOne ? 1 : undefined);
  }, [page, searchDebounced]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        setError(data.success === false ? data.error.message : "Unable to create department.");
        return;
      }
      setName("");
      setShowCreateModal(false);
      setPage(1);
      await load();
    } finally {
      setCreating(false);
    }
  }

  function openDeleteModal(d: Department) {
    setDeleteTarget(d);
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        setError("Unable to delete department.");
        return;
      }
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(d: Department) {
    setEditing(d);
    setEditName(d.name);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(editing.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        setError("Unable to update department.");
        return;
      }
      setEditing(null);
      await load();
    } finally {
      setSavingEdit(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Organization</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Departments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage departments that scope SOPs, policies, and users.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search by department or sub-department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 sm:w-56"
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {loading ? "Loading…" : `${start}–${end} of ${total}`}
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create department
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/admin/departments/${d.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/admin/departments/${d.id}`);
              }
            }}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            <div className="flex flex-1 flex-col">
              <p className="font-semibold text-slate-900">{d.name}</p>
              <p className="mt-1 text-sm text-slate-600">
                {d.subDepartments?.length
                  ? d.subDepartments.map((sub) => sub.name).join(", ")
                  : "No sub-departments"}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openEdit(d)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Edit"
                aria-label="Edit department"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => router.push(`/admin/departments/${d.id}/subdepartments`)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Sub department"
                aria-label="Sub department"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
                <span className="text-xs font-medium">Sub department</span>
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(d)}
                className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                title="Delete"
                aria-label="Delete department"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        ))}
        {departments.length === 0 && !loading ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-slate-600">
            No departments yet.
          </div>
        ) : null}
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

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete department"
        message={deleteTarget ? `Delete department "${deleteTarget.name}"?\n\nThis will soft-delete the department and hide it from lists.` : ""}
        confirmLabel="Delete"
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create department</h2>
                <p className="mt-1 text-sm text-slate-600">Add a new department. Department Admin can be mapped later from User Management.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Department name</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Operations"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!canCreate || creating}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit department</h2>
                <p className="mt-1 text-sm text-slate-600">Update department name.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={onSaveEdit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingEdit || editName.trim().length < 2}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
