import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { publishManagedSopLibraryItem } from "@/services/sopLibraryService";

const ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const body = (await req.json().catch(() => ({}))) as {
    departmentId?: string;
    subDepartmentId?: string | null;
  };
  const { id } = await ctx.params;
  const result = await publishManagedSopLibraryItem(
    auth.actor,
    id,
    {
      departmentId: typeof body.departmentId === "string" ? body.departmentId : "",
      subDepartmentId:
        typeof body.subDepartmentId === "string" && body.subDepartmentId.trim() ? body.subDepartmentId : null,
    },
    req,
  );

  if (!result.ok) {
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status: 400 });
  }

  return NextResponse.json(ok({ published: true }), { status: 200 });
}
