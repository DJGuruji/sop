import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { updateUserBodySchema } from "@/validators/userValidators";
import { deleteUser, updateUser } from "@/services/userService";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  const parsed = updateUserBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });

  const { id } = await ctx.params;
  const result = await updateUser(auth.actor, id, parsed.data, req);
  if (!result.ok) {
    const status =
      result.reason === "NOT_FOUND"
        ? 404
        : result.reason === "DUPLICATE_EMAIL"
          ? 409
          : result.reason === "INVALID_DEPARTMENT"
            ? 400
            : 403;
    const message =
      result.reason === "DUPLICATE_EMAIL"
        ? "That email is already in use."
        : result.reason === "INVALID_DEPARTMENT"
          ? "Selected department is invalid."
          : result.reason;
    return NextResponse.json(fail(result.reason, message), { status });
  }

  return NextResponse.json(ok({ user: result.user }), { status: 200 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  const { id } = await ctx.params;
  const result = await deleteUser(auth.actor, id, req);
  if (!result.ok) {
    const reason = result.reason;
    const status =
      reason === "NOT_FOUND" ? 404 : reason === "FORBIDDEN" ? 403 : 400;
    const message =
      reason === "SELF_DELETE"
        ? "You cannot delete your own account."
        : reason === "LAST_SUPER_ADMIN"
          ? "Cannot remove the last Super Admin account."
          : reason === "DELETE_FAILED"
            ? "Could not delete user (related records may need attention)."
            : reason === "NOT_FOUND"
              ? "User not found."
              : reason === "FORBIDDEN"
                ? "Forbidden."
                : reason;
    return NextResponse.json(fail(reason, message), { status });
  }

  return NextResponse.json(ok({}), { status: 200 });
}

