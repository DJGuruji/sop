import { prisma } from "@/lib/prisma";
import { AuditAction, Role } from "@/generated/prisma/enums";
import { writeAuditLog } from "@/lib/audit";
import { canManageDepartmentScoped, type Actor } from "@/lib/authz";

type ListDepartmentsOpts = { search?: string; limit: number; offset: number };

export async function listDepartments(actor: Actor, req: Request, opts?: ListDepartmentsOpts) {
  if (actor.role === Role.SUPERVISOR && !actor.departmentId) {
    return { departments: [], total: 0 };
  }

  const baseWhere =
    actor.role === Role.SUPERVISOR && actor.departmentId
      ? { id: actor.departmentId, deletedAt: null }
      : actor.role === Role.DEPARTMENT_ADMIN && actor.departmentId
        ? { id: actor.departmentId, deletedAt: null }
        : actor.role === Role.DEPARTMENT_ADMIN && !actor.departmentId
          ? { createdById: actor.id, deletedAt: null }
          : { deletedAt: null };

  const search = opts?.search?.trim();
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const offset = Math.max(0, opts?.offset ?? 0);

  const where = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { subDepartments: { some: { name: { contains: search, mode: "insensitive" as const }, deletedAt: null } } },
        ],
      }
    : baseWhere;

  const [total, rows] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        updatedAt: true,
        subDepartments: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const departments = rows.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    subDepartments: d.subDepartments,
  }));

  return { departments, total };
}

export async function createDepartment(
  actor: Actor,
  input: { name: string },
  req: Request,
) {
  const department = await prisma.department.create({
    data: {
      name: input.name,
      createdById: actor.id,
    },
    select: { id: true, name: true, code: true, createdAt: true, updatedAt: true },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.CREATE,
    entityType: "Department",
    entityId: department.id,
    entityTitle: department.name,
    meta: { outcome: "ALLOW" },
    req,
  });

  return { department };
}

export async function updateDepartment(
  actor: Actor,
  id: string,
  input: { name?: string; code?: string | null },
  req: Request,
) {
  const existing = await prisma.department.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, createdById: true },
  });
  if (!existing || !canManageDepartmentScoped(actor, existing.id, existing.createdById)) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "Department",
      entityId: id,
      meta: { outcome: "DENY", reason: "FORBIDDEN" },
      req,
    });
    return { ok: false as const };
  }

  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(typeof input.name === "string" ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
    },
    select: { id: true, name: true, code: true, createdAt: true, updatedAt: true },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.UPDATE,
    entityType: "Department",
    entityId: department.id,
    entityTitle: department.name,
    meta: { outcome: "ALLOW" },
    req,
  });

  return { ok: true as const, department };
}

export async function softDeleteDepartment(actor: Actor, id: string, req: Request) {
  const existing = await prisma.department.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, createdById: true },
  });
  if (!existing || !canManageDepartmentScoped(actor, existing.id, existing.createdById)) {
    await writeAuditLog({
      actorId: actor.id,
      action: AuditAction.SOFT_DELETE,
      entityType: "Department",
      entityId: id,
      meta: { outcome: "DENY", reason: "FORBIDDEN" },
      req,
    });
    return { ok: false as const };
  }

  const department = await prisma.department.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true, name: true },
  });

  await writeAuditLog({
    actorId: actor.id,
    action: AuditAction.SOFT_DELETE,
    entityType: "Department",
    entityId: department.id,
    entityTitle: department.name,
    meta: { outcome: "ALLOW" },
    req,
  });

  return { ok: true as const };
}
