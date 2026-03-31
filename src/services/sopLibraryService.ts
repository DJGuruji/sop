import { prisma } from "@/lib/prisma";
import { deleteSopFilesFromStorageForUrls } from "@/lib/s3-sop-upload";
import { writeAuditLog } from "@/lib/audit";
import { canManageDepartmentScoped, getManagedDepartmentIdsForDeptAdmin, type Actor } from "@/lib/authz";
import {
  buildHtmlFromSections,
  extractSopHeaderFields,
  extractSectionsFromHtml,
  htmlToPlainText,
  sanitizeEditableHtml,
  type EditableSopSection,
} from "@/lib/sop-editable-content";
import { ApprovalStatus, DocumentStatus, DocumentType, AuditAction, Role } from "@/generated/prisma/enums";
import { isSopLibraryUploadSerial } from "@/lib/sop-library-upload";

type LibraryVersionContent = {
  documentTitle?: string;
  version?: string;
  effectiveDate?: string;
  publishedAt?: string;
  sourceFileName?: string;
  sourceFileUrl?: string;
  fileKind?: string;
  editableHtml?: string;
  extractedText?: string;
  sourceFormat?: string;
  department?: string;
  subDepartment?: string;
  sections?: EditableSopSection[];
  preparedBy?: string;
  approvedBy?: string;
  formData?: any;
};

/**
 * Calculate the next version for an SOP based on its current version and creation/publish history
 * @param currentVersionLabel - Current version label (e.g., "1.2")
 * @param isNewSop - Whether this is a new SOP (should start at 1.0)
 * @param createdAt - When the SOP was originally created
 * @param lastPublishedAt - When the SOP was last published (for republishing)
 * @returns The next version label (e.g., "1.3" or "2.0")
 */
function calculateNextVersion(
  currentVersionLabel: string | null,
  isNewSop: boolean,
  createdAt: Date,
  lastPublishedAt: Date | null
): string {
  // New SOPs always start at 1.0
  if (isNewSop) {
    return "1.0";
  }

  // Parse current version (default to 1.0 if invalid)
  let major = 1;
  let minor = 0;
  
  if (currentVersionLabel) {
    const versionMatch = currentVersionLabel.match(/^(\d+)\.(\d+)$/);
    if (versionMatch) {
      major = parseInt(versionMatch[1], 10);
      minor = parseInt(versionMatch[2], 10);
    }
  }

  // Check if we need to increment major version due to year change
  const now = new Date();
  const currentYear = now.getFullYear();
  const creationYear = createdAt.getFullYear();
  
  // If we're in a different year than when the SOP was created,
  // and this is the first republish of the year, increment major version
  if (currentYear > creationYear) {
    const lastPublishYear = lastPublishedAt ? lastPublishedAt.getFullYear() : creationYear;
    
    // If last publish was in a previous year, increment major and reset minor
    if (currentYear > lastPublishYear) {
      return `${major + 1}.0`;
    }
  }

  // Otherwise, increment minor version
  return `${major}.${minor + 1}`;
}

/**
 * Get the initial version for a new SOP (always 1.0)
 */
function getInitialVersion(): string {
  return "1.0";
}

function parseVersionContent(content: unknown): LibraryVersionContent {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as LibraryVersionContent;
  }
  return {};
}

function canManageLibrarySop(actor: Actor, departmentId: string, createdById?: string | null): boolean {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) return true;
  if (actor.role === Role.DEPARTMENT_ADMIN) {
    return canManageDepartmentScoped(actor, departmentId, createdById);
  }
  if (actor.role === Role.SUPERVISOR) {
    // Supervisor can manage if they belong to the department. 
    // If they have a sub-department, they are restricted by that in the list fetch anyway.
    return actor.departmentId === departmentId;
  }
  return false;
}

