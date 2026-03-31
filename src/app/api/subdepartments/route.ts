import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES, ORG_DIRECTORY_VIEW_ROLES } from "@/lib/authz";
import { createSubDepartmentBodySchema, listSubDepartmentsQuerySchema } from "@/validators/orgValidators";
import { createSubDepartment, listSubDepartments } from "@/services/subDepartmentService";

export async function GET(req: Request) {
  const auth = await requireActor(ORG_DIRECTORY_VIEW_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const url = new URL(req.url);
  const parsed = listSubDepartmentsQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    departmentId: url.searchParams.get("departmentId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  const opts = parsed.success ? parsed.data : { limit: 10, offset: 0, search: undefined, departmentId: undefined };

  const { subDepartments, total } = await listSubDepartments(auth.actor, req, opts);
  return NextResponse.json(ok({ subDepartments, total }), { status: 200 });
}

export async function POST(req: Request) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const parsed = createSubDepartmentBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });

  const result = await createSubDepartment(auth.actor, parsed.data, req);
  if (!result.ok) return NextResponse.json(fail("FORBIDDEN", "Forbidden"), { status: 403 });

  return NextResponse.json(ok({ subDepartment: result.subDepartment }), { status: 201 });
}
