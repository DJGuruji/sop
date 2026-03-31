"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toastSuccess } from "@/lib/app-toast";

export type SopListTab = "all" | "pending" | "approved";

type SopRow = {
  id: string;
  serialNo: string;
  title: string;
  status: string;
  currentVersion: number;
  isPublished: boolean;
  updatedAt: string;
  pendingApprovalRequestId: string | null;
  canSubmitForApproval: boolean;
  canActAsApprover: boolean;
  canRejectAsApprover: boolean;
  canEscalateToAdmin: boolean;
  canDeptEndorseSop: boolean;
  deptEndorsed: boolean;
  canDeleteUnpublished: boolean;
  canArchivePublished: boolean;
  canDownloadPdf: boolean;
};

type PolicyRow = {
  id: string;
  serialNo: string;
  title: string;
  status: string;
  currentVersion: number;
  isPublished: boolean;
  updatedAt: string;
};

function formatStatus(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PENDING_APPROVAL":
      return "Pending approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "ARCHIVED":
      return "Archived";
    default:
      return status.replaceAll("_", " ");
  }
}

type LoadedMeta = {
  department?: { id: string; name: string };
  subDepartment?: {
    id: string;
    name: string;
    departmentId: string;
    departmentName: string;
  };
};

type Props = {
  /** e.g. `/api/departments/:id/sops` or `/api/subdepartments/:id/documents` */
  listUrl: string;
  sopSectionTitle?: string;
  policiesTitle?: string;
  /** Breadcrumb / header info from the same API response */
  onLoaded?: (meta: LoadedMeta) => void;
};

