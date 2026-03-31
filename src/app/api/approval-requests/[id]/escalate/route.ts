import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { escalateApprovalToOrgAdmin } from "@/services/documentApprovalService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor();
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const body = (await req.json().catch(() => ({}))) as { targetUserId?: string };
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!targetUserId) {
    return NextResponse.json(fail("VALIDATION_ERROR", "targetUserId is required"), { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await escalateApprovalToOrgAdmin(auth.actor, id, targetUserId, req);
  if (!result.ok) {
    const status = result.message.includes("Only department") ? 403 : 400;
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status });
  }

  return NextResponse.json(ok({ escalated: true }), { status: 200 });
}
