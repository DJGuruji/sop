import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { softDeleteUnpublishedSop } from "@/services/documentApprovalService";

const ROLES = [Role.DEPARTMENT_ADMIN, Role.ADMIN, Role.SUPER_ADMIN];

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const result = await softDeleteUnpublishedSop(auth.actor, id, req);
  if (!result.ok) {
    const status =
      result.message.includes("not found") ? 404 : result.message.includes("cannot") ? 403 : 400;
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status });
  }

  return NextResponse.json(ok({ deleted: true }), { status: 200 });
}
