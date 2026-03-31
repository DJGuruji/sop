import { prisma } from "@/lib/prisma";
import { deleteSopFilesFromStorageForUrls } from "@/lib/s3-sop-upload";
import type { Actor } from "@/lib/authz";
import {
  ApprovalStatus,
  AuditAction,
  DocumentStatus,
  DocumentType,
  Role,
} from "@/generated/prisma/enums";
import { writeAuditLog } from "@/lib/audit";

export type SopListTab = "ALL" | "PENDING_APPROVAL" | "APPROVED";

export function parseSopListTabParam(searchParams: URLSearchParams): SopListTab {
  const v = (searchParams.get("tab") ?? "all").toLowerCase();
  if (v === "pending" || v === "pending_approval") return "PENDING_APPROVAL";
  if (v === "approved") return "APPROVED";
  return "ALL";
}

export type SopDocumentRow = {
  id: string;
  serialNo: string;
  title: string;
  status: DocumentStatus;
  currentVersion: number;
  isPublished: boolean;
  updatedAt: Date;
  pendingApprovalRequestId: string | null;
  canSubmitForApproval: boolean;
  canActAsApprover: boolean;
  /** False for department admins when the pending request was raised by another department admin (reject only for org Admin / Super Admin). */
  canRejectAsApprover: boolean;
  canEscalateToAdmin: boolean;
  /** Department admin: record endorsement on supervisor-raised requests (before Send to org Admin). */
  canDeptEndorseSop: boolean;
  /** Pending request already has department-level endorsement. */
  deptEndorsed: boolean;
  canDeleteUnpublished: boolean;
  canArchivePublished: boolean;
  canDownloadPdf: boolean;
};

/** Department Admin / Admin / Super Admin may delete (unpublished) or archive (published) SOPs in scope. */
export function canManageSopLifecycle(actor: Actor, documentDepartmentId: string): boolean {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) return true;
  if (actor.role === Role.DEPARTMENT_ADMIN && actor.departmentId === documentDepartmentId) return true;
  return false;
}

export function sopTabToDocumentWhere(tab: SopListTab | undefined) {
  if (tab === "PENDING_APPROVAL") return { status: DocumentStatus.PENDING_APPROVAL };
  if (tab === "APPROVED") return { status: DocumentStatus.APPROVED };
  return { status: { not: DocumentStatus.ARCHIVED } };
}

function canSubmitDraftForSop(
  actor: Actor,
  doc: {
    createdById: string;
    departmentId: string;
    subDepartmentId: string | null;
    status: DocumentStatus;
    type: DocumentType;
  },
): boolean {
  if (doc.type !== DocumentType.SOP || (doc.status !== DocumentStatus.DRAFT && doc.status !== DocumentStatus.REJECTED && doc.status !== DocumentStatus.ADMIN_REJECTED)) return false;
  if (doc.createdById === actor.id) return true;
  if (actor.role === Role.SUPERVISOR) {
    return (
      actor.departmentId === doc.departmentId && actor.subDepartmentId === doc.subDepartmentId
    );
  }
  if (actor.role === Role.DEPARTMENT_ADMIN && actor.departmentId === doc.departmentId) return true;
  if (actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN) return true;
  return false;
}

/**
 * Routes supervisor submissions to the best-matching department admin for that department / sub-department.
 * Order: same dept + same sub-dept → dept-wide admin (no sub) → any admin for dept (primary or assignment).
 */
