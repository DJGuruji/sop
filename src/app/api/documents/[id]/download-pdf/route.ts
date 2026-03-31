import { NextResponse } from "next/server";
import { fail } from "@/lib/apiResponse";
import { ADMIN_PORTAL_ROLES, canManageDepartmentScoped, canViewSubDepartmentDocuments, requireActor } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { renderSopPdf } from "@/lib/sop-pdf";
import { DocumentType, Role } from "@/generated/prisma/enums";

type VersionContent = {
  documentTitle?: string;
  version?: string;
  effectiveDate?: string;
  department?: string;
  subDepartment?: string;
  editableHtml?: string;
};

function canViewDocument(actor: { role: Role; departmentId: string | null; subDepartmentId: string | null; id: string }, doc: {
  departmentId: string;
  subDepartmentId: string | null;
  departmentCreatedById: string | null;
}) {
  if (canManageDepartmentScoped(actor, doc.departmentId, doc.departmentCreatedById)) return true;
  if (actor.role === Role.SUPERVISOR && doc.subDepartmentId) {
    return canViewSubDepartmentDocuments(actor, doc.departmentId, doc.subDepartmentId, doc.departmentCreatedById);
  }
  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ADMIN_PORTAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const doc = await prisma.document.findFirst({
    where: { id, type: DocumentType.SOP, deletedAt: null },
    select: {
      id: true,
      title: true,
      departmentId: true,
      subDepartmentId: true,
      department: { select: { name: true, createdById: true } },
      subDepartment: { select: { name: true } },
      latestVersion: { select: { content: true } },
      isPublished: true,
    },
  });

  if (!doc) {
    return NextResponse.json(fail("NOT_FOUND", "Document not found"), { status: 404 });
  }
  if (!canViewDocument(auth.actor, {
    departmentId: doc.departmentId,
    subDepartmentId: doc.subDepartmentId,
    departmentCreatedById: doc.department.createdById,
  })) {
    return NextResponse.json(fail("FORBIDDEN", "Forbidden"), { status: 403 });
  }

  const content = (doc.latestVersion?.content ?? {}) as VersionContent;
  const editableHtml = typeof content.editableHtml === "string" ? content.editableHtml.trim() : "";
  if (!editableHtml) {
    return NextResponse.json(fail("VALIDATION_ERROR", "This SOP does not have editable content to export."), {
      status: 400,
    });
  }

  const departmentLabel = doc.subDepartment?.name
    ? `${doc.department.name} / ${doc.subDepartment.name}`
    : doc.department.name;

  const pdf = await renderSopPdf({
    title: content.documentTitle?.trim() || doc.title,
    version: content.version?.trim() || "1.0",
    effectiveDate: content.effectiveDate?.trim() || "",
    departmentLabel,
    editableHtml,
  });

  const fileName = `${(content.documentTitle?.trim() || doc.title).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "sop"}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
