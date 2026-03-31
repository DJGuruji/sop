import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { updateDepartmentBodySchema } from "@/validators/orgValidators";
import { softDeleteDepartment, updateDepartment } from "@/services/departmentService";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const parsed = updateDepartmentBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });

  const result = await updateDepartment(auth.actor, id, parsed.data, req);
  if (!result.ok) return NextResponse.json(fail("FORBIDDEN", "Forbidden"), { status: 403 });

  return NextResponse.json(ok({ department: result.department }), { status: 200 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const result = await softDeleteDepartment(auth.actor, id, req);
  if (!result.ok) return NextResponse.json(fail("FORBIDDEN", "Forbidden"), { status: 403 });
  return NextResponse.json(ok({}), { status: 200 });
}