async function findDepartmentAdminUserIdForSupervisorSubmit(
  departmentId: string,
  supervisorSubDepartmentId: string | null | undefined,
  documentSubDepartmentId: string | null | undefined,
): Promise<string | null> {
  const base = {
    role: Role.DEPARTMENT_ADMIN,
    isActive: true,
    deletedAt: null,
  } as const;

  const subId = supervisorSubDepartmentId ?? documentSubDepartmentId ?? null;

  if (subId) {
    const subScoped = await prisma.user.findFirst({
      where: { ...base, departmentId, subDepartmentId: subId },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (subScoped) return subScoped.id;
  }

  const deptWide = await prisma.user.findFirst({
    where: { ...base, departmentId, subDepartmentId: null },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (deptWide) return deptWide.id;

  const fallback = await prisma.user.findFirst({
    where: {
      ...base,
      OR: [
        { departmentId },
        { adminDepartmentAssignments: { some: { departmentId } } },
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

async function findFirstSuperAdminUserId(excludeUserId?: string): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: {
      role: Role.SUPER_ADMIN,
      isActive: true,
      deletedAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  return u?.id ?? null;
}

/** Approvers department admins may choose when submitting an SOP (org Admin or Super Admin). */
async function resolveInitialApproverId(
  requester: Actor,
  document: { departmentId: string; subDepartmentId: string | null },
): Promise<string | null> {
  switch (requester.role) {
    case Role.SUPERVISOR:
      return findDepartmentAdminUserIdForSupervisorSubmit(
        document.departmentId,
        requester.subDepartmentId,
        document.subDepartmentId,
      );
    case Role.ADMIN:
      return findFirstSuperAdminUserId();
    case Role.SUPER_ADMIN: {
      const other = await findFirstSuperAdminUserId(requester.id);
      return other ?? requester.id;
    }
    default:
      return null;
  }
}

export async function listOrgAdminsForEscalation(): Promise<{ id: string; name: string; email: string }[]> {
  const users = await prisma.user.findMany({
    where: { role: Role.ADMIN, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return users;
}

export async function listSopSubmitApprovers(): Promise<
  { id: string; name: string; email: string; role: Role }[]
> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
      isActive: true,
      deletedAt: null,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });
  return users;
}

type RawSopDoc = {
  id: string;
  serialNo: string;
  title: string;
  status: DocumentStatus;
  currentVersion: number;
  isPublished: boolean;
  updatedAt: Date;
  createdById: string;
  departmentId: string;
  subDepartmentId: string | null;
  type: DocumentType;
  latestVersion?: { content: unknown } | null;
};

export async function enrichSopRowsForActor(actor: Actor, docs: RawSopDoc[]): Promise<SopDocumentRow[]> {
  if (docs.length === 0) return [];
  const ids = docs.map((d) => d.id);
  const pendingReqs = await prisma.approvalRequest.findMany({
    where: {
      documentId: { in: ids },
      status: ApprovalStatus.PENDING,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentId: true,
      approverId: true,
      deptApprovedAt: true,
      requester: { select: { role: true } },
    },
  });
  const byDoc = new Map<
    string,
    { id: string; approverId: string; requesterRole: Role; deptApprovedAt: Date | null }
  >();
  for (const r of pendingReqs) {
    if (!byDoc.has(r.documentId)) {
      byDoc.set(r.documentId, {
        id: r.id,
        approverId: r.approverId,
        requesterRole: r.requester.role,
        deptApprovedAt: r.deptApprovedAt,
      });
    }
  }

  return docs.map((doc) => {
    const pending = byDoc.get(doc.id);
    const canSubmitForApproval = canSubmitDraftForSop(actor, doc);
    const isSupervisorRequest = pending != null && pending.requesterRole === Role.SUPERVISOR;
    const deptAdminHandlingSupervisor =
      actor.role === Role.DEPARTMENT_ADMIN &&
      pending != null &&
      pending.approverId === actor.id &&
      isSupervisorRequest;

    const canActAsApprover =
      doc.status === DocumentStatus.PENDING_APPROVAL &&
      pending != null &&
      pending.approverId === actor.id &&
      !(
        actor.role === Role.DEPARTMENT_ADMIN &&
        pending.requesterRole === Role.DEPARTMENT_ADMIN
      ) &&
      !deptAdminHandlingSupervisor;

    const canRejectAsApprover =
      doc.status === DocumentStatus.PENDING_APPROVAL &&
      pending != null &&
      pending.approverId === actor.id &&
      !(
        actor.role === Role.DEPARTMENT_ADMIN &&
        pending.requesterRole === Role.DEPARTMENT_ADMIN
      );

    const canDeptEndorseSop =
      deptAdminHandlingSupervisor &&
      doc.status === DocumentStatus.PENDING_APPROVAL &&
      pending != null &&
      !pending.deptApprovedAt;

    const canEscalateToAdmin =
      deptAdminHandlingSupervisor && doc.status === DocumentStatus.PENDING_APPROVAL && pending != null;

    const canLifecycle = canManageSopLifecycle(actor, doc.departmentId);
    const deptAdminDeleteBlocked =
      actor.role === Role.DEPARTMENT_ADMIN && doc.status === DocumentStatus.PENDING_APPROVAL;
    const canDeleteUnpublished = canLifecycle && !doc.isPublished && !deptAdminDeleteBlocked;
    const canArchivePublished = canLifecycle && doc.isPublished;
    const canDownloadPdf =
      doc.isPublished &&
      !!doc.latestVersion &&
      typeof doc.latestVersion.content === "object" &&
      doc.latestVersion.content !== null &&
      "editableHtml" in doc.latestVersion.content;

    return {
      id: doc.id,
      serialNo: doc.serialNo,
      title: doc.title,
      status: doc.status,
      currentVersion: doc.currentVersion,
      isPublished: doc.isPublished,
      updatedAt: doc.updatedAt,
      pendingApprovalRequestId: pending?.id ?? null,
      canSubmitForApproval,
      canActAsApprover,
      canRejectAsApprover,
      canEscalateToAdmin,
      canDeptEndorseSop,
      deptEndorsed: !!pending?.deptApprovedAt,
      canDeleteUnpublished,
      canArchivePublished,
      canDownloadPdf,
    };
  });
}

function collectSourceFileUrlsFromVersionContent(versions: { content: unknown }[]): string[] {
  const out: string[] = [];
  for (const v of versions) {
    const c = v.content;
    if (c && typeof c === "object" && c !== null && "sourceFileUrl" in c) {
      const u = (c as { sourceFileUrl?: unknown }).sourceFileUrl;
      if (typeof u === "string" && u.trim()) out.push(u.trim());
    }
  }
  return [...new Set(out)];
}

/** Permanently removes unpublished SOP: S3 objects (if any), then DB rows (document, versions, approval requests). */
export async function softDeleteUnpublishedSop(
  actor: Actor,
  documentId: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      title: true,
      departmentId: true,
      isPublished: true,
      status: true,
      versions: { select: { content: true } },
    },
  });

  if (!doc) return { ok: false, message: "Document not found" };
  if (!canManageSopLifecycle(actor, doc.departmentId)) {
    return { ok: false, message: "You cannot delete this document" };
  }
  if (actor.role === Role.DEPARTMENT_ADMIN && doc.status === DocumentStatus.PENDING_APPROVAL) {
    return {
      ok: false,
      message: "Cannot delete while this SOP is pending approval. Wait for an org Admin or Super Admin.",
    };
  }
  if (doc.isPublished) {
    return { ok: false, message: "Published SOPs must be archived instead of deleted" };
  }

  const fileUrls = collectSourceFileUrlsFromVersionContent(doc.versions);
  const storageResult = await deleteSopFilesFromStorageForUrls(fileUrls);
  if (!storageResult.ok) {
    return storageResult;
  }

  const docId = doc.id;
  const docTitle = doc.title;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.deleteMany({ where: { documentId: docId } });
      await tx.document.update({
        where: { id: docId },
        data: { latestVersionId: null },
      });
      await tx.documentVersion.deleteMany({ where: { documentId: docId } });
      await tx.document.delete({ where: { id: docId } });
    });
  } catch (e) {
    console.error("[delete SOP] database delete failed:", e);
    return { ok: false, message: "Failed to delete document from the database" };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.DELETE,
    entityType: "Document",
    entityId: docId,
    entityTitle: docTitle,
    meta: { type: "SOP", permanent: true, sourceFileUrls: fileUrls },
    req,
  });

  return { ok: true };
}

export async function archivePublishedSop(
  actor: Actor,
  documentId: string,
  reason: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Archive reason is required" };
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      title: true,
      departmentId: true,
      isPublished: true,
      status: true,
    },
  });

  if (!doc) return { ok: false, message: "Document not found" };
  if (!canManageSopLifecycle(actor, doc.departmentId)) {
    return { ok: false, message: "You cannot archive this document" };
  }
  if (!doc.isPublished) {
    return { ok: false, message: "Only published SOPs can be archived this way" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.updateMany({
        where: {
          documentId: doc.id,
          status: ApprovalStatus.PENDING,
          deletedAt: null,
        },
        data: { status: ApprovalStatus.CANCELLED },
      });
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: DocumentStatus.ARCHIVED,
          isPublished: false,
          publishedAt: null,
          publishedById: null,
          updatedById: actor.id,
        },
      });
    });
  } catch {
    return { ok: false, message: "Failed to archive document" };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.UPDATE,
    entityType: "Document",
    entityId: doc.id,
    entityTitle: doc.title,
    meta: { action: "ARCHIVE_SOP", reason: trimmed, previousStatus: doc.status },
    req,
  });

  return { ok: true };
}

