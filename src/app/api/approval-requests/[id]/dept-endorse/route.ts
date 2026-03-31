import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { endorseDeptApprovalRequest } from "@/services/documentApprovalService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor();
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const result = await endorseDeptApprovalRequest(auth.actor, id, req);
  if (!result.ok) {
    return NextResponse.json(fail("FORBIDDEN", result.message), { status: 403 });
  }

  return NextResponse.json(ok({ endorsed: true }), { status: 200 });
}
