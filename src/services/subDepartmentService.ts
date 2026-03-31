import { prisma } from "@/lib/prisma";
import { AuditAction, DocumentType, Role } from "@/generated/prisma/enums";
import { writeAuditLog } from "@/lib/audit";
import { SOP_LIBRARY_UPLOAD_SERIAL_PREFIX } from "@/lib/sop-library-upload";
import { canManageDepartmentScoped, canViewSubDepartmentDocuments, type Actor } from "@/lib/authz";
import {
  enrichSopRowsForActor,
  sopTabToDocumentWhere,
  type SopListTab,
} from "@/services/documentApprovalService";

/** All / Pending / Approved SOP tabs — same for department-level and sub-department lists. */
export function showSopApprovalTabs(actor: Actor): boolean {
  return (
    actor.role === Role.SUPER_ADMIN ||
    actor.role === Role.ADMIN ||
    actor.role === Role.DEPARTMENT_ADMIN ||
    actor.role === Role.SUPERVISOR
  );
}

type ListSubDepartmentsOpts = { search?: string; departmentId?: string; limit: number; offset: number };

export async function listSubDepartments(actor: Actor, req: Request, opts?: ListSubDepartmentsOpts) {
  if (actor.role === Role.SUPERVISOR) {
    if (!actor.subDepartmentId || !actor.departmentId) {
      return { subDepartments: [], total: 0 };
    }
    if (opts?.departmentId && opts.departmentId !== actor.departmentId) {
      return { subDepartments: [], total: 0 };
    }
  }

  if (
    actor.role === Role.DEPARTMENT_ADMIN &&
    actor.departmentId &&
    opts?.departmentId &&
    opts.departmentId !== actor.departmentId
  ) {
    return { subDepartments: [], total: 0 };
  }

  let baseWhere: { deletedAt: null; departmentId?: string; id?: string; department?: { createdById: string; deletedAt: null } } =
    { deletedAt: null };

  if (actor.role === Role.SUPERVISOR && actor.subDepartmentId && actor.departmentId) {
    baseWhere = {
      deletedAt: null,
      id: actor.subDepartmentId,
      departmentId: actor.departmentId,
    };
  } else if (actor.role === Role.DEPARTMENT_ADMIN && actor.departmentId) {
    baseWhere = { departmentId: actor.departmentId, deletedAt: null };
    if (opts?.departmentId) baseWhere.departmentId = opts.departmentId;
  } else if (actor.role === Role.DEPARTMENT_ADMIN && !actor.departmentId) {
    baseWhere = {
      deletedAt: null,
      department: { createdById: actor.id, deletedAt: null },
    };
    if (opts?.departmentId) baseWhere.departmentId = opts.departmentId;
  } else {
    if (opts?.departmentId) baseWhere.departmentId = opts.departmentId;
  }

  const search = opts?.search?.trim();
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const offset = Math.max(0, opts?.offset ?? 0);

  const where = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { department: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : baseWhere;

  const [total, subs] = await Promise.all([
    prisma.subDepartment.count({ where }),
    prisma.subDepartment.findMany({
      where,
      orderBy: [{ departmentId: "asc" }, { name: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        code: true,
        departmentId: true,
        department: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const subDepartments = subs.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    departmentId: s.departmentId,
    departmentName: s.department.name,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return { subDepartments, total };
}

export async function createSubDepartment(
  actor: Actor,
  input: {
    departmentId: string;
    name: string;
  },
  req: Request,
) {
  const parentDept = await prisma.department.findFirst({
    where: { id: input.departmentId, deletedAt: null },
    select: { id: true, createdById: true },
  });
  if (!parentDept || !canManageDepartmentScoped(actor, parentDept.id, parentDept.createdById)) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "SubDepartment",
      entityId: input.departmentId,
      meta: { outcome: "DENY", reason: "FORBIDDEN" },
      req,
    });
    return { ok: false as const };
  }

  const sub = await prisma.subDepartment.create({
    data: {
      departmentId: input.departmentId,
      name: input.name,
    },
    select: {
      id: true,
      name: true,
      code: true,
      departmentId: true,
      department: { select: { name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.CREATE,
    entityType: "SubDepartment",
    entityId: sub.id,
    entityTitle: sub.name,
    meta: { outcome: "ALLOW", departmentId: sub.departmentId },
    req,
  });

  return {
    ok: true as const,
    subDepartment: {
      id: sub.id,
      name: sub.name,
      code: sub.code,
      departmentId: sub.departmentId,
      departmentName: sub.department.name,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    },
  };
}

const sopListSelect = {
  id: true,
  serialNo: true,
  title: true,
  type: true,
  status: true,
  currentVersion: true,
  isPublished: true,
  updatedAt: true,
  createdById: true,
  departmentId: true,
  subDepartmentId: true,
  latestVersion: { select: { content: true } },
} as const;

function visibleDepartmentSopWhere(sopTab: SopListTab) {
  return {
    ...sopTabToDocumentWhere(sopTab),
    OR: [
      {
        serialNo: {
          not: {
            startsWith: SOP_LIBRARY_UPLOAD_SERIAL_PREFIX,
          },
        },
      },
      {
        serialNo: {
          startsWith: SOP_LIBRARY_UPLOAD_SERIAL_PREFIX,
        },
        isPublished: true,
      },
    ],
  };
}

function departmentSopScopeWhere(sopTab: SopListTab, departmentId: string) {
  return {
    departmentId,
    type: DocumentType.SOP,
    deletedAt: null,
    ...visibleDepartmentSopWhere(sopTab),
    AND: [
      {
        OR: [
          { subDepartmentId: null },
          { isPublished: true },
        ],
      },
    ],
  };
}

export async function getSubDepartmentDocuments(
  actor: Actor,
  id: string,
  sopTab: SopListTab = "ALL",
) {
  const subDepartment = await prisma.subDepartment.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      departmentId: true,
      department: { select: { id: true, name: true, createdById: true } },
      deletedAt: true,
    },
  });

  if (!subDepartment || subDepartment.deletedAt) {
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  if (
    !canViewSubDepartmentDocuments(
      actor,
      subDepartment.departmentId,
      subDepartment.id,
      subDepartment.department.createdById,
    )
  ) {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  const baseDeptSub = {
    departmentId: subDepartment.departmentId,
    subDepartmentId: subDepartment.id,
    deletedAt: null,
  };

  const [sopDocs, policyDocs] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...baseDeptSub,
        type: DocumentType.SOP,
        ...visibleDepartmentSopWhere(sopTab),
      },
      orderBy: [{ updatedAt: "desc" }],
      select: sopListSelect,
    }),
    prisma.document.findMany({
      where: {
        ...baseDeptSub,
        type: DocumentType.POLICY,
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        serialNo: true,
        title: true,
        type: true,
        status: true,
        currentVersion: true,
        isPublished: true,
        updatedAt: true,
      },
    }),
  ]);

  const enrichedSops = await enrichSopRowsForActor(actor, sopDocs);

  const policyRows = policyDocs.map((doc) => ({
    id: doc.id,
    serialNo: doc.serialNo,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    currentVersion: doc.currentVersion,
    isPublished: doc.isPublished,
    updatedAt: doc.updatedAt,
  }));

  return {
    ok: true as const,
    showSopTabs: showSopApprovalTabs(actor),
    subDepartment: {
      id: subDepartment.id,
      name: subDepartment.name,
      departmentId: subDepartment.department.id,
      departmentName: subDepartment.department.name,
    },
    sops: enrichedSops,
    policies: policyRows,
  };
}

/** SOPs tied to the department only (`subDepartmentId` null), e.g. uploads with no sub-department selected. */
export async function getDepartmentLevelSops(
  actor: Actor,
  departmentId: string,
  sopTab: SopListTab = "ALL",
) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, deletedAt: true, createdById: true },
  });

  if (!department || department.deletedAt) {
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  if (!canManageDepartmentScoped(actor, department.id, department.createdById)) {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  const sopDocs = await prisma.document.findMany({
    where: departmentSopScopeWhere(sopTab, department.id),
    orderBy: [{ updatedAt: "desc" }],
    select: sopListSelect,
  });

  const sops = await enrichSopRowsForActor(actor, sopDocs);

  return {
    ok: true as const,
    showSopTabs: showSopApprovalTabs(actor),
    department: { id: department.id, name: department.name },
    sops,
  };
}

export async function getDepartmentPolicies(actor: Actor, departmentId: string) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, deletedAt: true, createdById: true },
  });

  if (!department || department.deletedAt) {
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  if (!canManageDepartmentScoped(actor, department.id, department.createdById)) {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  const policies = await prisma.document.findMany({
    where: {
      departmentId: department.id,
      type: DocumentType.POLICY,
      deletedAt: null,
      isPublished: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      serialNo: true,
      title: true,
      status: true,
      currentVersion: true,
      isPublished: true,
      updatedAt: true,
      subDepartment: { select: { name: true } },
    },
  });

  return {
    ok: true as const,
    department: { id: department.id, name: department.name },
    policies: policies.map((doc) => ({
      id: doc.id,
      serialNo: doc.serialNo,
      title: doc.title,
      status: doc.status,
      currentVersion: doc.currentVersion,
      isPublished: doc.isPublished,
      updatedAt: doc.updatedAt,
      subDepartmentName: doc.subDepartment?.name ?? null,
    })),
  };
}

export async function updateSubDepartment(
  actor: Actor,
  id: string,
  input: { name?: string; code?: string | null },
  req: Request,
) {
  const existing = await prisma.subDepartment.findUnique({
    where: { id },
    select: { id: true, departmentId: true },
  });
  const parentDept = existing
    ? await prisma.department.findFirst({
        where: { id: existing.departmentId, deletedAt: null },
        select: { id: true, createdById: true },
      })
    : null;
  if (
    !existing ||
    !parentDept ||
    !canManageDepartmentScoped(actor, parentDept.id, parentDept.createdById)
  ) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "SubDepartment",
      entityId: id,
      meta: { outcome: "DENY", reason: existing ? "FORBIDDEN" : "NOT_FOUND" },
      req,
    });
    return { ok: false as const };
  }

  const sub = await prisma.subDepartment.update({
    where: { id },
    data: {
      ...(typeof input.name === "string" ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      departmentId: true,
      department: { select: { name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.UPDATE,
    entityType: "SubDepartment",
    entityId: sub.id,
    entityTitle: sub.name,
    meta: { outcome: "ALLOW" },
    req,
  });

  return {
    ok: true as const,
    subDepartment: {
      id: sub.id,
      name: sub.name,
      code: sub.code,
      departmentId: sub.departmentId,
      departmentName: sub.department.name,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    },
  };
}

export async function softDeleteSubDepartment(actor: Actor, id: string, req: Request) {
  const existing = await prisma.subDepartment.findUnique({
    where: { id },
    select: { id: true, name: true, departmentId: true },
  });
  const parentDept = existing
    ? await prisma.department.findFirst({
        where: { id: existing.departmentId, deletedAt: null },
        select: { id: true, createdById: true },
      })
    : null;
  if (
    !existing ||
    !parentDept ||
    !canManageDepartmentScoped(actor, parentDept.id, parentDept.createdById)
  ) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.SOFT_DELETE,
      entityType: "SubDepartment",
      entityId: id,
      meta: { outcome: "DENY", reason: existing ? "FORBIDDEN" : "NOT_FOUND" },
      req,
    });
    return { ok: false as const };
  }

  await prisma.subDepartment.update({ where: { id }, data: { deletedAt: new Date() } });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.SOFT_DELETE,
    entityType: "SubDepartment",
    entityId: existing.id,
    entityTitle: existing.name,
    meta: { outcome: "ALLOW" },
    req,
  });

  return { ok: true as const };
}