export async function submitSopForApproval(
  actor: Actor,
  documentId: string,
  opts: { approverUserId?: string },
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      status: true,
      departmentId: true,
      subDepartmentId: true,
      createdById: true,
      latestVersionId: true,
      title: true,
    },
  });

  if (!doc) return { ok: false, message: "Document not found" };
  if (doc.status !== DocumentStatus.DRAFT && doc.status !== DocumentStatus.REJECTED && doc.status !== DocumentStatus.ADMIN_REJECTED) {
    return { ok: false, message: "Only draft or rejected SOPs can be submitted" };
  }

  if (!canSubmitDraftForSop(actor, { ...doc, type: DocumentType.SOP })) {
    return { ok: false, message: "You cannot submit this document for approval" };
  }

  const existingPending = await prisma.approvalRequest.findFirst({
    where: { documentId: doc.id, status: ApprovalStatus.PENDING, deletedAt: null },
  });
  if (existingPending) {
    return { ok: false, message: "This document already has a pending approval request" };
  }

  const versionId = doc.latestVersionId;
  if (!versionId) {
    return { ok: false, message: "Document has no version to approve" };
  }

  let approverId: string | null = null;

  if (actor.role === Role.DEPARTMENT_ADMIN) {
    const selected = opts.approverUserId?.trim();
    if (!selected) {
      return { ok: false, message: "Select an org Admin or Super Admin to send this SOP for approval" };
    }
    const approverUser = await prisma.user.findFirst({
      where: {
        id: selected,
        role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!approverUser) {
      return { ok: false, message: "Invalid approver. Choose an active org Admin or Super Admin." };
    }
    approverId = approverUser.id;
  } else {
    approverId = await resolveInitialApproverId(actor, doc);
    if (!approverId) {
      return {
        ok: false,
        message:
          actor.role === Role.SUPERVISOR
            ? "No department admin is assigned for this department or sub-department."
            : "No approver could be determined (assign an org Admin or Super Admin)",
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.create({
        data: {
          documentId: doc.id,
          documentVersionId: versionId,
          requesterId: actor.id,
          approverId,
          status: ApprovalStatus.PENDING,
        },
      });
      // Set appropriate document status based on the approval workflow
      let documentStatus: DocumentStatus;
      if (actor.role === Role.SUPERVISOR) {
        // Supervisor submitting to dept admin
        documentStatus = DocumentStatus.PENDING_DEPT_ADMIN_APPROVAL;
      } else if (actor.role === Role.DEPARTMENT_ADMIN) {
        // Dept admin submitting to admin
        documentStatus = DocumentStatus.PENDING_ADMIN_APPROVAL;
      } else {
        // Admin/Super Admin submitting (general approval)
        documentStatus = DocumentStatus.PENDING_APPROVAL;
      }

      await tx.document.update({
        where: { id: doc.id },
        data: { status: documentStatus },
      });
    });
  } catch {
    return { ok: false, message: "Failed to submit for approval" };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.SUBMIT_FOR_APPROVAL,
    entityType: "Document",
    entityId: doc.id,
    entityTitle: doc.title,
    meta: { approverId },
    req,
  });

  return { ok: true };
}

