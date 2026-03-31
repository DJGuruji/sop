import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isSopLibraryUploadSerial } from "@/lib/sop-library-upload";

const ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN, Role.SUPERVISOR];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  
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

  // Fetch all versions for this document, ordered by version number descending
  const versions = await prisma.documentVersion.findMany({
    where: {
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
    orderBy: {
      versionNumber: "desc",
    },
  });

  /** One history row per semantic version (e.g. 1.1): keep the snapshot with the highest versionNumber
   *  so "Edited" + "Republished" pairs collapse to the published row for older data. */
  function semanticVersionKey(content: unknown): string {
    if (content && typeof content === "object" && !Array.isArray(content)) {
      const v = (content as Record<string, unknown>).version;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }

  const bestBySemantic = new Map<string, (typeof versions)[number]>();
  for (const version of versions) {
    const label = semanticVersionKey(version.content);
    const key = label || `__vn_${version.versionNumber}`;
    const prev = bestBySemantic.get(key);
    if (!prev || version.versionNumber > prev.versionNumber) {
      bestBySemantic.set(key, version);
    }
  }

  const versionsForDisplay = Array.from(bestBySemantic.values()).sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );

  // Parse version content to extract version labels
  const versionHistory = versionsForDisplay.map((version) => {
    const content = version.content as any;
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      versionLabel: content?.version || `v${version.versionNumber}`,
      changeSummary: version.changeSummary,
      isLatest: version.isLatest,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      // Include key content fields for preview
      title: content?.documentTitle || doc.title,
      effectiveDate: content?.effectiveDate || "",
      department: content?.department || "",
    };
  });

  return NextResponse.json(ok({ versions: versionHistory }), { status: 200 });
}