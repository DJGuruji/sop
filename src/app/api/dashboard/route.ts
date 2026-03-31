import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DocumentType, ApprovalStatus } from "@/generated/prisma/enums";

export async function GET() {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  // Use a single transaction so all queries share one DB connection (avoids exhausting pool in Supabase session mode).
  const {
    totalSops,
    sopPublished,
    sopUnpublished,
    totalPolicies,
    policyPublished,
    policyUnpublished,
    pendingApprovals,
    departmentsWithCounts,
    recentDocs,
  } =
    await prisma.$transaction(async (tx) => {
      const [
        totalSops,
        sopPublished,
        sopUnpublished,
        pendingApprovals,
        departmentsWithCounts,
        recentDocs,
        totalPolicies,
        policyPublished,
        policyUnpublished,
      ] = await Promise.all([
        tx.document.count({ where: { type: DocumentType.SOP, deletedAt: null } }),
        tx.document.count({ where: { type: DocumentType.SOP, isPublished: true, deletedAt: null } }),
        tx.document.count({ where: { type: DocumentType.SOP, isPublished: false, deletedAt: null } }),
        tx.approvalRequest.count({ where: { status: ApprovalStatus.PENDING, deletedAt: null } }),
        tx.department.findMany({
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            _count: { select: { documents: true } },
          },
        }),
        tx.document.findMany({
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            serialNo: true,
            title: true,
            type: true,
            currentVersion: true,
            updatedAt: true,
            department: { select: { name: true } },
          },
        }),
        tx.document.count({ where: { type: DocumentType.POLICY, deletedAt: null } }),
        tx.document.count({ where: { type: DocumentType.POLICY, isPublished: true, deletedAt: null } }),
        tx.document.count({ where: { type: DocumentType.POLICY, isPublished: false, deletedAt: null } }),
      ]);
      return {
        totalSops,
        sopPublished,
        sopUnpublished,
        totalPolicies,
        policyPublished,
        policyUnpublished,
        pendingApprovals,
        departmentsWithCounts,
        recentDocs,
      };
    });

  const distribution = departmentsWithCounts.map((d) => ({
    id: d.id,
    name: d.name,
    count: d._count.documents,
  }));
  const totalDocs = totalSops + totalPolicies;
  const recentPolicies = recentDocs.map((d) => ({
    id: d.id,
    serialNo: d.serialNo,
    title: d.title,
    type: d.type,
    version: d.currentVersion,
    departmentName: d.department.name,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return NextResponse.json(
    ok({
      totalSops,
      totalPolicies,
      sopCounts: { total: totalSops, published: sopPublished, unpublished: sopUnpublished },
      policyCounts: { total: totalPolicies, published: policyPublished, unpublished: policyUnpublished },
      totalDocuments: totalDocs,
      pendingApprovals,
      upcomingReviews: 0,
      distribution,
      recentPolicies,
    }),
    { status: 200 },
  );
}
