import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { parseSopListTabParam } from "@/services/documentApprovalService";
import { getDepartmentLevelSops } from "@/services/subDepartmentService";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const tab = parseSopListTabParam(new URL(req.url).searchParams);
  const result = await getDepartmentLevelSops(auth.actor, id, tab);

  if (!result.ok) {
    return NextResponse.json(
      fail(result.reason, result.reason === "NOT_FOUND" ? "Department not found" : "Forbidden"),
      { status: result.reason === "NOT_FOUND" ? 404 : 403 },
    );
  }

  return NextResponse.json(
    ok({
      department: result.department,
      sops: result.sops,
      showSopTabs: result.showSopTabs,
    }),
    { status: 200 },
  );
}