async function validatePublishScope(actor: Actor, departmentId: string, subDepartmentId: string | null) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null },
    select: { id: true, name: true, createdById: true },
  });
  if (!department) return { ok: false as const, message: "Selected department does not exist." };
  if (!canManageLibrarySop(actor, department.id, department.createdById)) {
    return { ok: false as const, message: "You cannot publish to that department." };
  }

  if (!subDepartmentId) {
    return { ok: true as const, departmentName: department.name, subDepartmentName: null };
  }

  const subDepartment = await prisma.subDepartment.findFirst({
    where: { id: subDepartmentId, departmentId: department.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!subDepartment) {
    return { ok: false as const, message: "Selected sub-department does not belong to that department." };
  }

  return {
    ok: true as const,
    departmentName: department.name,
    subDepartmentName: subDepartment.name,
  };
}

export type ManagedSopLibraryItem = {
  id: string;
  serialNo: string;
  title: string;
  status: DocumentStatus;
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
  sections: EditableSopSection[];
  preparedBy: string;
  approvedBy: string;
  contentDepartmentName: string;
  updatedAt: string;
  formData: any;
  /** Filled for list API when a pending approval exists (e.g. dept admin sees who submitted). */
  pendingApprovalRequesterName: string | null;
  pendingApprovalRequesterEmail: string | null;
};

export type ManagedSopLibraryListResult = {
  items: ManagedSopLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function mapManagedSopLibraryItem(doc: {
  id: string;
  serialNo: string;
  title: string;
  status: DocumentStatus;
  isPublished: boolean;
  hasEverBeenPublished: boolean;
  currentVersion: number;
  updatedAt: Date;
  departmentId: string;
  department: { name: string };
  subDepartmentId: string | null;
  subDepartment: { name: string } | null;
  latestVersionId: string | null;
  publishedVersionId: string | null;
  latestVersion: { content: unknown } | null;
  publishedVersion: { content: unknown } | null;
}, showPublishedVersion?: boolean): ManagedSopLibraryItem {
  // Determine which version to use:
  // - If showing published tab and document has publishedVersion, use publishedVersion
  // - Otherwise, use latestVersion (for drafts or backward compatibility)
  const shouldUsePublishedVersion = showPublishedVersion && doc.publishedVersion;
  const versionToUse = shouldUsePublishedVersion ? doc.publishedVersion : doc.latestVersion;
  
  const content = parseVersionContent(versionToUse?.content);
  const fallbackHeaderFields = extractSopHeaderFields(content.editableHtml?.trim() || "<p></p>");

  return {
    id: doc.id,
    serialNo: doc.serialNo,
    title: content.documentTitle?.trim() || doc.title,
    status: doc.status,
    isPublished: doc.isPublished,
    hasEverBeenPublished: doc.hasEverBeenPublished || Boolean(content.publishedAt),
    displayContext: showPublishedVersion ? "published" : "draft",
    currentVersion: doc.currentVersion,
    departmentId: doc.departmentId,
    departmentName: doc.department.name,
    subDepartmentId: doc.subDepartmentId,
    subDepartmentName: doc.subDepartment?.name ?? null,
    versionLabel: content.version?.trim() || String(doc.currentVersion),
    effectiveDate: content.effectiveDate?.trim() || "",
    sourceFileName: content.sourceFileName?.trim() || `${doc.title}.docx`,
    sourceFileUrl: content.sourceFileUrl?.trim() || null,
    sourceFormat: content.sourceFormat?.trim() || content.fileKind?.trim() || "DOCX",
    fileKind: content.fileKind?.trim() || "DOCX",
    editableHtml: sanitizeEditableHtml(content.editableHtml?.trim() || "<p></p>"),
    extractedText: content.extractedText?.trim() || htmlToPlainText(content.editableHtml?.trim() || ""),
    sections:
      Array.isArray(content.sections) && content.sections.length > 0
        ? content.sections.map((section, index) => ({
            id: typeof section.id === "string" ? section.id : `section-${index + 1}`,
            title: typeof section.title === "string" ? section.title : `Section ${index + 1}`,
            bodyHtml: sanitizeEditableHtml(typeof section.bodyHtml === "string" ? section.bodyHtml : "<p></p>"),
          }))
        : extractSectionsFromHtml(content.editableHtml?.trim() || "<p></p>"),
    preparedBy: content.preparedBy?.trim() || fallbackHeaderFields.preparedBy,
    approvedBy: content.approvedBy?.trim() || fallbackHeaderFields.approvedBy,
    contentDepartmentName: content.department?.trim() || fallbackHeaderFields.departmentName || doc.department.name,
    updatedAt: doc.updatedAt.toISOString(),
    formData: content.formData ?? null,
    pendingApprovalRequesterName: null,
    pendingApprovalRequesterEmail: null,
  };
}

export async function listManagedSopLibraryItems(input?: {
  page?: number;
  pageSize?: number;
  isPublished?: boolean;
  departmentId?: string;
  departmentIds?: string[];
  subDepartmentId?: string;
  createdById?: string;
}): Promise<ManagedSopLibraryListResult> {
  const requestedPageSize = input?.pageSize ?? 10;
  const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize) || 10, 1), 100);
  const requestedPage = input?.page ?? 1;
  const page = Math.max(Math.trunc(requestedPage) || 1, 1);

  const where: any = {
    type: DocumentType.SOP,
    deletedAt: null,
    serialNo: { startsWith: "SOP-UPL-" },
  };

  if (typeof input?.isPublished === "boolean") {
    if (input.isPublished) {
      // For published tab: show documents that have a published version
      // This includes both old workflow (isPublished=true) and new workflow (publishedVersionId is not null)
      where.OR = [
        { isPublished: true }, // Old workflow: published documents
        { publishedVersionId: { not: null } } // New workflow: documents with published version
      ];
    } else {
      // For draft tab: show documents that are not published (drafts)
      where.isPublished = false;
    }
  }
  if (input?.departmentId) {
    where.departmentId = input.departmentId;
  }
  if (input?.departmentIds && input.departmentIds.length > 0) {
    where.departmentId = { in: input.departmentIds };
  }
  if (input?.subDepartmentId) {
    where.subDepartmentId = input.subDepartmentId;
  }
  if (input?.createdById) {
    where.createdById = input.createdById;
  }

  const [total, docs] = await prisma.$transaction([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        serialNo: true,
        title: true,
        status: true,
        isPublished: true,
        hasEverBeenPublished: true,
        currentVersion: true,
        updatedAt: true,
        departmentId: true,
        department: { select: { name: true } },
        subDepartmentId: true,
        subDepartment: { select: { name: true } },
        latestVersionId: true,
        publishedVersionId: true,
        latestVersion: { select: { content: true } },
        publishedVersion: { select: { content: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  if (safePage !== page) {
    return listManagedSopLibraryItems({ 
      page: safePage, 
      pageSize, 
      isPublished: input?.isPublished,
      departmentId: input?.departmentId,
      departmentIds: input?.departmentIds,
      subDepartmentId: input?.subDepartmentId,
      createdById: input?.createdById
    });
  }

  const mapped = docs.filter((doc) => isSopLibraryUploadSerial(doc.serialNo)).map(doc => mapManagedSopLibraryItem(doc, input?.isPublished));
  const docIds = mapped.map((row) => row.id);
  let items = mapped;
  if (docIds.length > 0) {
    const pendingReqs = await prisma.approvalRequest.findMany({
      where: {
        documentId: { in: docIds },
        status: ApprovalStatus.PENDING,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        documentId: true,
        requester: { select: { name: true, email: true } },
      },
    });
    const requesterByDoc = new Map<string, { name: string; email: string }>();
    for (const row of pendingReqs) {
      if (!requesterByDoc.has(row.documentId)) {
        requesterByDoc.set(row.documentId, {
          name: row.requester.name,
          email: row.requester.email,
        });
      }
    }
    items = mapped.map((row) => {
      const req = requesterByDoc.get(row.id);
      if (!req) return row;
      return {
        ...row,
        pendingApprovalRequesterName: req.name,
        pendingApprovalRequesterEmail: req.email,
      };
    });
  }

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

async function attachPendingApprovalRequester(
  item: ManagedSopLibraryItem,
  documentId: string,
): Promise<ManagedSopLibraryItem> {
  const pending = await prisma.approvalRequest.findFirst({
    where: { documentId, status: ApprovalStatus.PENDING, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { requester: { select: { name: true, email: true } } },
  });
  if (!pending) return item;
  return {
    ...item,
    pendingApprovalRequesterName: pending.requester.name,
    pendingApprovalRequesterEmail: pending.requester.email,
  };
}

export async function getManagedSopLibraryItemForViewer(
  actor: Actor,
  documentId: string,
): Promise<{ ok: true; item: ManagedSopLibraryItem } | { ok: false; message: string }> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      serialNo: true,
      title: true,
      status: true,
      isPublished: true,
      hasEverBeenPublished: true,
      currentVersion: true,
      updatedAt: true,
      departmentId: true,
      subDepartmentId: true,
      latestVersionId: true,
      publishedVersionId: true,
      latestVersion: { select: { content: true } },
      publishedVersion: { select: { content: true } },
      department: { select: { name: true, createdById: true } },
      subDepartment: { select: { name: true } },
    },
  });

  if (!doc) return { ok: false, message: "Document not found" };

  const baseItem = mapManagedSopLibraryItem({
    ...doc,
    department: { name: doc.department.name },
    subDepartment: doc.subDepartment,
  });

  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) {
    return { ok: true, item: await attachPendingApprovalRequester(baseItem, doc.id) };
  }

  if (actor.role === Role.DEPARTMENT_ADMIN) {
    const managed = await getManagedDepartmentIdsForDeptAdmin(actor.id, actor.departmentId);
    if (!managed.includes(doc.departmentId)) {
      return { ok: false, message: "You cannot view this document" };
    }
    return { ok: true, item: await attachPendingApprovalRequester(baseItem, doc.id) };
  }

  if (actor.role === Role.SUPERVISOR) {
    if (actor.departmentId !== doc.departmentId) {
      return { ok: false, message: "You cannot view this document" };
    }
    if (actor.subDepartmentId && doc.subDepartmentId && actor.subDepartmentId !== doc.subDepartmentId) {
      return { ok: false, message: "You cannot view this document" };
    }
    return { ok: true, item: await attachPendingApprovalRequester(baseItem, doc.id) };
  }

  return { ok: false, message: "Forbidden" };
}

