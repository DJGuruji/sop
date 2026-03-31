"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toastSuccess } from "@/lib/app-toast";
import { SopLibraryViewEditModal } from "../sop/sop-library-view-edit-modal";
import type { ManagedSopLibraryItem } from "../sop/sop-library-manager";
import { ConfirmActionModal } from "@/components/admin/confirm-action-modal";

export type ApprovalDisplayItem = {
  id: string;
  approverId: string;
  documentId: string;
  serialNo: string;
  documentTitle: string;
  isPublished: boolean;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  requesterDepartmentId: string | null;
  requesterSubDepartmentId: string | null;
  requesterDepartmentName: string | null;
  requesterSubDepartmentName: string | null;
  approverName: string;
  approverEmail: string;
  approverDepartmentName: string | null;
  approverSubDepartmentName: string | null;
  deptApprovedByName: string | null;
  deptApprovedByEmail: string | null;
  deptApprovedByDepartmentName: string | null;
  deptApprovedBySubDepartmentName: string | null;
  status: string;
  createdAt: string;
  remarks: string | null;
  deptApprovedAt: string | null;
};

type TabData = {
  label: string;
  id: string;
  pending: ApprovalDisplayItem[];
  approved: ApprovalDisplayItem[];
  rejected: ApprovalDisplayItem[];
  pendingTotal: number;
  approvedTotal: number;
  rejectedTotal: number;
};

type Department = {
  id: string;
  name: string;
  subDepartments: { id: string; name: string }[];
};

type Props = {
  role: string;
  currentUserId: string;
  tabs: TabData[];
  departments: Department[];
  currentPage: number;
  pageSize: number;
};

function classNames(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}


