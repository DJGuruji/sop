import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AuditAction, Role } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { canManageDepartmentScoped, getManagedDepartmentIdsForDeptAdmin, type Actor } from "@/lib/authz";

function canCreateRole(actor: Actor, role: Role) {
  if (actor.role === Role.SUPER_ADMIN) return true;
  if (actor.role === Role.ADMIN) return role !== Role.SUPER_ADMIN;
  if (actor.role === Role.DEPARTMENT_ADMIN) return role === Role.SUPERVISOR || role === Role.EMPLOYEE;
  return false;
}

function departmentAdminManagesUserRecord(
  actor: Actor,
  u: {
    departmentId: string | null;
    department: { id: string; createdById: string | null } | null;
    subDepartment: {
      departmentId: string;
      department: { id: string; createdById: string | null };
    } | null;
  },
): boolean {
  if (actor.role !== Role.DEPARTMENT_ADMIN) return false;
  const deptId = u.departmentId ?? u.subDepartment?.departmentId ?? null;
  if (!deptId) return false;
  const createdById =
    u.department?.id === deptId
      ? u.department.createdById
      : u.subDepartment?.departmentId === deptId
        ? u.subDepartment.department.createdById
        : u.department?.createdById ?? u.subDepartment?.department.createdById ?? null;
  return canManageDepartmentScoped(actor, deptId, createdById);
}

type ListUsersOpts = { search?: string; limit: number; offset: number };

function normalizeDepartmentIds(ids: string[] | null | undefined) {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}

async function validateDepartmentIds(departmentIds: string[]) {
  if (departmentIds.length === 0) return [];
  const departments = await prisma.department.findMany({
    where: { id: { in: departmentIds }, deletedAt: null },
    select: { id: true, name: true },
  });
  if (departments.length !== departmentIds.length) return null;
  return departments;
}

async function listAdminDepartmentAssignments(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { departmentId: string; departmentName: string }[]>();

  try {
    const rows = await prisma.$queryRaw<
      { userId: string; departmentId: string; departmentName: string }[]
    >(
      Prisma.sql`
        SELECT
          uda."userId" AS "userId",
          uda."departmentId" AS "departmentId",
          d."name" AS "departmentName"
        FROM "UserDepartmentAssignment" uda
        INNER JOIN "Department" d ON d."id" = uda."departmentId"
        WHERE uda."userId" IN (${Prisma.join(userIds)})
        ORDER BY uda."createdAt" ASC
      `,
    );

    const assignmentMap = new Map<string, { departmentId: string; departmentName: string }[]>();
    for (const row of rows) {
      const existing = assignmentMap.get(row.userId) ?? [];
      existing.push({ departmentId: row.departmentId, departmentName: row.departmentName });
      assignmentMap.set(row.userId, existing);
    }
    return assignmentMap;
  } catch {
    return new Map<string, { departmentId: string; departmentName: string }[]>();
  }
}

