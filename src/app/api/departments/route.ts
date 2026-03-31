import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES, ORG_DIRECTORY_VIEW_ROLES } from "@/lib/authz";
import { createDepartmentBodySchema, listDepartmentsQuerySchema } from "@/validators/orgValidators";
import { createDepartment, listDepartments } from "@/services/departmentService";
import { Role } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  const auth = await requireActor(ORG_DIRECTORY_VIEW_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const url = new URL(req.url);
  const parsed = listDepartmentsQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  const opts = parsed.success ? parsed.data : { limit: 10, offset: 0, search: undefined };

  const { departments, total } = await listDepartments(auth.actor, req, opts);
  return NextResponse.json(ok({ departments, total }), { status: 200 });
}

export async function POST(req: Request) {
  const auth = await requireActor([Role.SUPER_ADMIN, Role.ADMIN]);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const parsed = createDepartmentBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });

  try {
    const result = await createDepartment(auth.actor, parsed.data, req);
    return NextResponse.json(ok(result), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("name")
    ) {
      return NextResponse.json(fail("CONFLICT", "Department name already exists"), { status: 409 });
    }

    throw error;
  }
}
