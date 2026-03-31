import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, SOP_SUBDEPARTMENT_VIEW_ROLES } from "@/lib/authz";
import { parseSopListTabParam } from "@/services/documentApprovalService";
import { getSubDepartmentDocuments } from "@/services/subDepartmentService";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(SOP_SUBDEPARTMENT_VIEW_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const tab = parseSopListTabParam(new URL(req.url).searchParams);
  const result = await getSubDepartmentDocuments(auth.actor, id, tab);

  if (!result.ok) {
    return NextResponse.json(
      fail(result.reason, result.reason === "NOT_FOUND" ? "Sub-department not found" : "Forbidden"),
      { status: result.reason === "NOT_FOUND" ? 404 : 403 },
    );
  }

  return NextResponse.json(
    ok({
      subDepartment: result.subDepartment,
      sops: result.sops,
      policies: result.policies,
      showSopTabs: result.showSopTabs,
    }),
    { status: 200 },
  );
}
