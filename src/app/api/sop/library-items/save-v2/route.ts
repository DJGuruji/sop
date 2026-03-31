import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { updateManagedSopLibraryItem } from "@/services/sopLibraryService";

const ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN, Role.SUPERVISOR];

export async function POST(req: Request) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    title?: string;
    version?: string;
    effectiveDate?: string;
    preparedBy?: string;
    approvedBy?: string;
    contentDepartmentName?: string;
    sections?: { id?: string; title?: string; bodyHtml?: string }[];
    editableHtml?: string;
    formData?: any;
  };

  const result = await updateManagedSopLibraryItem(
    auth.actor,
    typeof body.id === "string" ? body.id : "",
    {
      title: typeof body.title === "string" ? body.title : "",
      effectiveDate: typeof body.effectiveDate === "string" ? body.effectiveDate : "",
      preparedBy: typeof body.preparedBy === "string" ? body.preparedBy : "",
      approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : "",
      contentDepartmentName: typeof body.contentDepartmentName === "string" ? body.contentDepartmentName : "",
      sections: Array.isArray(body.sections)
        ? body.sections.map((section) => ({
            id: typeof section.id === "string" ? section.id : "",
            title: typeof section.title === "string" ? section.title : "",
            bodyHtml: typeof section.bodyHtml === "string" ? section.bodyHtml : "",
          }))
        : [],
      editableHtml: typeof body.editableHtml === "string" ? body.editableHtml : undefined,
      formData: body.formData,
    },
    req,
  );

  if (!result.ok) {
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status: 400 });
  }

  return NextResponse.json(ok({ saved: true }), { status: 200 });
}