export function SopDocumentsSection({
  listUrl,
  sopSectionTitle = "SOPs",
  policiesTitle = "Policies",
  onLoaded,
}: Props) {
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const [tab, setTab] = useState<SopListTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sops, setSops] = useState<SopRow[]>([]);
  const [showSopTabs, setShowSopTabs] = useState(false);
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [orgAdmins, setOrgAdmins] = useState<{ id: string; name: string; email: string }[]>([]);
  const [submitApprovers, setSubmitApprovers] = useState<{ id: string; name: string; email: string; role: string }[]>(
    [],
  );
  const [escalateTargetByDoc, setEscalateTargetByDoc] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiveForDocId, setArchiveForDocId] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [submitForApprovalDocId, setSubmitForApprovalDocId] = useState<string | null>(null);
  const [submitApproverId, setSubmitApproverId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tabQuery = tab === "pending" ? "pending" : tab === "approved" ? "approved" : "all";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${listUrl}?tab=${encodeURIComponent(tabQuery)}`);
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          sops?: SopRow[];
          showSopTabs?: boolean;
          policies?: PolicyRow[];
        };
        error?: { message?: string };
      };
      if (!res.ok || payload.success === false) {
        setError(payload.error?.message ?? "Unable to load documents.");
        return;
      }
      const d = payload.data;
      setSops(d?.sops ?? []);
      setShowSopTabs(d?.showSopTabs ?? false);
      if (d && "policies" in d && Array.isArray(d.policies)) {
        setPolicies(d.policies);
      } else {
        setPolicies(null);
      }
      if (d) {
        const meta: LoadedMeta = {};
        if ("department" in d && d.department) meta.department = d.department as LoadedMeta["department"];
        if ("subDepartment" in d && d.subDepartment) {
          meta.subDepartment = d.subDepartment as LoadedMeta["subDepartment"];
        }
        if (meta.department || meta.subDepartment) onLoadedRef.current?.(meta);
      }
    } finally {
      setLoading(false);
    }
  }, [listUrl, tabQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ success?: boolean; data?: { user?: { role?: string } } }>)
      .then((d) => {
        if (cancelled || !d.success || !d.data?.user?.role) return;
        setViewerRole(d.data.user.role);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewerRole !== "DEPARTMENT_ADMIN") return;
    let cancelled = false;
    Promise.all([
      fetch("/api/users/org-admins").then((r) => r.json()),
      fetch("/api/users/sop-submit-approvers").then((r) => r.json()),
    ])
      .then(([adminsRes, submitRes]) => {
        if (cancelled) return;
        const a = adminsRes as { success?: boolean; data?: { users?: { id: string; name: string; email: string }[] } };
        const s = submitRes as {
          success?: boolean;
          data?: { users?: { id: string; name: string; email: string; role: string }[] };
        };
        if (a.success && a.data?.users) setOrgAdmins(a.data.users);
        if (s.success && s.data?.users) setSubmitApprovers(s.data.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [viewerRole]);

  async function postJson(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string };
    };
    return { ok: res.ok && data.success !== false, message: data.error?.message ?? "Request failed" };
  }

  function openSendForApproval(docId: string) {
    setActionError(null);
    if (viewerRole === "DEPARTMENT_ADMIN") {
      setSubmitForApprovalDocId(docId);
      setSubmitApproverId(submitApprovers[0]?.id ?? "");
      setSubmitError(null);
      return;
    }
    void submitForApprovalDirect(docId, undefined, false);
  }

  useEffect(() => {
    if (!submitForApprovalDocId || submitApprovers.length === 0) return;
    setSubmitApproverId((current) => current || submitApprovers[0]!.id);
  }, [submitForApprovalDocId, submitApprovers]);

  async function submitForApprovalDirect(
    docId: string,
    approverUserId: string | undefined,
    fromModal: boolean,
  ) {
    setActionError(null);
    if (fromModal) setSubmitError(null);
    setBusyId(docId);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/submit-for-approval`, {
        method: "POST",
        headers:
          approverUserId !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          approverUserId !== undefined ? JSON.stringify({ approverUserId }) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || data.success === false) {
        const msg = data.error?.message ?? "Could not submit for approval.";
        if (fromModal) setSubmitError(msg);
        else setActionError(msg);
        return;
      }
      toastSuccess("Sent for approval.");
      setSubmitForApprovalDocId(null);
      setSubmitApproverId("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmSendForApproval() {
    if (!submitForApprovalDocId) return;
    const aid = submitApproverId.trim();
    if (!aid) {
      setSubmitError("Select an org Admin or Super Admin.");
      return;
    }
    await submitForApprovalDirect(submitForApprovalDocId, aid, true);
  }

  async function onApprove(requestId: string) {
    setActionError(null);
    setBusyId(requestId);
    try {
      const { ok, message } = await postJson(`/api/approval-requests/${encodeURIComponent(requestId)}/approve`);
      if (!ok) {
        setActionError(message);
        return;
      }
      toastSuccess("SOP approved.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmReject() {
    if (!rejectRequestId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError("Please enter a rejection reason.");
      return;
    }
    setRejectError(null);
    setBusyId(rejectRequestId);
    try {
      const { ok, message } = await postJson(
        `/api/approval-requests/${encodeURIComponent(rejectRequestId)}/reject`,
        { remarks: reason },
      );
      if (!ok) {
        setRejectError(message);
        return;
      }
      toastSuccess("SOP rejected.");
      setRejectRequestId(null);
      setRejectReason("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteSop(docId: string, title: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete SOP "${title}"? This cannot be undone.`)
    ) {
      return;
    }
    setActionError(null);
    setBusyId(`del:${docId}`);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || data.success === false) {
        setActionError(data.error?.message ?? "Could not delete SOP.");
        return;
      }
      toastSuccess("SOP deleted.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmArchive() {
    if (!archiveForDocId) return;
    const reason = archiveReason.trim();
    if (!reason) {
      setActionError("Please enter an archive reason.");
      return;
    }
    setActionError(null);
    setBusyId(`arc:${archiveForDocId}`);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(archiveForDocId)}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || data.success === false) {
        setActionError(data.error?.message ?? "Could not archive SOP.");
        return;
      }
      toastSuccess("SOP archived.");
      setArchiveForDocId(null);
      setArchiveReason("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onEscalate(docId: string, requestId: string) {
    const targetUserId = escalateTargetByDoc[docId] ?? orgAdmins[0]?.id;
    if (!targetUserId) {
      setActionError("Select an Admin to escalate to.");
      return;
    }
    setActionError(null);
    setBusyId(requestId);
    try {
      const { ok, message } = await postJson(`/api/approval-requests/${encodeURIComponent(requestId)}/escalate`, {
        targetUserId,
      });
      if (!ok) {
        setActionError(message);
        return;
      }
      toastSuccess("Sent to org Admin for approval.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onDeptEndorse(requestId: string) {
    setActionError(null);
    setBusyId(requestId);
    try {
      const { ok, message } = await postJson(
        `/api/approval-requests/${encodeURIComponent(requestId)}/dept-endorse`,
        {},
      );
      if (!ok) {
        setActionError(message);
        return;
      }
      toastSuccess("Recorded as approved by department.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {submitForApprovalDocId ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-approval-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 id="submit-approval-title" className="text-lg font-semibold text-slate-900">
              Send for approval
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose an org Admin or Super Admin. They will receive Approve and Reject actions for this SOP.
            </p>
            <label htmlFor="submit-approver-select" className="mt-4 mb-1 block text-sm font-medium text-slate-700">
              Approver (name — email)
            </label>
            <select
              id="submit-approver-select"
              value={submitApproverId}
              onChange={(e) => setSubmitApproverId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              {submitApprovers.length === 0 ? (
                <option value="">Loading approvers…</option>
              ) : (
                submitApprovers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                    {u.role === "SUPER_ADMIN" ? " (Super Admin)" : " (Admin)"}
                  </option>
                ))
              )}
            </select>
            {submitError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {submitError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitForApprovalDocId(null);
                  setSubmitApproverId("");
                  setSubmitError(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId !== null || submitApprovers.length === 0 || !submitApproverId}
                onClick={() => void onConfirmSendForApproval()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busyId === submitForApprovalDocId ? "Sending…" : "Send for approval"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectRequestId ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-sop-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 id="reject-sop-title" className="text-lg font-semibold text-slate-900">
              Reject SOP
            </h2>
            <p className="mt-2 text-sm text-slate-600">A reason is required and will be stored with this decision.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="Reason for rejection…"
            />
            {rejectError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {rejectError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectRequestId(null);
                  setRejectReason("");
                  setRejectError(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void onConfirmReject()}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {busyId === rejectRequestId ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {archiveForDocId ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-sop-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 id="archive-sop-title" className="text-lg font-semibold text-slate-900">
              Archive SOP
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This SOP is published. Archiving removes it from active lists. Please provide a reason.
            </p>
            <textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="Reason for archiving…"
            />
            {actionError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setArchiveForDocId(null);
                  setArchiveReason("");
                  setActionError(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void onConfirmArchive()}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {busyId?.startsWith("arc:") ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Documents</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{sopSectionTitle}</h2>
        </div>

      {actionError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      ) : null}

      {showSopTabs ? (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All SOPs
          </button>
          <button
            type="button"
            onClick={() => setTab("pending")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "pending" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Pending approval
          </button>
          <button
            type="button"
            onClick={() => setTab("approved")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "approved" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Approved
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">Loading SOPs…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : sops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
          {tab === "pending"
            ? "No SOPs pending approval."
            : tab === "approved"
              ? "No approved SOPs in this view."
              : "No SOPs yet."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Serial No</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sops.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.title}</td>
                  <td className="px-4 py-3 text-slate-600">{row.serialNo}</td>
                  <td className="px-4 py-3 text-slate-600">v{row.currentVersion}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatStatus(row.status)}
                    {row.isPublished ? " • Published" : ""}
                    {row.status === "PENDING_APPROVAL" && row.deptEndorsed ? (
                      <span className="mt-0.5 block text-xs font-medium text-emerald-700">
                        Approved by department — forward to org Admin
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-2">
                      {row.canSubmitForApproval ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => openSendForApproval(row.id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {busyId === row.id ? "…" : "Send for approval"}
                        </button>
                      ) : null}
                      {row.pendingApprovalRequestId &&
                      (row.canActAsApprover ||
                        row.canRejectAsApprover ||
                        row.canEscalateToAdmin ||
                        row.canDeptEndorseSop) ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {row.canDeptEndorseSop ? (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => void onDeptEndorse(row.pendingApprovalRequestId!)}
                              className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Approved by department
                            </button>
                          ) : null}
                          {row.canActAsApprover ? (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => void onApprove(row.pendingApprovalRequestId!)}
                              className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          ) : null}
                          {row.canRejectAsApprover ? (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => {
                                setRejectRequestId(row.pendingApprovalRequestId!);
                                setRejectReason("");
                                setRejectError(null);
                              }}
                              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          ) : null}
                          {row.canEscalateToAdmin ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={escalateTargetByDoc[row.id] ?? orgAdmins[0]?.id ?? ""}
                                onChange={(e) =>
                                  setEscalateTargetByDoc((prev) => ({ ...prev, [row.id]: e.target.value }))
                                }
                                className="max-w-[10rem] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                              >
                                {orgAdmins.length === 0 ? (
                                  <option value="">No Admins</option>
                                ) : (
                                  orgAdmins.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))
                                )}
                              </select>
                              <button
                                type="button"
                                disabled={busyId !== null || orgAdmins.length === 0}
                                onClick={() => void onEscalate(row.id, row.pendingApprovalRequestId!)}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              >
                                Send to org Admin
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {row.canDownloadPdf ? (
                          <a
                            href={`/api/documents/${encodeURIComponent(row.id)}/download-pdf`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download PDF
                          </a>
                        ) : null}
                        {row.canDeleteUnpublished ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            title="Delete SOP"
                            onClick={() => void onDeleteSop(row.id, row.title)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          >
                            <span className="sr-only">Delete</span>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                              />
                            </svg>
                          </button>
                        ) : null}
                        {row.canArchivePublished ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            title="Archive SOP"
                            onClick={() => {
                              setArchiveForDocId(row.id);
                              setArchiveReason("");
                              setActionError(null);
                            }}
                            className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                          >
                            <span className="sr-only">Archive</span>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m20.25 7.5-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </div>

      {policies != null ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Documents</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{policiesTitle}</h2>
          </div>
          {policies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
              No policies mapped to this sub-department.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Serial No</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {policies.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                      <td className="px-4 py-3 text-slate-600">{item.serialNo}</td>
                      <td className="px-4 py-3 text-slate-600">v{item.currentVersion}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatStatus(item.status)}
                        {item.isPublished ? " • Published" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
