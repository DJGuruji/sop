import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { rejectApprovalRequest } from "@/services/documentApprovalService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor();
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const body = (await req.json().catch(() => ({}))) as { remarks?: string };
  const { id } = await ctx.params;
  const result = await rejectApprovalRequest(auth.actor, id, body.remarks, req);
  if (!result.ok) {
    return NextResponse.json(fail("FORBIDDEN", result.message), { status: 403 });
  }

  return NextResponse.json(ok({ rejected: true }), { status: 200 });
}
