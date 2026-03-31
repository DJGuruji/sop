"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDeleteModal } from "@/components/admin/confirm-delete-modal";

type Department = { id: string; name: string };
type SubDepartment = { id: string; name: string; departmentId: string; departmentName: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  adminDepartmentIds?: string[];
  adminDepartmentNames?: string[];
  subDepartmentId: string | null;
  subDepartmentName: string | null;
  createdAt: string;
};

type ApiResponse =
  | {
      success: true;
      data: {
        users?: UserRow[];
        total?: number;
        departments?: Department[];
        subDepartments?: SubDepartment[];
      };
      message?: string;
    }
  | { success: false; error: { code: string; message: string } };

const PAGE_SIZE = 10;

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("EMPLOYEE");
  const [editDepartmentId, setEditDepartmentId] = useState<string>("");
  const [editAdminDepartmentIds, setEditAdminDepartmentIds] = useState<string[]>([]);
  const [editAdminDepartmentDraftId, setEditAdminDepartmentDraftId] = useState<string>("");
  const [editSubDepartmentId, setEditSubDepartmentId] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [adminDepartmentIds, setAdminDepartmentIds] = useState<string[]>([]);
  const [adminDepartmentDraftId, setAdminDepartmentDraftId] = useState<string>("");
  const [subDepartmentId, setSubDepartmentId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  const isDeptAdminViewer = viewerRole === "DEPARTMENT_ADMIN";

  const showDepartmentForRole = Boolean(role);
  const isCreateAdminRole = role === "ADMIN";
  const showSubDepartmentForRole = role === "SUPERVISOR" || role === "EMPLOYEE";

  const filteredSubDepartments = useMemo(
    () => subDepartments.filter((s) => s.departmentId === departmentId),
    [subDepartments, departmentId],
  );
  const availableAdminDepartments = useMemo(
    () => departments.filter((d) => !adminDepartmentIds.includes(d.id)),
    [departments, adminDepartmentIds],
  );
  const availableEditAdminDepartments = useMemo(
    () => departments.filter((d) => !editAdminDepartmentIds.includes(d.id)),
    [departments, editAdminDepartmentIds],
  );

  const createValidationError = useMemo((): string | null => {
    if (name.trim().length < 2) return "Name must be at least 2 characters.";
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!role) return "Please select a role.";
    if (isCreateAdminRole && adminDepartmentIds.length === 0) return "Please select at least one department.";
    if (showDepartmentForRole && !isCreateAdminRole && !departmentId) return "Please select a department.";
    return null;
  }, [name, email, password, role, departmentId, adminDepartmentIds, isCreateAdminRole, showDepartmentForRole]);

  const canCreate = !createValidationError;

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/users", window.location.origin);
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String((page - 1) * PAGE_SIZE));
      if (searchDebounced.trim()) url.searchParams.set("search", searchDebounced.trim());
      const uRes = await fetch(url.toString(), { method: "GET" });
      const uData = (await uRes.json().catch(() => ({}))) as ApiResponse;
      if (!uRes.ok || uData.success === false) {
        const message = uData.success === false && uData.error?.message ? uData.error.message : "Unable to load users.";
        return setError(message);
      }
      setUsers(uData.data.users ?? []);
      setTotal(uData.data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    const [dRes, sRes] = await Promise.all([
      fetch("/api/departments?limit=100", { method: "GET" }),
      fetch("/api/subdepartments?limit=100", { method: "GET" }),
    ]);
    const dData = (await dRes.json().catch(() => ({}))) as ApiResponse;
    const sData = (await sRes.json().catch(() => ({}))) as ApiResponse;
    if (dData.success && dData.data.departments) {
      setDepartments(dData.data.departments);
      setDepartmentId((prev) => prev || (dData.data.departments?.[0]?.id ?? ""));
    }
    if (sData.success && sData.data.subDepartments) setSubDepartments(sData.data.subDepartments);
  }

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ success?: boolean; data?: { user?: { role?: string } } }>)
      .then((d) => {
        if (!cancelled && d.success && d.data?.user?.role) setViewerRole(d.data.user.role);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  useEffect(() => {
    void loadUsers();
  }, [page, searchDebounced]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateFormError(null);
    if (!canCreate) {
      setCreateFormError(createValidationError ?? "Please fix the errors below.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          departmentId: showDepartmentForRole && !isCreateAdminRole ? (departmentId || null) : null,
          adminDepartmentIds: isCreateAdminRole ? adminDepartmentIds : [],
          subDepartmentId: showSubDepartmentForRole ? (subDepartmentId || null) : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        const msg = data.success === false && data.error?.message ? data.error.message : "Unable to create user. Check role and department scope.";
        setCreateFormError(msg);
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("EMPLOYEE");
      setDepartmentId(departments[0]?.id ?? "");
      setAdminDepartmentIds([]);
      setAdminDepartmentDraftId("");
      setSubDepartmentId("");
      setCreateFormError(null);
      setShowCreate(false);
      setPage(1);
      await loadUsers();
    } finally {
      setCreating(false);
    }
  }

  function addAdminDepartment() {
    if (!adminDepartmentDraftId) return;
    setAdminDepartmentIds((prev) => (prev.includes(adminDepartmentDraftId) ? prev : [...prev, adminDepartmentDraftId]));
    setAdminDepartmentDraftId("");
  }

  async function toggleActive(id: string, isActive: boolean) {
    setError(null);
    const res = await fetch(`/api/users/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok || data.success === false) {
      setError("Unable to update user status.");
      return;
    }
    await loadUsers();
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditRole(u.role);
    setEditDepartmentId(u.departmentId ?? "");
    setEditAdminDepartmentIds(u.adminDepartmentIds ?? (u.departmentId ? [u.departmentId] : []));
    setEditAdminDepartmentDraftId("");
    setEditSubDepartmentId(u.subDepartmentId ?? "");
  }

  function removeAdminDepartment(id: string) {
    setAdminDepartmentIds((prev) => prev.filter((departmentId) => departmentId !== id));
  }

  function addEditAdminDepartment() {
    if (!editAdminDepartmentDraftId) return;
    setEditAdminDepartmentIds((prev) =>
      prev.includes(editAdminDepartmentDraftId) ? prev : [...prev, editAdminDepartmentDraftId],
    );
    setEditAdminDepartmentDraftId("");
  }

  function removeEditAdminDepartment(id: string) {
    setEditAdminDepartmentIds((prev) => prev.filter((departmentId) => departmentId !== id));
  }

  const showEditDepartment = Boolean(editRole);
  const isEditAdminRole = editRole === "ADMIN";
  const showEditSubDepartment = editRole === "SUPERVISOR" || editRole === "EMPLOYEE";

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditFormError(null);
    if (editName.trim().length < 2) {
      setEditFormError("Name must be at least 2 characters.");
      return;
    }
    if (!editEmail.trim()) {
      setEditFormError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setEditFormError("Enter a valid email address.");
      return;
    }
    const pwd = editPassword.trim();
    if (pwd.length > 0 && pwd.length < 8) {
      setEditFormError("New password must be at least 8 characters, or leave blank to keep the current password.");
      return;
    }
    if (isEditAdminRole && editAdminDepartmentIds.length === 0) {
      setEditFormError("Please select at least one department.");
      return;
    }
    if (showEditDepartment && !isEditAdminRole && !editDepartmentId) {
      setEditFormError("Please select a department.");
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const credentialFields = {
        email: editEmail.trim(),
        ...(pwd ? { password: pwd } : {}),
      };
      const payload = isDeptAdminViewer
        ? {
            name: editName.trim(),
            ...credentialFields,
            ...(showEditDepartment && !isEditAdminRole ? { departmentId: editDepartmentId || null } : {}),
            ...(isEditAdminRole ? { adminDepartmentIds: editAdminDepartmentIds } : {}),
            ...(showEditSubDepartment ? { subDepartmentId: editSubDepartmentId || null } : {}),
          }
        : {
            name: editName.trim(),
            ...credentialFields,
            role: editRole,
            departmentId: showEditDepartment && !isEditAdminRole ? (editDepartmentId || null) : null,
            adminDepartmentIds: isEditAdminRole ? editAdminDepartmentIds : [],
            subDepartmentId: showEditSubDepartment ? (editSubDepartmentId || null) : null,
          };
      const res = await fetch(`/api/users/${encodeURIComponent(editing.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        setEditFormError(data.success === false && data.error?.message ? data.error.message : "Unable to update user.");
        return;
      }
      setEditing(null);
      setEditFormError(null);
      await loadUsers();
    } finally {
      setSavingEdit(false);
    }
  }

  function openDeleteUserModal(u: UserRow) {
    setDeleteTarget(u);
  }

  async function onConfirmDeleteUser() {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || data.success === false) {
        setError(data.success === false ? data.error.message : "Unable to delete user.");
        return;
      }
      setDeleteTarget(null);
      await loadUsers();
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete user"
        message={deleteTarget ? `Delete user "${deleteTarget.name}" (${deleteTarget.email})?\n\nThis will remove the user and cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={onConfirmDeleteUser}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Access</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and manage users within your allowed scope.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          type="search"
          placeholder="Search by name, email, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:max-w-xs"
        />
       <div className="flex items-center gap-3">
       <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          {loading ? "Loading…" : `${start}–${end} of ${total}`}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create user
        </button>
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
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div>{u.role}</div>
                  {u.role === "ADMIN" && (u.adminDepartmentNames?.length ?? 0) > 0 ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {u.adminDepartmentNames?.join(", ")}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      u.isActive
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void toggleActive(u.id, !u.isActive)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  {!isDeptAdminViewer ? (
                    <button
                      type="button"
                      onClick={() => openDeleteUserModal(u)}
                      className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-600">
                  No users found.
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

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Create user</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Add a new user. Fields depend on the selected role.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateFormError(null); }}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={onCreate} className="p-6 space-y-5">
              {createFormError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {createFormError}
                </div>
              ) : null}

              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Account details</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@iiclakshya.com"
                      type="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                  />
                  <p className="mt-1 text-xs text-slate-500">Minimum 8 characters required.</p>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Role & scope</p>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    value={role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setRole(newRole);
                      if (newRole === "ADMIN") {
                        setAdminDepartmentIds((prev) => prev.length ? prev : (departmentId ? [departmentId] : []));
                        setAdminDepartmentDraftId("");
                        setDepartmentId("");
                        setSubDepartmentId("");
                      } else if (newRole === "SUPER_ADMIN") {
                        setAdminDepartmentIds([]);
                        setAdminDepartmentDraftId("");
                        setDepartmentId("");
                        setSubDepartmentId("");
                      } else if (newRole === "DEPARTMENT_ADMIN") {
                        setAdminDepartmentIds([]);
                        setAdminDepartmentDraftId("");
                        setSubDepartmentId("");
                      } else {
                        setAdminDepartmentIds([]);
                        setAdminDepartmentDraftId("");
                      }
                    }}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="DEPARTMENT_ADMIN">Department Admin</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {showDepartmentForRole ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Department {isCreateAdminRole ? "(select one or more)" : "(required)"}
                    </label>
                    {isCreateAdminRole ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <select
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={adminDepartmentDraftId}
                            onChange={(e) => setAdminDepartmentDraftId(e.target.value)}
                          >
                            <option value="">Select department</option>
                            {availableAdminDepartments.map((d) => (
                              <option value={d.id} key={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addAdminDepartment}
                            disabled={!adminDepartmentDraftId}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {adminDepartmentIds.length === 0 ? (
                            <p className="text-sm text-slate-500">No departments added yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {adminDepartmentIds.map((id) => {
                                const dept = departments.find((d) => d.id === id);
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                                  >
                                    {dept?.name ?? "Department"}
                                    <button
                                      type="button"
                                      onClick={() => removeAdminDepartment(id)}
                                      className="text-slate-500 hover:text-slate-900"
                                      aria-label={`Remove ${dept?.name ?? "department"}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <select
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          value={departmentId}
                          onChange={(e) => {
                            setDepartmentId(e.target.value);
                            setSubDepartmentId("");
                          }}
                        >
                          <option value="">Select department</option>
                          {departments.map((d) => (
                            <option value={d.id} key={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        {!departmentId && showDepartmentForRole ? (
                          <p className="mt-1 text-xs text-amber-600">Please select a department.</p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                {showSubDepartmentForRole ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Sub-department (optional)</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                      value={subDepartmentId}
                      onChange={(e) => setSubDepartmentId(e.target.value)}
                      disabled={!departmentId}
                    >
                      <option value="">None</option>
                      {filteredSubDepartments.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {!departmentId ? (
                      <p className="mt-1 text-xs text-slate-500">Select a department first to see sub-departments.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateFormError(null); }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canCreate || creating}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Edit user</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Update profile and scope. Fields depend on role.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setEditFormError(null);
                    setEditPassword("");
                  }}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={onSaveEdit} className="p-6 space-y-5">
              {editFormError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editFormError}
                </div>
              ) : null}

              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Account details</p>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="user@example.com"
                      type="email"
                      autoComplete="off"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Leave blank to keep current password"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Optional. If set, must be at least 8 characters.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Role & scope</p>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
                  {isDeptAdminViewer ? (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800">
                      {editRole.replaceAll("_", " ")}
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        Department admins cannot change user roles.
                      </span>
                    </p>
                  ) : (
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={editRole}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setEditRole(newRole);
                        if (newRole === "ADMIN") {
                          setEditAdminDepartmentIds((prev) => prev.length ? prev : (editDepartmentId ? [editDepartmentId] : []));
                          setEditAdminDepartmentDraftId("");
                          setEditDepartmentId("");
                          setEditSubDepartmentId("");
                        } else if (newRole === "SUPER_ADMIN") {
                          setEditAdminDepartmentIds([]);
                          setEditAdminDepartmentDraftId("");
                          setEditDepartmentId("");
                          setEditSubDepartmentId("");
                        } else if (newRole === "DEPARTMENT_ADMIN") {
                          setEditAdminDepartmentIds([]);
                          setEditAdminDepartmentDraftId("");
                          setEditSubDepartmentId("");
                        } else {
                          setEditAdminDepartmentIds([]);
                          setEditAdminDepartmentDraftId("");
                        }
                      }}
                    >
                      <option value="EMPLOYEE">Employee</option>
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="DEPARTMENT_ADMIN">Department Admin</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  )}
                </div>

                {showEditDepartment ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Department {isEditAdminRole ? "(select one or more)" : "(required)"}
                    </label>
                    {isEditAdminRole ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <select
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={editAdminDepartmentDraftId}
                            onChange={(e) => setEditAdminDepartmentDraftId(e.target.value)}
                          >
                            <option value="">Select department</option>
                            {availableEditAdminDepartments.map((d) => (
                              <option value={d.id} key={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addEditAdminDepartment}
                            disabled={!editAdminDepartmentDraftId}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {editAdminDepartmentIds.length === 0 ? (
                            <p className="text-sm text-slate-500">No departments added yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {editAdminDepartmentIds.map((id) => {
                                const dept = departments.find((d) => d.id === id);
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                                  >
                                    {dept?.name ?? "Department"}
                                    <button
                                      type="button"
                                      onClick={() => removeEditAdminDepartment(id)}
                                      className="text-slate-500 hover:text-slate-900"
                                      aria-label={`Remove ${dept?.name ?? "department"}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <select
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        value={editDepartmentId}
                        onChange={(e) => {
                          setEditDepartmentId(e.target.value);
                          setEditSubDepartmentId("");
                        }}
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option value={d.id} key={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : null}

                {showEditSubDepartment ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Sub-department (optional)</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                      value={editSubDepartmentId}
                      onChange={(e) => setEditSubDepartmentId(e.target.value)}
                      disabled={!editDepartmentId}
                    >
                      <option value="">None</option>
                      {subDepartments
                        .filter((s) => s.departmentId === editDepartmentId)
                        .map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setEditFormError(null);
                    setEditPassword("");
                  }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    savingEdit ||
                    editName.trim().length < 2 ||
                    !editEmail.trim() ||
                    (isEditAdminRole ? editAdminDepartmentIds.length === 0 : showEditDepartment && !editDepartmentId)
                  }
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}

