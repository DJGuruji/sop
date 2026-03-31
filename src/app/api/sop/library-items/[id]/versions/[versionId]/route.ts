import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isSopLibraryUploadSerial } from "@/lib/sop-library-upload";

const ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN, Role.SUPERVISOR];

export async function GET(req: Request, ctx: { params: Promise<{ id: string; versionId: string }> }) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id, versionId } = await ctx.params;
  
  // First verify the document exists and user has access
  const doc = await prisma.document.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      serialNo: true,
      title: true,
      departmentId: true,
      createdById: true,
    },
  });

  if (!doc || !isSopLibraryUploadSerial(doc.serialNo)) {
    return NextResponse.json(fail("NOT_FOUND", "SOP library item not found"), { status: 404 });
  }

  // Check access permissions (same logic as in other SOP endpoints)
  if (auth.actor.role === Role.SUPERVISOR) {
    if (auth.actor.departmentId !== doc.departmentId) {
      return NextResponse.json(fail("FORBIDDEN", "Access denied"), { status: 403 });
    }
  }

  // Fetch the specific version
  const version = await prisma.documentVersion.findFirst({
    where: {
      id: versionId,
      documentId: id,
      deletedAt: null,
    },
    select: {
      id: true,
      versionNumber: true,
      content: true,
      changeSummary: true,
      isLatest: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!version) {
    return NextResponse.json(fail("NOT_FOUND", "Version not found"), { status: 404 });
  }

  // Parse version content
  const content = version.content as any;
  const versionData = {
    id: version.id,
    versionNumber: version.versionNumber,
    versionLabel: content?.version || `v${version.versionNumber}`,
    changeSummary: version.changeSummary,
    isLatest: version.isLatest,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    // SOP content
    title: content?.documentTitle || doc.title,
    effectiveDate: content?.effectiveDate || "",
    department: content?.department || "",
    subDepartment: content?.subDepartment || "",
    preparedBy: content?.preparedBy || "",
    approvedBy: content?.approvedBy || "",
    editableHtml: content?.editableHtml || "",
    extractedText: content?.extractedText || "",
    sections: content?.sections || [],
    sourceFileName: content?.sourceFileName || "",
    sourceFileUrl: content?.sourceFileUrl || "",
    sourceFormat: content?.sourceFormat || "DOCX",
    fileKind: content?.fileKind || "DOCX",
  };

  return NextResponse.json(ok({ version: versionData }), { status: 200 });
}