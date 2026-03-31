"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toastSuccess } from "@/lib/app-toast";
import { ConfirmActionModal } from "@/components/admin/confirm-action-modal";
import { SopLibraryViewEditModal } from "./sop-library-view-edit-modal";
import { SopVersionHistoryModal } from "./sop-version-history-modal";

export type ManagedSopLibraryItem = {
  id: string;
  serialNo: string;
  title: string;
  status: string;
  isPublished: boolean;
  hasEverBeenPublished: boolean;
  displayContext?: "published" | "draft"; // Context for which tab this item is being displayed in
  currentVersion: number;
  departmentId: string;
  departmentName: string;
  subDepartmentId: string | null;
  subDepartmentName: string | null;
  versionLabel: string;
  effectiveDate: string;
  sourceFileName: string;
  sourceFileUrl: string | null;
  sourceFormat: string;
  fileKind: string;
  editableHtml: string;
  extractedText: string;
  sections: { id: string; title: string; bodyHtml: string }[];
  preparedBy: string;
  approvedBy: string;
  contentDepartmentName: string;
  updatedAt: string;
  formData: any;
  pendingApprovalRequesterName?: string | null;
  pendingApprovalRequesterEmail?: string | null;
};

type DepartmentScope = {
  id: string;
  name: string;
  subDepartments: { id: string; name: string }[];
};