export async function endorseDeptApprovalRequest(
  actor: Actor,
  approvalRequestId: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (actor.role !== Role.DEPARTMENT_ADMIN) {
    return { ok: false, message: "Only department admins can record department approval" };
  }

  const ar = await prisma.approvalRequest.findFirst({
    where: { id: approvalRequestId, deletedAt: null },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
      requester: { select: { role: true } },
    },
  });

  if (!ar) return { ok: false, message: "Approval request not found" };
  if (ar.status !== ApprovalStatus.PENDING) {
    return { ok: false, message: "This approval request is no longer pending" };
  }
  if (ar.approverId !== actor.id) {
    return { ok: false, message: "You are not the assigned approver" };
  }
  if (ar.requester.role !== Role.SUPERVISOR) {
    return {
      ok: false,
      message: "Department-level approval applies only to SOPs submitted by supervisors",
    };
  }
  if (ar.document.type !== DocumentType.SOP || ar.document.status !== DocumentStatus.PENDING_APPROVAL) {
    return { ok: false, message: "Invalid document state" };
  }
  if (ar.deptApprovedAt) {
    return { ok: false, message: "This request is already marked as approved by the department" };
  }

  await prisma.approvalRequest.update({
    where: { id: ar.id },
    data: {
      deptApprovedAt: new Date(),
      deptApprovedById: actor.id,
    },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.APPROVE,
    entityType: "Document",
    entityId: ar.documentId,
    entityTitle: ar.document.title,
    meta: { approvalRequestId: ar.id, stage: "DEPARTMENT_ENDORSEMENT" },
    req,
  });

  return { ok: true };
}

