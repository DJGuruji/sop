import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { createUserBodySchema, listUsersQuerySchema } from "@/validators/userValidators";
import { createUser, listUsers } from "@/services/userService";

export async function GET(req: Request) {
  try {
    const auth = await requireActor(ADMIN_ROLES);
    if (!auth.ok) {
      return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
        status: auth.code === "UNAUTHORIZED" ? 401 : 403,
      });
    }

    const url = new URL(req.url);
    const parsed = listUsersQuerySchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    });
    const opts = parsed.success ? parsed.data : { limit: 10, offset: 0, search: undefined };

    const { users, total } = await listUsers(auth.actor, req, opts);
    return NextResponse.json(ok({ users, total }), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load users.";
    return NextResponse.json(fail("INTERNAL_SERVER_ERROR", message), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireActor(ADMIN_ROLES);
    if (!auth.ok) {
      return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
        status: auth.code === "UNAUTHORIZED" ? 401 : 403,
      });
    }

    const parsed = createUserBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });

    const result = await createUser(auth.actor, parsed.data, req);
    if (!result.ok) {
      const status =
        result.reason === "INVALID_DEPARTMENT" ? 400 : result.reason === "DUPLICATE_EMAIL" ? 409 : 403;
      const message =
        result.reason === "INVALID_DEPARTMENT"
          ? "Selected department is invalid."
          : result.reason === "DUPLICATE_EMAIL"
            ? "That email is already in use."
            : "Forbidden";
      return NextResponse.json(fail(result.reason, message), { status });
    }

    return NextResponse.json(ok({ user: result.user }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    return NextResponse.json(fail("INTERNAL_SERVER_ERROR", message), { status: 500 });
  }
}