export async function updateManagedSopLibraryItem(
  actor: Actor,
  documentId: string,
  input: {
    title: string;
    effectiveDate: string;
    sections?: EditableSopSection[];
    editableHtml?: string;
    preparedBy?: string;
    approvedBy?: string;
    contentDepartmentName?: string;
    formData?: any;
  },
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      serialNo: true,
      title: true,
      status: true,
      isPublished: true,
      currentVersion: true,
      departmentId: true,
      createdById: true,
      latestVersionId: true,
      latestVersion: { select: { content: true } },
      createdAt: true,
      publishedAt: true,
    },
  });

  if (!doc || !isSopLibraryUploadSerial(doc.serialNo)) {
    return { ok: false, message: "SOP library item not found." };
  }
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) {
    // full access
  } else if (actor.role === Role.DEPARTMENT_ADMIN) {
    const managed = await getManagedDepartmentIdsForDeptAdmin(actor.id, actor.departmentId);
    if (!managed.includes(doc.departmentId)) {
      return { ok: false, message: "You cannot edit this SOP." };
    }
  } else if (!canManageLibrarySop(actor, doc.departmentId, doc.createdById)) {
    return { ok: false, message: "You cannot edit this SOP." };
  }
  if (!doc.latestVersionId) {
    return { ok: false, message: "Document version data is missing." };
  }

  const title = input.title.trim();
  const effectiveDate = input.effectiveDate.trim();
  const preparedBy = (input.preparedBy ?? "").trim();
  const approvedBy = (input.approvedBy ?? "").trim();
  const contentDepartmentName = (input.contentDepartmentName ?? "").trim();
  const sections = Array.isArray(input.sections) && input.sections.length > 0
    ? input.sections.map((section, index) => ({
        id: section.id?.trim() || `section-${index + 1}`,
        title: section.title.trim() || `Section ${index + 1}`,
        bodyHtml: sanitizeEditableHtml(section.bodyHtml || "<p></p>"),
      }))
    : extractSectionsFromHtml(input.editableHtml || "<p></p>");
  const editableHtml = buildHtmlFromSections(sections);

  if (!title || !effectiveDate) {
    return { ok: false, message: "Title and effective date are required." };
  }
  if (sections.length === 0) {
    return { ok: false, message: "At least one SOP section is required." };
  }

  const previousContent = parseVersionContent(doc.latestVersion?.content);
  
  // Get the actual maximum version number from the database to avoid conflicts
  const maxVersionRecord = await prisma.documentVersion.findFirst({
    where: { documentId: doc.id, deletedAt: null },
    select: { versionNumber: true },
    orderBy: { versionNumber: 'desc' },
  });
  
  const nextVersionNumber = (maxVersionRecord?.versionNumber || 0) + 1;
  
  // Calculate the next semantic version if this is an edit of a published SOP
  const isCurrentlyPublished = doc.isPublished;
  const nextSemanticVersion = isCurrentlyPublished 
    ? calculateNextVersion(
        previousContent.version || null,
        false, // Not a new SOP
        doc.createdAt,
        doc.publishedAt
      )
    : (previousContent.version || "1.0");
  
  const nextContent = {
    ...previousContent,
    documentTitle: title,
    version: nextSemanticVersion,
    effectiveDate,
    department: contentDepartmentName || previousContent.department || "",
    preparedBy,
    approvedBy,
    sections,
    editableHtml,
    extractedText: htmlToPlainText(editableHtml),
    formData: input.formData ?? previousContent.formData,
    editedAt: new Date().toISOString(),
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.documentVersion.updateMany({
        where: { documentId: doc.id, isLatest: true },
        data: { isLatest: false, updatedById: actor.id },
      });

      const versionRow = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: nextVersionNumber,
          content: nextContent,
          changeSummary: "Edited SOP library content",
          isLatest: true,
          createdById: actor.id,
        },
        select: { id: true },
      });

      await tx.approvalRequest.updateMany({
        where: { documentId: doc.id, status: ApprovalStatus.PENDING, deletedAt: null },
        data: { status: ApprovalStatus.CANCELLED },
      });

      // Check if this document is currently published
      const isCurrentlyPublished = doc.isPublished;
      
      await tx.document.update({
        where: { id: doc.id },
        data: {
          title,
          latestVersionId: versionRow.id,
          currentVersion: nextVersionNumber,
          updatedById: actor.id,
          // Preserve REJECTED and ADMIN_REJECTED status, otherwise set to DRAFT
          status: (doc.status === DocumentStatus.REJECTED || doc.status === DocumentStatus.ADMIN_REJECTED) 
            ? doc.status 
            : DocumentStatus.DRAFT,
          // Always set to unpublished when editing (will appear in draft tab)
          // But keep publishedVersionId if it was published (will also appear in published tab)
          isPublished: false,
          publishedAt: null,
          publishedById: null,
          // If currently published, set publishedVersionId to the previous latest version
          ...(isCurrentlyPublished && doc.latestVersionId ? {
            publishedVersionId: doc.latestVersionId
          } : {}),
        },
      });
    });
  } catch {
    return { ok: false, message: "Failed to save SOP changes." };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.UPDATE,
    entityType: "Document",
    entityId: doc.id,
    entityTitle: title,
    meta: { mode: "SOP_LIBRARY_EDIT", nextVersionNumber },
    req,
  });

  return { ok: true };
}

