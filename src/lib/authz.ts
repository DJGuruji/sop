import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

export type Actor = {
  id: string;
  role: Role;
  departmentId: string | null;
  subDepartmentId: string | null;
};

export type AuthzResult =
  | { ok: true; actor: Actor }
  | { ok: false; code: "UNAUTHORIZED" | "FORBIDDEN" };

export async function requireActor(allowedRoles?: Role[]): Promise<AuthzResult> {
  const session = await getSession();
  if (!session?.sub) return { ok: false, code: "UNAUTHORIZED" };

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      role: true,
      isActive: true,
      departmentId: true,
      subDepartmentId: true,
    },
  });

  if (!user?.isActive) return { ok: false, code: "UNAUTHORIZED" };
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  return {
    ok: true,
    actor: {
      id: user.id,
      role: user.role,
      departmentId: user.departmentId ?? null,
      subDepartmentId: user.subDepartmentId ?? null,
    },
  };
}

export const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN];

/** Roles allowed to list audit logs (CSV export remains restricted in its route). */
export const AUDIT_LOG_VIEW_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.DEPARTMENT_ADMIN,
  Role.SUPERVISOR,
];

/**
 * Department admin may manage a department if they are assigned to it, or if they created it
 * (covers users with role DEPARTMENT_ADMIN but missing `departmentId` in DB).
 */
export function canManageDepartmentScoped(
  actor: Actor,
  departmentId: string,
  departmentCreatedById: string | null | undefined,
): boolean {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) return true;
  if (actor.role === Role.DEPARTMENT_ADMIN) {
    if (actor.departmentId === departmentId) return true;
    if (departmentCreatedById && departmentCreatedById === actor.id) return true;
    return false;
  }
  return false;
}

export function canViewSubDepartmentDocuments(
  actor: Actor,
  departmentId: string,
  subDepartmentId: string,
  departmentCreatedById?: string | null,
): boolean {
  if (canManageDepartmentScoped(actor, departmentId, departmentCreatedById)) return true;
  if (
    actor.role === Role.SUPERVISOR &&
    actor.departmentId === departmentId &&
    actor.subDepartmentId === subDepartmentId
  ) {
    return true;
  }
  return false;
}

/** Roles allowed to use /admin after login (excludes EMPLOYEE). */
export const ADMIN_PORTAL_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.DEPARTMENT_ADMIN,
  Role.SUPERVISOR,
];

/**
 * Read-only org navigation (departments / sub-departments lists) for supervisors
 * in addition to admin roles.
 */
export const ORG_DIRECTORY_VIEW_ROLES: Role[] = [...ADMIN_ROLES, Role.SUPERVISOR];

/** Roles that may upload documents from the SOP library UI (scoped by org). */
export const SOP_LIBRARY_UPLOAD_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.DEPARTMENT_ADMIN,
  Role.SUPERVISOR,
];

/** View SOP/policy lists on sub-department pages (includes supervisors for their sub). */
export const SOP_SUBDEPARTMENT_VIEW_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.DEPARTMENT_ADMIN,
  Role.SUPERVISOR,
];

/** Departments a department admin may act on: primary `departmentId`, explicit assignments, and departments they created. */
export async function getManagedDepartmentIdsForDeptAdmin(
  actorId: string,
  primaryDepartmentIdFromSession: string | null | undefined,
): Promise<string[]> {
  const ids = new Set<string>();
  if (primaryDepartmentIdFromSession) ids.add(primaryDepartmentIdFromSession);

  const [userRow, assignments, created] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorId },
      select: { departmentId: true },
    }),
    prisma.userDepartmentAssignment.findMany({
      where: { userId: actorId },
      select: { departmentId: true },
    }),
    prisma.department.findMany({
      where: { createdById: actorId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (userRow?.departmentId) ids.add(userRow.departmentId);
  for (const row of assignments) ids.add(row.departmentId);
  for (const row of created) ids.add(row.id);

  return [...ids];
}

