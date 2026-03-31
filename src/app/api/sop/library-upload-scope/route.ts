import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { getManagedDepartmentIdsForDeptAdmin, requireActor, SOP_LIBRARY_UPLOAD_ROLES } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

export async function GET() {
  const auth = await requireActor(SOP_LIBRARY_UPLOAD_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  const { role, departmentId, subDepartmentId } = auth.actor;

  const subSelect = {
    where: { deletedAt: null },
    orderBy: { name: "asc" as const },
    select: { id: true, name: true },
  };

  if (role === Role.SUPER_ADMIN || role === Role.ADMIN) {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        subDepartments: subSelect,
      },
    });
    return NextResponse.json(ok({ role, departments }), { status: 200 });
  }

  if (role === Role.DEPARTMENT_ADMIN) {
    const managedIds = await getManagedDepartmentIdsForDeptAdmin(auth.actor.id, departmentId);
    if (managedIds.length === 0) {
      return NextResponse.json(ok({ role, departments: [] }), { status: 200 });
    }
    const departments = await prisma.department.findMany({
      where: { id: { in: managedIds }, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        subDepartments: subSelect,
      },
    });
    return NextResponse.json(ok({ role, departments }), { status: 200 });
  }

  if (role === Role.SUPERVISOR) {
    if (!departmentId || !subDepartmentId) {
      return NextResponse.json(ok({ role, departments: [] }), { status: 200 });
    }
    const sub = await prisma.subDepartment.findFirst({
      where: { id: subDepartmentId, departmentId, deletedAt: null },
      select: { id: true, name: true, department: { select: { id: true, name: true } } },
    });
    if (!sub) {
      return NextResponse.json(ok({ role, departments: [] }), { status: 200 });
    }
    const departments = [
      {
        id: sub.department.id,
        name: sub.department.name,
        subDepartments: [{ id: sub.id, name: sub.name }],
      },
    ];
    return NextResponse.json(ok({ role, departments }), { status: 200 });
  }

  return NextResponse.json(ok({ role, departments: [] }), { status: 200 });
}
