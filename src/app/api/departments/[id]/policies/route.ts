import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { getDepartmentPolicies } from "@/services/subDepartmentService";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const result = await getDepartmentPolicies(auth.actor, id);

  if (!result.ok) {
    return NextResponse.json(
      fail(result.reason, result.reason === "NOT_FOUND" ? "Department not found" : "Forbidden"),
      { status: result.reason === "NOT_FOUND" ? 404 : 403 },
    );
  }

  return NextResponse.json(ok(result), { status: 200 });
}