type Props = {
  items: ManagedSopLibraryItem[];
  departments: DepartmentScope[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  pageParam?: string;
  isSupervisor?: boolean;
  isDeptAdmin?: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
};

type ModalMode = "view" | "edit" | "publish" | "history" | "versionView" | null;

function formatStatus(status: string, isPublished: boolean): string {
  const text = status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  return isPublished ? `${text} / Published` : text;
}

function getPublishActionLabel(item: ManagedSopLibraryItem): "Publish" | "Republish" {
  return item.isPublished || item.hasEverBeenPublished ? "Republish" : "Publish";
}

export function SopLibraryManager({ 
  items, 
  departments, 
  pagination, 
  pageParam = "page",
  isSupervisor = false,
  isDeptAdmin = false,
  isAdmin = false,
  isSuperAdmin = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<ModalMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedVersionLabel, setSelectedVersionLabel] = useState<string>("");
  const [versionViewItem, setVersionViewItem] = useState<ManagedSopLibraryItem | null>(null);
  const [sendApprovalTarget, setSendApprovalTarget] = useState<ManagedSopLibraryItem | null>(null);
  const [sendApprovalError, setSendApprovalError] = useState<string | null>(null);
  const [sendApprovalBusy, setSendApprovalBusy] = useState(false);

  const [departmentId, setDepartmentId] = useState("");
  const [subDepartmentId, setSubDepartmentId] = useState("");

  const activeItem = useMemo(() => items.find((item) => item.id === activeId) ?? null, [items, activeId]);
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === departmentId) ?? null,
    [departments, departmentId],
  );
  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  function openModal(nextMode: Exclude<ModalMode, null>, item: ManagedSopLibraryItem) {
    setActiveId(item.id);
    setMode(nextMode);
    setError(null);
    setDepartmentId(item.departmentId);
    setSubDepartmentId(item.subDepartmentId ?? "");
  }

  function closeModal() {
    setMode(null);
    setActiveId(null);
    setError(null);
    setBusy(false);
    setSelectedVersionId(null);
    setSelectedVersionLabel("");
    setVersionViewItem(null);
  }

  async function handleViewVersion(versionId: string, versionLabel: string) {
    if (!activeItem) return;
    setSelectedVersionId(versionId);
    setSelectedVersionLabel(versionLabel);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sop/library-items/${encodeURIComponent(activeItem.id)}/versions/${encodeURIComponent(versionId)}`,
      );
      const data = (await res.json().catch(() => ({}))) as
        | { success: true; data: { version: any } }
        | { success: false; error: { message?: string } };

      if (!res.ok || (data as any).success === false) {
        setError((data as any).error?.message ?? "Failed to load version.");
        setBusy(false);
        return;
      }

      const v = (data as any).data?.version;
      if (!v) {
        setError("Failed to load version.");
        setBusy(false);
        return;
      }

      // Build a ManagedSopLibraryItem-like object so we can reuse SopLibraryViewEditModal UI.
      const versionItem: ManagedSopLibraryItem = {
        ...activeItem,
        title: v.title ?? activeItem.title,
        versionLabel: v.versionLabel ?? versionLabel,
        effectiveDate: v.effectiveDate ?? activeItem.effectiveDate,
        contentDepartmentName: v.department ?? activeItem.contentDepartmentName,
        preparedBy: v.preparedBy ?? activeItem.preparedBy,
        approvedBy: v.approvedBy ?? activeItem.approvedBy,
        editableHtml: v.editableHtml ?? activeItem.editableHtml,
        extractedText: v.extractedText ?? activeItem.extractedText,
        sections: Array.isArray(v.sections) ? v.sections : activeItem.sections,
        formData: activeItem.formData, // keep existing formData shape if needed
      };

      setVersionViewItem(versionItem);
      setMode("versionView");
    } finally {
      setBusy(false);
    }
  }

  function handleBackToHistory() {
    setSelectedVersionId(null);
    setSelectedVersionLabel("");
    setMode("history");
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) {
      params.delete(pageParam);
    } else {
      params.set(pageParam, String(nextPage));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function handlePublish() {
    if (!activeItem || !departmentId) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/sop/library-items/${encodeURIComponent(activeItem.id)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentId,
        subDepartmentId: subDepartmentId || null,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || data.success === false) {
      setError(data.error?.message ?? "Failed to publish SOP.");
      setBusy(false);
      return;
    }

    toastSuccess("SOP published.");
    closeModal();
    router.refresh();
  }

  async function handleDelete(item: ManagedSopLibraryItem) {
    if (typeof window !== "undefined" && !window.confirm(`Delete SOP "${item.title}" permanently?`)) {
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sop/library-items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || data.success === false) {
      setError(data.error?.message ?? "Failed to delete SOP.");
      setBusy(false);
      return;
    }

    toastSuccess("SOP deleted.");
    closeModal();
    router.refresh();
  }

  function openSendApprovalModal(item: ManagedSopLibraryItem) {
    setSendApprovalError(null);
    setSendApprovalTarget(item);
  }

  function closeSendApprovalModal() {
    if (sendApprovalBusy) return;
    setSendApprovalTarget(null);
    setSendApprovalError(null);
  }

  async function confirmSendForApproval() {
    if (!sendApprovalTarget) return;
    setSendApprovalBusy(true);
    setSendApprovalError(null);
    const res = await fetch(
      `/api/sop/library-items/${encodeURIComponent(sendApprovalTarget.id)}/send-for-approval`,
      { method: "POST" },
    );
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || data.success === false) {
      setSendApprovalError(data.error?.message ?? "Failed to send SOP for approval.");
      setSendApprovalBusy(false);
      return;
    }

    toastSuccess("SOP sent for approval successfully.");
    setSendApprovalTarget(null);
    setSendApprovalBusy(false);
    closeModal();
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-sm text-slate-600">
        No uploaded SOPs found. You can add new documents using the "Upload SOP" button above.
      </section>
    );
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {pagination.total === 0
              ? "No SOPs found."
              : `Showing ${pageStart}-${pageEnd} of ${pagination.total} uploaded SOPs`}
          </p>
          {pagination.totalPages > 1 ? <p className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages}</p> : null}
        </div>

        {error && mode == null ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">{item.serialNo}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {item.departmentName}
                  {item.subDepartmentName ? ` / ${item.subDepartmentName}` : ""}
                </p>
                {(isDeptAdmin || isAdmin || isSuperAdmin) &&
                item.status === "PENDING_APPROVAL" &&
                item.pendingApprovalRequesterName ? (
                  <p className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Requester:</span>{" "}
                    {item.pendingApprovalRequesterName}
                    {item.pendingApprovalRequesterEmail ? (
                      <span className="text-slate-500"> · {item.pendingApprovalRequesterEmail}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openModal("view", item)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  View
                </button>
                
                {/* History Button - only show for published SOPs or SOPs that have been published */}
                {(item.isPublished || item.hasEverBeenPublished) && (
                  <button
                    type="button"
                    onClick={() => openModal("history", item)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    History
                  </button>
                )}
                {/* Edit Button - show in both published and draft contexts */}
                {((!isSupervisor || item.status === "DRAFT") || item.isPublished) && 
                 item.status !== "REJECTED" && 
                 !(isDeptAdmin && item.status === "PENDING_ADMIN_APPROVAL") ? (
                  <button
                    type="button"
                    onClick={() => openModal("edit", item)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                ) : null}
                
                {/* Send for Approval Button - only show in draft context */}
                {item.displayContext !== "published" && 
                 (isSupervisor || isDeptAdmin) && item.status === 'DRAFT' ? (
                  <button
                    type="button"
                    disabled={busy || sendApprovalBusy}
                    onClick={() => openSendApprovalModal(item)}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Send for Approval
                  </button>
                ) : null}

                {/* Republish Button for Dept Admin (for edited published SOPs) - only show in draft context */}
                {item.displayContext !== "published" && 
                 isDeptAdmin && item.status === 'DRAFT' && item.hasEverBeenPublished ? (
                  <button
                    type="button"
                    onClick={() => openModal("publish", item)}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Republish
                  </button>
                ) : null}

                {/* Publish Button (Admins, Super Admin can publish; Dept Admin can publish non-pending-admin SOPs) - only show in draft context */}
                {item.displayContext !== "published" && 
                 (!isSupervisor && 
                 (item.status === 'DRAFT' || item.status === 'PENDING_DEPT_ADMIN_APPROVAL' || item.status === 'PENDING_ADMIN_APPROVAL' || item.isPublished) &&
                 !(isDeptAdmin && item.status === "PENDING_ADMIN_APPROVAL") &&
                 !(isDeptAdmin && item.status === 'DRAFT' && item.hasEverBeenPublished)) ? (
                  <button
                    type="button"
                    onClick={() => openModal("publish", item)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    {getPublishActionLabel(item)}
                  </button>
                ) : null}

                <a
                  href={`/api/documents/${encodeURIComponent(item.id)}/download-pdf`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </a>
                {/* Delete Button - only show in draft context */}
                {item.displayContext !== "published" && 
                 (!isSupervisor || item.status === "DRAFT") && 
                 item.status !== "REJECTED" && 
                 !(isDeptAdmin && item.status === "PENDING_ADMIN_APPROVAL") ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
                <p className="mt-1 text-sm text-slate-800">{formatStatus(item.status, item.isPublished)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Version</p>
                <p className="mt-1 text-sm text-slate-800">
                  {item.versionLabel}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Source</p>
                <p className="mt-1 text-sm text-slate-800">
                  {item.sourceFileName} / {item.sourceFormat}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Effective Date</p>
                <p className="mt-1 text-sm text-slate-800">{item.effectiveDate || "-"}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1 || busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {activeItem && mode === "publish" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SOP Management</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{activeItem.title}</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="publish-department" className="mb-1 block text-sm font-medium text-slate-700">
                      Department
                    </label>
                    <select
                      id="publish-department"
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(e.target.value);
                        setSubDepartmentId("");
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                    >
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="publish-subdepartment" className="mb-1 block text-sm font-medium text-slate-700">
                      Sub-department
                    </label>
                    <select
                      id="publish-subdepartment"
                      value={subDepartmentId}
                      onChange={(e) => setSubDepartmentId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                    >
                      <option value="">None</option>
                      {(selectedDepartment?.subDepartments ?? []).map((subDepartment) => (
                        <option key={subDepartment.id} value={subDepartment.id}>
                          {subDepartment.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  Publishing marks this SOP as active for the selected department and keeps the uploaded source file attached.
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePublish()}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {busy ? "Publishing..." : `${getPublishActionLabel(activeItem)} SOP`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={sendApprovalTarget !== null}
        title="Send for approval"
        message={
          sendApprovalTarget
            ? `Submit “${sendApprovalTarget.title}” (${sendApprovalTarget.serialNo}) to your department admin for review? You can still view the document after submitting.`
            : ""
        }
        confirmLabel="Send for approval"
        variant="primary"
        loading={sendApprovalBusy}
        inlineError={sendApprovalError}
        onConfirm={confirmSendForApproval}
        onCancel={closeSendApprovalModal}
      />

      <SopLibraryViewEditModal
        item={
          mode === "versionView"
            ? versionViewItem
            : activeItem && (mode === "view" || mode === "edit")
              ? activeItem
              : null
        }
        mode={mode === "edit" ? "edit" : mode === "view" || mode === "versionView" ? "view" : null}
        onClose={closeModal}
        onAfterSave={() => router.refresh()}
      />

      <SopVersionHistoryModal
        sopId={activeItem && mode === "history" ? activeItem.id : null}
        sopTitle={activeItem?.title || ""}
        onClose={closeModal}
        onViewVersion={handleViewVersion}
      />
    </>
  );
}
