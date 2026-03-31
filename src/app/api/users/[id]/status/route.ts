import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { updateUserStatusBodySchema } from "@/validators/userValidators";
import { setUserActive } from "@/services/userService";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const parsed = updateUserStatusBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });

  const { id } = await ctx.params;
  const result = await setUserActive(auth.actor, id, parsed.data.isActive, req);
  if (!result.ok) {
    const status = result.reason === "NOT_FOUND" ? 404 : result.reason === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(fail(result.reason, result.reason), { status });
  }

  return NextResponse.json(ok({}), { status: 200 });
}