export async function publishManagedSopLibraryItem(
  actor: Actor,
  documentId: string,
  input: { departmentId: string; subDepartmentId: string | null },
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      serialNo: true,
      title: true,
      createdById: true,
      departmentId: true,
      latestVersionId: true,
      publishedVersionId: true,
      latestVersion: { select: { content: true } },
      createdAt: true,
      publishedAt: true,
      isPublished: true,
      hasEverBeenPublished: true,
    },
  });

  if (!doc || !isSopLibraryUploadSerial(doc.serialNo)) {
    return { ok: false, message: "SOP library item not found." };
  }

  const scope = await validatePublishScope(actor, input.departmentId, input.subDepartmentId);
  if (!scope.ok) return scope;

  const currentContent = parseVersionContent(doc.latestVersion?.content);
  
  // Calculate the next version
  const isNewSop = !doc.hasEverBeenPublished;
  
  // Check if this is a republish of an edited SOP that already has an incremented version
  const currentVersion = currentContent.version || null;
  const isEditedDraft = !doc.isPublished && doc.publishedVersionId && currentVersion;
  
  const nextVersion = isEditedDraft 
    ? currentVersion // Use existing version for edited drafts (don't double increment)
    : calculateNextVersion(
        currentVersion,
        isNewSop,
        doc.createdAt,
        doc.publishedAt
      );
  
  const nextContent = {
    ...currentContent,
    version: nextVersion,
    department: scope.departmentName,
    ...(scope.subDepartmentName ? { subDepartment: scope.subDepartmentName } : { subDepartment: undefined }),
    publishedAt: new Date().toISOString(),
  };

  try {
    await prisma.$transaction(async (tx) => {
      let newVersionId: string | null = null;
      let newVersionNumber: number | null = null;
      
      // Republish after editing a published SOP: update the draft row in place so history
      // shows one entry per semantic version (not separate "Edited" + "Republished" rows).
      if (doc.hasEverBeenPublished && doc.latestVersionId && isEditedDraft) {
        await tx.documentVersion.update({
          where: { id: doc.latestVersionId },
          data: {
            content: nextContent,
            updatedById: actor.id,
            changeSummary: `Version ${nextVersion} - Republished`,
            isLatest: true,
          },
        });
        const kept = await tx.documentVersion.findUnique({
          where: { id: doc.latestVersionId },
          select: { versionNumber: true },
        });
        newVersionId = doc.latestVersionId;
        newVersionNumber = kept?.versionNumber ?? 1;
      } else if (doc.hasEverBeenPublished && doc.latestVersionId) {
        // Other republish paths: new snapshot row
        await tx.documentVersion.update({
          where: { id: doc.latestVersionId },
          data: {
            isLatest: false,
          },
        });

        const currentVersionRecord = await tx.documentVersion.findUnique({
          where: { id: doc.latestVersionId },
          select: { versionNumber: true },
        });

        const newVersionRecord = await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            versionNumber: (currentVersionRecord?.versionNumber || 1) + 1,
            content: nextContent,
            changeSummary: `Version ${nextVersion} - Republished`,
            isLatest: true,
            createdById: actor.id,
          },
        });

        newVersionId = newVersionRecord.id;
        newVersionNumber = newVersionRecord.versionNumber;
      } else if (doc.latestVersionId) {
        // First publish - just update the existing version
        await tx.documentVersion.update({
          where: { id: doc.latestVersionId },
          data: {
            content: nextContent,
            updatedById: actor.id,
            changeSummary: `Version ${nextVersion} - First publication`,
          },
        });
        
        newVersionId = doc.latestVersionId;
      }

      // Get current document status to preserve approval level
      const currentDoc = await tx.document.findUnique({
        where: { id: doc.id },
        select: { status: true }
      });

      // Preserve the approval status (don't change ADMIN_APPROVED to APPROVED)
      let preservedStatus = currentDoc?.status || DocumentStatus.APPROVED;
      
      // Only change status to APPROVED if it's not already an approved status
      if (preservedStatus === DocumentStatus.PENDING_APPROVAL || 
          preservedStatus === DocumentStatus.PENDING_DEPT_ADMIN_APPROVAL || 
          preservedStatus === DocumentStatus.PENDING_ADMIN_APPROVAL ||
          preservedStatus === DocumentStatus.DRAFT) {
        preservedStatus = DocumentStatus.APPROVED;
      }

      await tx.document.update({
        where: { id: doc.id },
        data: {
          departmentId: input.departmentId,
          subDepartmentId: input.subDepartmentId,
          updatedById: actor.id,
          status: preservedStatus, // Preserve the approval status
          isPublished: true,
          hasEverBeenPublished: true,
          publishedAt: new Date(),
          publishedById: actor.id,
          ...(newVersionId ? { 
            latestVersionId: newVersionId,
            publishedVersionId: newVersionId, // Set the published version to the new version
            currentVersion: newVersionNumber || 1 // Update currentVersion to match the new version
          } : {
            publishedVersionId: doc.latestVersionId // For first publish, set published version to current latest
          }),
        },
      });

      // Complete any pending approval requests for this document
      // First get the pending approval requests to update them individually
      const pendingApprovals = await tx.approvalRequest.findMany({
        where: {
          documentId: doc.id,
          status: ApprovalStatus.PENDING,
          deletedAt: null,
        },
        include: {
          approver: { select: { role: true } },
        },
      });

      // Update each approval request with proper tracking
      for (const approval of pendingApprovals) {
        const updateData: any = {
          status: ApprovalStatus.APPROVED,
          actedAt: new Date(),
        };

        // If the approver is a department admin and this hasn't been escalated yet
        if (approval.approver.role === Role.DEPARTMENT_ADMIN && !approval.deptApprovedAt) {
          updateData.deptApprovedAt = new Date();
          updateData.deptApprovedById = actor.id;
        }

        await tx.approvalRequest.update({
          where: { id: approval.id },
          data: updateData,
        });
      }
    });
  } catch {
    return { ok: false, message: "Failed to publish SOP." };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.PUBLISH,
    entityType: "Document",
    entityId: doc.id,
    entityTitle: doc.title,
    meta: {
      mode: "SOP_LIBRARY_PUBLISH",
      departmentId: input.departmentId,
      subDepartmentId: input.subDepartmentId,
    },
    req,
  });

  return { ok: true };
}

