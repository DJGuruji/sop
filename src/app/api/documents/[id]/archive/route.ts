import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { archivePublishedSop } from "@/services/documentApprovalService";

const ROLES = [Role.DEPARTMENT_ADMIN, Role.ADMIN, Role.SUPER_ADMIN];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const { id } = await ctx.params;
  const result = await archivePublishedSop(auth.actor, id, typeof body.reason === "string" ? body.reason : "", req);
  if (!result.ok) {
    const status =
      result.message.includes("not found") ? 404 : result.message.includes("cannot") ? 403 : 400;
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status });
  }

  return NextResponse.json(ok({ archived: true }), { status: 200 });
}
