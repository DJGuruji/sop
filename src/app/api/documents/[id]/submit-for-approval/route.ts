import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { submitSopForApproval } from "@/services/documentApprovalService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor();
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;

  let approverUserId: string | undefined;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const raw = (await req.json().catch(() => ({}))) as { approverUserId?: unknown };
    approverUserId =
      typeof raw.approverUserId === "string" && raw.approverUserId.trim()
        ? raw.approverUserId.trim()
        : undefined;
  }

  const result = await submitSopForApproval(auth.actor, id, { approverUserId }, req);
  if (!result.ok) {
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status: 400 });
  }

  return NextResponse.json(ok({ submitted: true }), { status: 200 });
}