async function replaceAdminDepartmentAssignments(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  userId: string,
  departmentIds: string[],
) {
  await tx.$executeRaw`DELETE FROM "UserDepartmentAssignment" WHERE "userId" = ${userId}`;
  if (departmentIds.length === 0) return;

  const values = departmentIds.map((departmentId) => Prisma.sql`(${randomUUID()}, ${userId}, ${departmentId})`);
  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO "UserDepartmentAssignment" ("id", "userId", "departmentId")
      VALUES ${Prisma.join(values)}
    `,
  );
}

function isDuplicateEmailError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("email")
  );
}

export async function listUsers(actor: Actor, req: Request, opts?: ListUsersOpts) {
  const search = opts?.search?.trim();
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const offset = Math.max(0, opts?.offset ?? 0);

  // SUPER_ADMIN / ADMIN: all active (non–soft-deleted) users. DEPARTMENT_ADMIN: scoped by managed departments.
  const andParts: Prisma.UserWhereInput[] = [{ deletedAt: null }];

  if (actor.role === Role.DEPARTMENT_ADMIN) {
    const managedIds = await getManagedDepartmentIdsForDeptAdmin(actor.id, actor.departmentId);
    if (managedIds.length > 0) {
      andParts.push({
        OR: [
          { departmentId: { in: managedIds } },
          { subDepartment: { departmentId: { in: managedIds }, deletedAt: null } },
        ],
      });
    } else {
      andParts.push({
        OR: [
          { department: { createdById: actor.id, deletedAt: null } },
          { subDepartment: { department: { createdById: actor.id, deletedAt: null }, deletedAt: null } },
        ],
      });
    }
  }

  if (search) {
    andParts.push({
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    });
  }

  const where: Prisma.UserWhereInput = andParts.length === 1 ? andParts[0]! : { AND: andParts };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        departmentId: true,
        subDepartmentId: true,
        createdAt: true,
        createdById: true,
        reportingToId: true,
        department: { select: { name: true } },
        subDepartment: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        reportingTo: { select: { name: true, email: true } },
      },
    }),
  ]);

  const adminAssignments = await listAdminDepartmentAssignments(users.map((u) => u.id));

  const list = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    departmentId: u.departmentId,
    departmentName: u.department?.name ?? null,
    adminDepartmentIds: (adminAssignments.get(u.id) ?? []).map((a) => a.departmentId),
    adminDepartmentNames: (adminAssignments.get(u.id) ?? []).map((a) => a.departmentName),
    subDepartmentId: u.subDepartmentId,
    subDepartmentName: u.subDepartment?.name ?? null,
    createdAt: u.createdAt,
    createdBy: u.createdBy ? { name: u.createdBy.name, email: u.createdBy.email } : null,
    reportingTo: u.reportingTo ? { name: u.reportingTo.name, email: u.reportingTo.email } : null,
  }));

  return { users: list, total };
}

export async function createUser(
  actor: Actor,
  input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    departmentId?: string | null;
    adminDepartmentIds?: string[] | null;
    subDepartmentId?: string | null;
    reportingToId?: string | null;
  },
  req: Request,
) {
  if (!canCreateRole(actor, input.role)) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "User",
      entityId: input.email,
      meta: { outcome: "DENY", reason: "ROLE_NOT_ALLOWED", targetRole: input.role },
      req,
    });
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  const adminDepartmentIds = normalizeDepartmentIds(input.adminDepartmentIds);
  const departmentId =
    input.role === Role.ADMIN ? (adminDepartmentIds[0] ?? null) : (input.departmentId ?? null);
  const departmentsToValidate =
    input.role === Role.ADMIN ? adminDepartmentIds : departmentId ? [departmentId] : [];
  const validDepartments = await validateDepartmentIds(departmentsToValidate);
  if (departmentsToValidate.length > 0 && !validDepartments) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "User",
      entityId: input.email,
      meta: { outcome: "DENY", reason: "INVALID_DEPARTMENT", departmentIds: departmentsToValidate },
      req,
    });
    return { ok: false as const, reason: "INVALID_DEPARTMENT" as const };
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: input.email.toLowerCase(), deletedAt: null },
    select: { id: true },
  });
  if (existingUser) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "User",
      entityId: input.email,
      meta: { outcome: "DENY", reason: "DUPLICATE_EMAIL" },
      req,
    });
    return { ok: false as const, reason: "DUPLICATE_EMAIL" as const };
  }

  if (departmentId && actor.role === Role.DEPARTMENT_ADMIN) {
    const d = await prisma.department.findFirst({
      where: { id: departmentId, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!d || !canManageDepartmentScoped(actor, d.id, d.createdById)) {
      await writeAuditLog({
        actorId: actor.id,
        action: AuditAction.CREATE,
        entityType: "User",
        entityId: input.email,
        meta: { outcome: "DENY", reason: "DEPARTMENT_SCOPE_FORBIDDEN", departmentId },
        req,
      });
      return { ok: false as const, reason: "FORBIDDEN" as const };
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash,
          role: input.role,
          isActive: true,
          departmentId,
          subDepartmentId: input.subDepartmentId ?? null,
          createdById: actor.id,
          reportingToId: input.reportingToId ?? null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          departmentId: true,
          subDepartmentId: true,
          createdAt: true,
        },
      });

      if (input.role === Role.ADMIN) {
        await replaceAdminDepartmentAssignments(tx, createdUser.id, adminDepartmentIds);
      }

      return createdUser;
    });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      await writeAuditLog({
        actorId: actor.id,
        action: AuditAction.CREATE,
        entityType: "User",
        entityId: input.email,
        meta: { outcome: "DENY", reason: "DUPLICATE_EMAIL" },
        req,
      });
      return { ok: false as const, reason: "DUPLICATE_EMAIL" as const };
    }
    throw error;
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.CREATE,
    entityType: "User",
    entityId: user.id,
    entityTitle: user.email,
    meta: { outcome: "ALLOW", role: user.role, departmentId: user.departmentId },
    req,
  });

  return { ok: true as const, user };
}

export async function setUserActive(actor: Actor, userId: string, isActive: boolean, req: Request) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      departmentId: true,
      deletedAt: true,
      department: { select: { id: true, createdById: true } },
      subDepartment: {
        select: { departmentId: true, department: { select: { id: true, createdById: true } } },
      },
    },
  });

  if (!existing || existing.deletedAt) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: userId,
      meta: { outcome: "DENY", reason: "NOT_FOUND" },
      req,
    });
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  const can =
    actor.role === Role.SUPER_ADMIN ||
    actor.role === Role.ADMIN ||
    departmentAdminManagesUserRecord(actor, existing);

  if (!can) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: existing.id,
      entityTitle: existing.email,
      meta: { outcome: "DENY", reason: "FORBIDDEN" },
      req,
    });
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { isActive },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.UPDATE,
    entityType: "User",
    entityId: existing.id,
    entityTitle: existing.email,
    meta: { outcome: "ALLOW", isActive },
    req,
  });

  return { ok: true as const };
}

export async function updateUser(
  actor: Actor,
  userId: string,
  input: {
    name?: string;
    email?: string;
    password?: string;
    role?: Role;
    departmentId?: string | null;
    adminDepartmentIds?: string[] | null;
    subDepartmentId?: string | null;
    reportingToId?: string | null;
  },
  req: Request,
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      departmentId: true,
      subDepartmentId: true,
      deletedAt: true,
      department: { select: { id: true, createdById: true } },
      subDepartment: {
        select: { departmentId: true, department: { select: { id: true, createdById: true } } },
      },
    },
  });

  if (!existing || existing.deletedAt) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: userId,
      meta: { outcome: "DENY", reason: "NOT_FOUND" },
      req,
    });
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  const can =
    actor.role === Role.SUPER_ADMIN ||
    actor.role === Role.ADMIN ||
    departmentAdminManagesUserRecord(actor, existing);

  if (!can) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: existing.id,
      entityTitle: existing.email,
      meta: { outcome: "DENY", reason: "FORBIDDEN" },
      req,
    });
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  // Allow role changes only for Super/Admin. Department Admin can only edit within dept.
  if (input.role && actor.role === Role.DEPARTMENT_ADMIN) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: existing.id,
      entityTitle: existing.email,
      meta: { outcome: "DENY", reason: "ROLE_CHANGE_FORBIDDEN" },
      req,
    });
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  const nextRole = input.role ?? existing.role;
  const currentAdminAssignments = await listAdminDepartmentAssignments([existing.id]);
  const requestedAdminDepartmentIds =
    input.adminDepartmentIds !== undefined
      ? normalizeDepartmentIds(input.adminDepartmentIds)
      : (currentAdminAssignments.get(existing.id) ?? []).map((a) => a.departmentId);
  const nextDepartmentId =
    nextRole === Role.ADMIN
      ? (requestedAdminDepartmentIds[0] ?? null)
      : input.departmentId !== undefined
        ? input.departmentId
        : existing.departmentId;
  const departmentsToValidate =
    nextRole === Role.ADMIN
      ? requestedAdminDepartmentIds
      : nextDepartmentId
        ? [nextDepartmentId]
        : [];
  const validDepartments = await validateDepartmentIds(departmentsToValidate);
  if (departmentsToValidate.length > 0 && !validDepartments) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: existing.id,
      entityTitle: existing.email,
      meta: { outcome: "DENY", reason: "INVALID_DEPARTMENT", departmentIds: departmentsToValidate },
      req,
    });
    return { ok: false as const, reason: "INVALID_DEPARTMENT" as const };
  }

  if (actor.role === Role.DEPARTMENT_ADMIN) {
    const nextDeptId = nextDepartmentId;
    const nextSubId =
      input.subDepartmentId !== undefined ? input.subDepartmentId : existing.subDepartmentId;
    if (nextDeptId) {
      const d = await prisma.department.findFirst({
        where: { id: nextDeptId, deletedAt: null },
        select: { id: true, createdById: true },
      });
      if (!d || !canManageDepartmentScoped(actor, d.id, d.createdById)) {
        await writeAuditLog({
          actorId: actor.id,
          action: AuditAction.UPDATE,
          entityType: "User",
          entityId: existing.id,
          entityTitle: existing.email,
          meta: { outcome: "DENY", reason: "DEPARTMENT_SCOPE_FORBIDDEN" },
          req,
        });
        return { ok: false as const, reason: "FORBIDDEN" as const };
      }
    }
    if (nextSubId) {
      const sub = await prisma.subDepartment.findFirst({
        where: { id: nextSubId, deletedAt: null },
        select: { departmentId: true, department: { select: { createdById: true } } },
      });
      if (
        !sub ||
        !canManageDepartmentScoped(actor, sub.departmentId, sub.department.createdById)
      ) {
        await writeAuditLog({
          actorId: actor.id,
          action: AuditAction.UPDATE,
          entityType: "User",
          entityId: existing.id,
          entityTitle: existing.email,
          meta: { outcome: "DENY", reason: "SUBDEPARTMENT_SCOPE_FORBIDDEN" },
          req,
        });
        return { ok: false as const, reason: "FORBIDDEN" as const };
      }
    }
  }

  let nextEmail: string | undefined;
  if (input.email !== undefined) {
    nextEmail = input.email.trim().toLowerCase();
    if (nextEmail !== existing.email.toLowerCase()) {
      const taken = await prisma.user.findFirst({
        where: { email: nextEmail, id: { not: existing.id } },
        select: { id: true },
      });
      if (taken) {
        await writeAuditLog({
          actorId: actor.id,
          action: AuditAction.UPDATE,
          entityType: "User",
          entityId: existing.id,
          entityTitle: existing.email,
          meta: { outcome: "DENY", reason: "DUPLICATE_EMAIL" },
          req,
        });
        return { ok: false as const, reason: "DUPLICATE_EMAIL" as const };
      }
    }
  }

  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: existing.id },
      data: {
        ...(typeof input.name === "string" ? { name: input.name } : {}),
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.departmentId !== undefined || input.role !== undefined || input.adminDepartmentIds !== undefined
          ? { departmentId: nextDepartmentId }
          : {}),
        ...((input.subDepartmentId !== undefined || input.role !== undefined) && nextRole === Role.ADMIN
          ? { subDepartmentId: null }
          : input.subDepartmentId !== undefined
            ? { subDepartmentId: input.subDepartmentId }
            : {}),
        ...(input.reportingToId !== undefined ? { reportingToId: input.reportingToId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        departmentId: true,
        subDepartmentId: true,
        createdAt: true,
      },
    });

    if (nextRole === Role.ADMIN || input.adminDepartmentIds !== undefined || input.role !== undefined) {
      await replaceAdminDepartmentAssignments(tx, existing.id, nextRole === Role.ADMIN ? requestedAdminDepartmentIds : []);
    }

    return updatedUser;
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.UPDATE,
    entityType: "User",
    entityId: updated.id,
    entityTitle: updated.email,
    meta: {
      outcome: "ALLOW",
      ...(nextEmail !== undefined && nextEmail !== existing.email.toLowerCase()
        ? { emailChanged: true }
        : {}),
      ...(passwordHash !== undefined ? { passwordChanged: true } : {}),
    },
    req,
  });

  return { ok: true as const, user: updated };
}

export async function deleteUser(actor: Actor, userId: string, req: Request) {
  if (actor.role === Role.DEPARTMENT_ADMIN) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: userId,
      meta: { outcome: "DENY", reason: "DEPARTMENT_ADMIN_CANNOT_DELETE_USERS" },
      req,
    });
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      departmentId: true,
      subDepartmentId: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: userId,
      meta: { outcome: "DENY", reason: "NOT_FOUND" },
      req,
    });
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  const can = actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN;

  if (!can) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: user.id,
      entityTitle: user.email,
      meta: { outcome: "DENY", reason: "FORBIDDEN" },
      req,
    });
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  if (user.id === actor.id) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: user.id,
      entityTitle: user.email,
      meta: { outcome: "DENY", reason: "SELF_DELETE" },
      req,
    });
    return { ok: false as const, reason: "SELF_DELETE" as const };
  }

  if (user.role === Role.SUPER_ADMIN) {
    const superAdminCount = await prisma.user.count({
      where: { role: Role.SUPER_ADMIN, deletedAt: null },
    });
    if (superAdminCount <= 1) {
      await writeAuditLog({
        actorId: actor.id,
        action: AuditAction.DELETE,
        entityType: "User",
        entityId: user.id,
        entityTitle: user.email,
        meta: { outcome: "DENY", reason: "LAST_SUPER_ADMIN" },
        req,
      });
      return { ok: false as const, reason: "LAST_SUPER_ADMIN" as const };
    }
  }

  const reassignToId = actor.id;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.deleteMany({
        where: { OR: [{ requesterId: user.id }, { approverId: user.id }] },
      });
      await tx.documentVersion.updateMany({
        where: { createdById: user.id },
        data: { createdById: reassignToId },
      });
      await tx.document.updateMany({
        where: { createdById: user.id },
        data: { createdById: reassignToId },
      });
      await tx.document.updateMany({
        where: { publishedById: user.id },
        data: { publishedById: reassignToId },
      });
      await tx.user.delete({ where: { id: user.id } });
    });
  } catch (e) {
    console.error("[deleteUser] failed:", e);
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: user.id,
      entityTitle: user.email,
      meta: { outcome: "DENY", reason: "DELETE_FAILED" },
      req,
    });
    return { ok: false as const, reason: "DELETE_FAILED" as const };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.DELETE,
    entityType: "User",
    entityId: user.id,
    entityTitle: user.email,
    meta: { outcome: "ALLOW", mode: "HARD_DELETE" },
    req,
  });

  return { ok: true as const };
}