export async function approveApprovalRequest(
  actor: Actor,
  approvalRequestId: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ar = await prisma.approvalRequest.findFirst({
    where: { id: approvalRequestId, deletedAt: null },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
      requester: { select: { role: true } },
    },
  });

  if (!ar) return { ok: false, message: "Approval request not found" };
  if (ar.status !== ApprovalStatus.PENDING) {
    return { ok: false, message: "This approval request is no longer pending" };
  }
  if (ar.approverId !== actor.id) {
    return { ok: false, message: "You are not the assigned approver" };
  }
  if (ar.document.type !== DocumentType.SOP) {
    return { ok: false, message: "Invalid document type" };
  }
  if (ar.document.status !== DocumentStatus.PENDING_APPROVAL) {
    return { ok: false, message: "Document is not pending approval" };
  }

  if (actor.role === Role.DEPARTMENT_ADMIN && ar.requester.role === Role.SUPERVISOR) {
    return {
      ok: false,
      message:
        'Use "Approved by department" to record department sign-off, then "Send to org Admin" for final approval.',
    };
  }

  if (
    actor.role === Role.DEPARTMENT_ADMIN &&
    ar.requester.role === Role.DEPARTMENT_ADMIN
  ) {
    return {
      ok: false,
      message:
        "Only an org Admin or Super Admin can approve requests submitted by a department admin.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: ar.id },
        data: { status: ApprovalStatus.APPROVED, actedAt: new Date() },
      });
      await tx.document.update({
        where: { id: ar.documentId },
        data: {
          status: DocumentStatus.APPROVED,
          isPublished: true,
          publishedAt: new Date(),
          publishedById: actor.id,
        },
      });
    });
  } catch {
    return { ok: false, message: "Failed to approve" };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.APPROVE,
    entityType: "Document",
    entityId: ar.documentId,
    entityTitle: ar.document.title,
    meta: { approvalRequestId: ar.id },
    req,
  });

  return { ok: true };
}