function ApprovalList({ 
  items, 
  emptyMessage, 
  role,
  currentUserId,
  onRefresh,
  onOpenDocument,
  documentBusyId,
  departments,
  activeSubTab,
  activeTabId,
}: { 
  items: ApprovalDisplayItem[]; 
  emptyMessage: string;
  role: string;
  currentUserId: string;
  onRefresh: () => void;
  onOpenDocument: (documentId: string, mode: "view" | "edit") => void;
  documentBusyId: string | null;
  departments: Department[];
  activeSubTab: "pending" | "approved" | "rejected";
  activeTabId: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<ApprovalDisplayItem | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [pendingPublishItem, setPendingPublishItem] = useState<ApprovalDisplayItem | null>(null);
  const [showEscalateConfirm, setShowEscalateConfirm] = useState(false);
  const [pendingEscalateId, setPendingEscalateId] = useState<string | null>(null);
  const [showAdminApproveConfirm, setShowAdminApproveConfirm] = useState(false);
  const [pendingAdminApproveId, setPendingAdminApproveId] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusItem, setStatusItem] = useState<ApprovalDisplayItem | null>(null);
  const [showSendApprovalConfirm, setShowSendApprovalConfirm] = useState(false);
  const [pendingSendApprovalId, setPendingSendApprovalId] = useState<string | null>(null);
  const [sendApprovalBusy, setSendApprovalBusy] = useState(false);
  
  const isSupervisor = role === "SUPERVISOR";
  const showRequesterDetails = !isSupervisor;


  function closePublishConfirm() {
    if (publishBusy) return;
    setPendingPublishItem(null);
    setShowPublishConfirm(false);
  }

  function confirmPublish() {
    if (!pendingPublishItem) return;
    setShowPublishConfirm(false);
    handleDirectPublish(pendingPublishItem);
  }

  function openEscalateConfirm(id: string) {
    setPendingEscalateId(id);
    setShowEscalateConfirm(true);
  }

  function closeEscalateConfirm() {
    if (busy) return;
    setPendingEscalateId(null);
    setShowEscalateConfirm(false);
  }

  function confirmEscalate() {
    if (!pendingEscalateId) return;
    setShowEscalateConfirm(false);
    handleEscalate(pendingEscalateId);
  }

  function openAdminApproveConfirm(id: string) {
    setPendingAdminApproveId(id);
    setShowAdminApproveConfirm(true);
  }

  function closeAdminApproveConfirm() {
    if (busy) return;
    setPendingAdminApproveId(null);
    setShowAdminApproveConfirm(false);
  }

  function confirmAdminApprove() {
    if (!pendingAdminApproveId) return;
    setShowAdminApproveConfirm(false);
    handleAdminApprove(pendingAdminApproveId);
  }

  function openRejectConfirm(id: string) {
    setPendingRejectId(id);
    setRejectReason("");
    setShowRejectConfirm(true);
  }

  function closeRejectConfirm() {
    if (busy) return;
    setPendingRejectId(null);
    setRejectReason("");
    setShowRejectConfirm(false);
  }

  function confirmReject() {
    if (!pendingRejectId || !rejectReason.trim()) return;
    setShowRejectConfirm(false);
    handleReject(pendingRejectId, rejectReason.trim());
  }

  function openStatusModal(item: ApprovalDisplayItem) {
    setStatusItem(item);
    setShowStatusModal(true);
  }

  function closeStatusModal() {
    setStatusItem(null);
    setShowStatusModal(false);
  }

  function openSendApprovalConfirm(documentId: string) {
    setPendingSendApprovalId(documentId);
    setShowSendApprovalConfirm(true);
  }

  function closeSendApprovalConfirm() {
    if (sendApprovalBusy) return;
    setPendingSendApprovalId(null);
    setShowSendApprovalConfirm(false);
  }

  async function confirmSendApproval() {
    if (!pendingSendApprovalId) return;
    
    setSendApprovalBusy(true);
    setShowSendApprovalConfirm(false);

    try {
      const res = await fetch(`/api/sop/library-items/${encodeURIComponent(pendingSendApprovalId)}/send-for-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        console.error("Send for approval failed:", data.error?.message);
        return;
      }

      // Refresh the page to show updated status
      onRefresh();
    } catch (error) {
      console.error("Send for approval error:", error);
    } finally {
      setSendApprovalBusy(false);
      setPendingSendApprovalId(null);
    }
  }


  async function handleDirectPublish(item: ApprovalDisplayItem) {
    setPublishBusy(true);
    setPublishError(null);
    setPublishSuccess(null);
    setPublishTarget(item);

    // Determine department and sub-department based on requester's role and department
    let departmentId: string;
    let subDepartmentId: string | null = null;

    if (item.requesterRole === "SUPERVISOR") {
      // For supervisors: publish under their sub-department (if they have one) or department
      if (item.requesterSubDepartmentId && item.requesterDepartmentId) {
        departmentId = item.requesterDepartmentId;
        subDepartmentId = item.requesterSubDepartmentId;
      } else if (item.requesterDepartmentId) {
        departmentId = item.requesterDepartmentId;
        subDepartmentId = null;
      } else {
        setPublishError("Cannot determine supervisor's department for publishing.");
        setPublishBusy(false);
        return;
      }
    } else if (item.requesterRole === "DEPARTMENT_ADMIN") {
      // For department admins: publish under their department (no sub-department)
      if (item.requesterDepartmentId) {
        departmentId = item.requesterDepartmentId;
        subDepartmentId = null;
      } else {
        setPublishError("Cannot determine department admin's department for publishing.");
        setPublishBusy(false);
        return;
      }
    } else {
      setPublishError("Unsupported requester role for automatic publishing.");
      setPublishBusy(false);
      return;
    }

    try {
      const res = await fetch(`/api/sop/library-items/${encodeURIComponent(item.documentId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          subDepartmentId,
        }),
      });
      
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || data.success === false) {
        setPublishError(data.error?.message ?? "Failed to publish SOP.");
        setPublishBusy(false);
        return;
      }

      // Show success and refresh
      setPublishSuccess(`SOP "${item.documentTitle}" published successfully!`);
      setPublishTarget(null);
      onRefresh();
      
      // Clear success message after 3 seconds
      setTimeout(() => setPublishSuccess(null), 3000);
    } catch (error) {
      setPublishError("Failed to publish SOP.");
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleEscalate(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ESCALATE" }),
      });
      if (!res.ok) throw new Error("Failed to send to admin");
      toastSuccess("SOP sent for Admin approval.");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleAdminApprove(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toastSuccess("SOP approved successfully.");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(id: string, reason: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      toastSuccess("SOP rejected successfully.");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Document</th>
            <th className="px-4 py-3 text-left min-w-[14rem]">
              {isSupervisor ? "Requested To" : "Requester"}
            </th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Status</th>
            {activeSubTab !== "rejected" && (
              <th className="px-4 py-3 text-left">Remarks</th>
            )}
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{item.documentTitle}</p>
                <p className="text-xs text-slate-500">{item.serialNo}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {showRequesterDetails ? (
                  <>
                    <p className="font-medium text-slate-900">{item.requesterName}</p>
                    <p className="text-xs text-slate-500">{item.requesterEmail}</p>
                    {(item.requesterDepartmentName || item.requesterSubDepartmentName) && (
                      <p className="mt-1 text-xs text-slate-600">
                        {item.requesterDepartmentName ?? ""}
                        {item.requesterSubDepartmentName
                          ? `${item.requesterDepartmentName ? " · " : ""}${item.requesterSubDepartmentName}`
                          : ""}
                      </p>
                    )}
                    {/* Show department admin details for admin users when item was escalated */}
                    {(role === "ADMIN" || role === "SUPER_ADMIN") && item.deptApprovedAt && item.deptApprovedByName && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-500 font-medium">Escalated by:</p>
                        <p className="text-xs text-slate-700">{item.deptApprovedByName}</p>
                        <p className="text-xs text-slate-500">{item.deptApprovedByEmail}</p>
                        {(item.deptApprovedByDepartmentName || item.deptApprovedBySubDepartmentName) && (
                          <p className="text-xs text-slate-600">
                            {item.deptApprovedByDepartmentName ?? ""}
                            {item.deptApprovedBySubDepartmentName
                              ? `${item.deptApprovedByDepartmentName ? " · " : ""}${item.deptApprovedBySubDepartmentName}`
                              : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-medium text-slate-900">{item.approverName}</p>
                    <p className="text-xs text-slate-500">{item.approverEmail}</p>
                    {(item.approverDepartmentName || item.approverSubDepartmentName) && (
                      <p className="mt-1 text-xs text-slate-600">
                        {item.approverDepartmentName ?? ""}
                        {item.approverSubDepartmentName
                          ? `${item.approverDepartmentName ? " · " : ""}${item.approverSubDepartmentName}`
                          : ""}
                      </p>
                    )}
                  </>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {new Date(item.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <span
                  className={classNames(
                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                    item.status === "PENDING"
                      ? "bg-amber-100 text-amber-800"
                      : item.status === "APPROVED" && item.isPublished
                      ? "bg-blue-100 text-blue-800"
                      : item.status === "APPROVED"
                      ? "bg-green-100 text-green-800"
                      : item.status === "REJECTED"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-800"
                  )}
                >
                  {item.status === "APPROVED" && item.isPublished ? "PUBLISHED" : item.status}
                </span>
              </td>
              {activeSubTab !== "rejected" && (
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                  {item.remarks || "—"}
                </td>
              )}
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2 font-sans">
                  <button
                    type="button"
                    disabled={documentBusyId === item.documentId}
                    onClick={() => onOpenDocument(item.documentId, "view")}
                    className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {documentBusyId === item.documentId ? "…" : "View"}
                  </button>
                  
                  {/* Edit button - conditional display */}
                  {(
                    // Show edit for rejected items in rejected tab
                    (activeSubTab === "rejected" && item.status === "REJECTED") ||
                    // Original logic for non-rejected items
                    (activeSubTab !== "rejected" && !(
                      role === "SUPERVISOR" || // Never show edit for supervisors in non-rejected tabs
                      (role === "DEPARTMENT_ADMIN" && item.deptApprovedAt) || // Hide for dept admin after escalation
                      item.isPublished // Hide for published SOPs
                    ))
                  ) && (
                    <button
                      type="button"
                      disabled={documentBusyId === item.documentId}
                      onClick={() => onOpenDocument(item.documentId, "edit")}
                      className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Edit
                    </button>
                  )}

                  {/* See Status button for supervisors when rejected */}
                  {role === "SUPERVISOR" && item.status === "REJECTED" && (
                    <button
                      type="button"
                      onClick={() => openStatusModal(item)}
                      className="rounded border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
                    >
                      See Status
                    </button>
                  )}

                  {/* Actions for rejected items in rejected tab */}
                  {activeSubTab === "rejected" && item.status === "REJECTED" && (
                    <>
                      {/* Send for Approval button logic:
                          - Supervisors: Show in all rejected subtabs
                          - Dept Admins: Only show in request tab (admin-rejected items), not in requested tab (dept admin rejected items)
                      */}
                      {(role === "SUPERVISOR" || 
                        (role === "DEPARTMENT_ADMIN" && activeTabId === "request")) && (
                        <button
                          type="button"
                          disabled={sendApprovalBusy}
                          onClick={() => openSendApprovalConfirm(item.documentId)}
                          className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {sendApprovalBusy && pendingSendApprovalId === item.documentId ? "Sending..." : "Send for Approval"}
                        </button>
                      )}

                    </>
                  )}

                  {/* Dept Admin Actions */}
                  {role === "DEPARTMENT_ADMIN" && item.approverId === currentUserId && (
                    <>
                      {/* Send to Admin button - only show if not yet escalated */}
                      {item.status === "PENDING" && !item.deptApprovedAt && (
                        <button
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => openEscalateConfirm(item.id)}
                          className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {busy === item.id ? "Sending..." : "Send to Admin"}
                        </button>
                      )}
                      
                      {/* Reject button - only show if pending and not escalated */}
                      {item.status === "PENDING" && !item.deptApprovedAt && (
                        <button
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => openRejectConfirm(item.id)}
                          className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {busy === item.id ? "Rejecting..." : "Reject"}
                        </button>
                      )}
                      
                      {/* Publish button - only show if not published and not escalated to admin */}
                      {((item.status === "PENDING" && !item.deptApprovedAt) || 
                        (item.status === "APPROVED" && !item.deptApprovedAt)) && 
                        !item.isPublished && (
                        <button
                          type="button"
                          disabled={publishBusy}
                          onClick={() => {
                            setPendingPublishItem(item);
                            setShowPublishConfirm(true);
                          }}
                          className="rounded border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {publishBusy && publishTarget?.id === item.id ? "Publishing..." : "Publish"}
                        </button>
                      )}
                    </>
                  )}
                  {/* Admin Actions */}
                  {(role === "SUPER_ADMIN" || role === "ADMIN") && (
                    <>
                      {/* Approve button - show if pending and (escalated OR directly submitted by dept admin) */}
                      {item.status === "PENDING" && (item.deptApprovedAt || item.requesterRole === "DEPARTMENT_ADMIN") && (
                        <button
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => openAdminApproveConfirm(item.id)}
                          className="rounded border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {busy === item.id ? "Approving..." : "Approve"}
                        </button>
                      )}
                      
                      {/* Reject button - show if pending and (escalated OR directly submitted by dept admin) */}
                      {item.status === "PENDING" && (item.deptApprovedAt || item.requesterRole === "DEPARTMENT_ADMIN") && (
                        <button
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => openRejectConfirm(item.id)}
                          className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {busy === item.id ? "Rejecting..." : "Reject"}
                        </button>
                      )}
                      
                      {/* Publish button - show if approved and not published */}
                      {item.status === "APPROVED" && !item.isPublished && (
                        <button
                          type="button"
                          disabled={publishBusy}
                          onClick={() => {
                            setPendingPublishItem(item);
                            setShowPublishConfirm(true);
                          }}
                          className="rounded border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {publishBusy && publishTarget?.id === item.id ? "Publishing..." : "Publish"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Display publish messages */}
    {publishError && (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-sm text-red-600">{publishError}</p>
      </div>
    )}
    {publishSuccess && (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
        <p className="text-sm text-green-600">{publishSuccess}</p>
      </div>
    )}

    {/* Publish Confirmation Modal */}
    <ConfirmActionModal
      open={showPublishConfirm}
      title="Publish SOP"
      message={`Are you sure you want to publish "${pendingPublishItem?.documentTitle}"?\n\nThis will make the SOP available to users and complete the approval process.`}
      confirmLabel="Publish"
      variant="primary"
      loading={publishBusy}
      onConfirm={confirmPublish}
      onCancel={closePublishConfirm}
    />

    {/* Escalate Confirmation Modal */}
    <ConfirmActionModal
      open={showEscalateConfirm}
      title="Send to Admin"
      message={`Send this SOP to the corresponding Admin for final approval?\n\nThe SOP will be forwarded to the Admin responsible for your department.`}
      confirmLabel="Send to Admin"
      variant="primary"
      loading={busy === pendingEscalateId}
      onConfirm={confirmEscalate}
      onCancel={closeEscalateConfirm}
    />

    {/* Admin Approve Confirmation Modal */}
    <ConfirmActionModal
      open={showAdminApproveConfirm}
      title="Approve SOP"
      message={`Approve this SOP for final publication?\n\nThis will complete the approval process and allow the SOP to be published.`}
      confirmLabel="Approve"
      variant="primary"
      loading={busy === pendingAdminApproveId}
      onConfirm={confirmAdminApprove}
      onCancel={closeAdminApproveConfirm}
    />

    {/* Send for Approval Confirmation Modal */}
    <ConfirmActionModal
      open={showSendApprovalConfirm}
      title="Send for Approval"
      message={`Send this rejected SOP for approval again?\n\nThis will resubmit the SOP to the approval workflow.`}
      confirmLabel="Send for Approval"
      variant="primary"
      loading={sendApprovalBusy}
      onConfirm={confirmSendApproval}
      onCancel={closeSendApprovalConfirm}
    />

    {/* Reject Confirmation Modal */}
    {showRejectConfirm && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Reject SOP</h2>
              <p className="mt-1 text-sm text-slate-500">Please provide a reason for rejection</p>
            </div>
            <button
              type="button"
              onClick={closeRejectConfirm}
              disabled={busy === pendingRejectId}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <label htmlFor="reject-reason" className="mb-2 block text-sm font-medium text-slate-700">
                Rejection Reason *
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please explain why this SOP is being rejected..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                rows={4}
                disabled={busy === pendingRejectId}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeRejectConfirm}
                disabled={busy === pendingRejectId}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={busy === pendingRejectId || !rejectReason.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy === pendingRejectId ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Status Details Modal */}
    {showStatusModal && statusItem && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">SOP Status Details</h2>
              <p className="mt-1 text-sm text-slate-500">{statusItem.documentTitle}</p>
            </div>
            <button
              type="button"
              onClick={closeStatusModal}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-900">Current Status</h3>
                <div className="mt-1">
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                    REJECTED
                  </span>
                </div>
              </div>

              {statusItem.remarks && (
                <div>
                  <h3 className="text-sm font-medium text-slate-900">Rejection Reason</h3>
                  <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">{statusItem.remarks}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-slate-900">Rejected By</h3>
                <div className="mt-1">
                  <p className="text-sm text-slate-600">
                    {statusItem.deptApprovedAt ? 'Admin' : 'Department Admin'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(statusItem.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={closeStatusModal}
                className="w-full rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

function PaginationComponent({ 
  currentPage, 
  pageSize, 
  totalItems, 
  activeSubTab 
}: { 
  currentPage: number; 
  pageSize: number; 
  totalItems: number; 
  activeSubTab: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const totalPages = Math.ceil(totalItems / pageSize);
  
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-700">
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                  page === currentPage
                    ? 'z-10 bg-indigo-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                    : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

export function ApprovalsClient({ role, currentUserId, tabs, departments, currentPage, pageSize }: Props) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || "");
  const [activeSubTab, setActiveSubTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [previewItem, setPreviewItem] = useState<ManagedSopLibraryItem | null>(null);
  const [previewMode, setPreviewMode] = useState<"view" | "edit" | null>(null);
  const [documentBusyId, setDocumentBusyId] = useState<string | null>(null);

  async function openDocument(documentId: string, mode: "view" | "edit") {
    setDocumentBusyId(documentId);
    try {
      const res = await fetch(`/api/sop/library-items/${encodeURIComponent(documentId)}`);
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { item?: ManagedSopLibraryItem };
        error?: { message?: string };
      };
      if (!res.ok || payload.success === false || !payload.data?.item) {
        alert(payload.error?.message ?? "Unable to load this SOP.");
        return;
      }
      setPreviewItem(payload.data.item);
      setPreviewMode(mode);
    } catch {
      alert("Unable to load this SOP.");
    } finally {
      setDocumentBusyId(null);
    }
  }

  function closePreview() {
    setPreviewItem(null);
    setPreviewMode(null);
  }

  if (tabs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">No approval scopes available for your role.</p>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  function getCurrentTotal() {
    if (activeSubTab === "pending") return activeTab?.pendingTotal || 0;
    if (activeSubTab === "approved") return activeTab?.approvedTotal || 0;
    if (activeSubTab === "rejected") return activeTab?.rejectedTotal || 0;
    return 0;
  }

  function refreshPage() {
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={classNames(
                "px-4 py-3 text-sm font-medium transition-colors focus:outline-none",
                isActive
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{activeTab.label} Approvals</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage your {activeTab.label.toLowerCase()} approval workflows.
            </p>
          </div>

          <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveSubTab("pending")}
              className={classNames(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                activeSubTab === "pending"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Pending ({activeTab.pending.length})
            </button>
            <button
              onClick={() => setActiveSubTab("approved")}
              className={classNames(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                activeSubTab === "approved"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Approved ({activeTab.approved.length})
            </button>
            <button
              onClick={() => setActiveSubTab("rejected")}
              className={classNames(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                activeSubTab === "rejected"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Rejected ({activeTab.rejected.length})
            </button>
          </div>
        </div>

        {activeSubTab === "pending" ? (
          <ApprovalList 
            items={activeTab.pending} 
            emptyMessage={`No pending approvals for ${activeTab.label}.`} 
            role={role}
            currentUserId={currentUserId}
            onRefresh={refreshPage}
            onOpenDocument={openDocument}
            documentBusyId={documentBusyId}
            departments={departments}
            activeSubTab={activeSubTab}
            activeTabId={activeTabId}
          />
        ) : activeSubTab === "approved" ? (
          <ApprovalList 
            items={activeTab.approved} 
            emptyMessage={`No approved items for ${activeTab.label}.`} 
            role={role}
            currentUserId={currentUserId}
            onRefresh={refreshPage}
            onOpenDocument={openDocument}
            documentBusyId={documentBusyId}
            departments={departments}
            activeSubTab={activeSubTab}
            activeTabId={activeTabId}
          />
        ) : (
          <ApprovalList 
            items={activeTab.rejected} 
            emptyMessage={`No rejected items for ${activeTab.label}.`} 
            role={role}
            currentUserId={currentUserId}
            onRefresh={refreshPage}
            onOpenDocument={openDocument}
            documentBusyId={documentBusyId}
            departments={departments}
            activeSubTab={activeSubTab}
            activeTabId={activeTabId}
          />
        )}

        {/* Pagination */}
        <PaginationComponent 
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={getCurrentTotal()}
          activeSubTab={activeSubTab}
        />
      </div>

      <SopLibraryViewEditModal
        item={previewItem}
        mode={previewMode}
        onClose={closePreview}
        onAfterSave={refreshPage}
      />
    </div>
  );
}