export async function deleteManagedSopLibraryItem(
  actor: Actor,
  documentId: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      serialNo: true,
      title: true,
      departmentId: true,
      createdById: true,
      versions: { select: { content: true } },
    },
  });

  if (!doc || !isSopLibraryUploadSerial(doc.serialNo)) {
    return { ok: false, message: "SOP library item not found." };
  }
  if (!canManageLibrarySop(actor, doc.departmentId, doc.createdById)) {
    return { ok: false, message: "You cannot delete this SOP." };
  }

  const urls = doc.versions
    .map((version) => parseVersionContent(version.content).sourceFileUrl?.trim() || "")
    .filter(Boolean);
  const storageResult = await deleteSopFilesFromStorageForUrls(urls);
  if (!storageResult.ok) return storageResult;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.deleteMany({ where: { documentId: doc.id } });
      await tx.document.update({ where: { id: doc.id }, data: { latestVersionId: null } });
      await tx.documentVersion.deleteMany({ where: { documentId: doc.id } });
      await tx.document.delete({ where: { id: doc.id } });
    });
  } catch {
    return { ok: false, message: "Failed to delete SOP." };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.DELETE,
    entityType: "Document",
    entityId: doc.id,
    entityTitle: doc.title,
    meta: { mode: "SOP_LIBRARY_DELETE" },
    req,
  });

  return { ok: true };
}