export async function rejectApprovalRequest(
  actor: Actor,
  approvalRequestId: string,
  remarks: string | undefined,
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const reason = (remarks ?? "").trim();
  if (!reason) {
    return { ok: false, message: "Rejection reason is required" };
  }

  const ar = await prisma.approvalRequest.findFirst({
    where: { id: approvalRequestId, deletedAt: null },
    include: {
      document: { select: { id: true, title: true, type: true, status: true } },
      requester: { select: { role: true } },
    },
  });

  if (!ar) return { ok: false, message: "Approval request not found" };
  if (ar.status !== ApprovalStatus.PENDING) {
    return { ok: false, message: "This approval request is no longer pending" };
  }
  if (ar.approverId !== actor.id) {
    return { ok: false, message: "You are not the assigned approver" };
  }
  if (ar.document.type !== DocumentType.SOP || ar.document.status !== DocumentStatus.PENDING_APPROVAL) {
    return { ok: false, message: "Invalid document state" };
  }

  if (
    actor.role === Role.DEPARTMENT_ADMIN &&
    ar.requester.role === Role.DEPARTMENT_ADMIN
  ) {
    return {
      ok: false,
      message:
        "Only an org Admin or Super Admin can reject requests submitted by a department admin.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: ar.id },
        data: {
          status: ApprovalStatus.REJECTED,
          actedAt: new Date(),
          remarks: reason,
        },
      });
      await tx.document.update({
        where: { id: ar.documentId },
        data: {
          status: DocumentStatus.REJECTED,
          isPublished: false,
          publishedAt: null,
          publishedById: null,
        },
      });
    });
  } catch {
    return { ok: false, message: "Failed to reject" };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.REJECT,
    entityType: "Document",
    entityId: ar.documentId,
    entityTitle: ar.document.title,
    meta: { approvalRequestId: ar.id, remarks: reason },
    req,
  });

  return { ok: true };
}

export async function escalateApprovalToOrgAdmin(
  actor: Actor,
  approvalRequestId: string,
  targetUserId: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (actor.role !== Role.DEPARTMENT_ADMIN) {
    return { ok: false, message: "Only department admins can escalate to org admins" };
  }

  const target = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      role: Role.ADMIN,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!target) {
    return { ok: false, message: "Selected user is not an active Admin" };
  }

  const ar = await prisma.approvalRequest.findFirst({
    where: { id: approvalRequestId, deletedAt: null },
    include: {
      document: { select: { id: true, title: true, type: true, status: true } },
    },
  });

  if (!ar) return { ok: false, message: "Approval request not found" };
  if (ar.status !== ApprovalStatus.PENDING) {
    return { ok: false, message: "This approval request is no longer pending" };
  }
  if (ar.approverId !== actor.id) {
    return { ok: false, message: "You are not the assigned approver" };
  }
  if (ar.document.type !== DocumentType.SOP || ar.document.status !== DocumentStatus.PENDING_APPROVAL) {
    return { ok: false, message: "Invalid document state" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: ar.id },
        data: { status: ApprovalStatus.ESCALATED, actedAt: new Date() },
      });
      await tx.approvalRequest.create({
        data: {
          documentId: ar.documentId,
          documentVersionId: ar.documentVersionId,
          requesterId: actor.id,
          approverId: targetUserId,
          status: ApprovalStatus.PENDING,
        },
      });
    });
  } catch {
    return { ok: false, message: "Failed to escalate" };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.ESCALATE,
    entityType: "Document",
    entityId: ar.documentId,
    entityTitle: ar.document.title,
    meta: { approvalRequestId: ar.id, targetUserId },
    req,
  });

  return { ok: true };
}
