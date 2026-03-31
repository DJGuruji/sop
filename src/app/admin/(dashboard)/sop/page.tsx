import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getManagedDepartmentIdsForDeptAdmin, SOP_LIBRARY_UPLOAD_ROLES } from "@/lib/authz";
import { listManagedSopLibraryItems, type ManagedSopLibraryListResult } from "@/services/sopLibraryService";
import { SopLibrary } from "./sop-library";

type PageProps = {
  searchParams?: Promise<{ page?: string; p?: string; d?: string }> | { page?: string; p?: string; d?: string };
};

const SOP_LIBRARY_PAGE_SIZE = 10;

export default async function AdminSopPage({ searchParams }: PageProps) {
  const session = await getSession();
  const sp = await Promise.resolve(searchParams);
  const isSuperAdmin = session?.role === "SUPER_ADMIN";
  const isAdmin = session?.role === "ADMIN";
  const isDeptAdmin = session?.role === "DEPARTMENT_ADMIN";
  const isSupervisor = session?.role === "SUPERVISOR";
  const canUploadSopDocument =
    session?.role != null && SOP_LIBRARY_UPLOAD_ROLES.some((r) => r === session.role);

  let managedDepartmentIds: string[] = [];
  if (session?.sub && isAdmin) {
    const assignments = await prisma.userDepartmentAssignment.findMany({
      where: { userId: session.sub },
      select: { departmentId: true },
    });
    managedDepartmentIds = assignments.map((assignment) => assignment.departmentId);
  } else if (session?.sub && isDeptAdmin) {
    // Same scope as approvals: DB `departmentId`, assignments, and created departments (JWT can be stale).
    managedDepartmentIds = await getManagedDepartmentIdsForDeptAdmin(
      session.sub,
      session.departmentId ?? null,
    );
  }

  const deptFilter = isSupervisor && session?.departmentId ? session.departmentId : undefined;
  const subDeptFilter = isSupervisor && session?.subDepartmentId ? session.subDepartmentId : undefined;
  const creatorFilter = isSupervisor && session?.sub ? session.sub : undefined;

  // Independent pagination params: 'p' for published, 'd' for draft
  const pParam = Number(sp?.p);
  const dParam = Number(sp?.d);
  const pPage = Number.isFinite(pParam) && pParam > 0 ? Math.trunc(pParam) : 1;
  const dPage = Number.isFinite(dParam) && dParam > 0 ? Math.trunc(dParam) : 1;

  const emptyManagedDocuments: ManagedSopLibraryListResult = {
    items: [],
    total: 0,
    page: 1,
    pageSize: SOP_LIBRARY_PAGE_SIZE,
    totalPages: 1,
  };

  const hasManagementAccess = isSuperAdmin || isAdmin || isDeptAdmin || isSupervisor;

  /** Dept admin with no resolved scope must not query with an empty `in` list (that would skip filtering and show all org SOPs). */
  const deptAdminNoLibraryScope = isDeptAdmin && managedDepartmentIds.length === 0;

  const [publishedData, draftData, departments] = hasManagementAccess
    ? deptAdminNoLibraryScope
      ? [emptyManagedDocuments, emptyManagedDocuments, []]
      : await Promise.all([
          listManagedSopLibraryItems({
            page: pPage,
            pageSize: SOP_LIBRARY_PAGE_SIZE,
            isPublished: true,
            departmentId: isSupervisor ? undefined : deptFilter,
            departmentIds: (isAdmin || isDeptAdmin) ? managedDepartmentIds : undefined,
            subDepartmentId: isSupervisor ? undefined : subDeptFilter,
            createdById: creatorFilter,
          }),
          listManagedSopLibraryItems({
            page: dPage,
            pageSize: SOP_LIBRARY_PAGE_SIZE,
            isPublished: false,
            departmentId: isSupervisor ? undefined : deptFilter,
            departmentIds: (isAdmin || isDeptAdmin) ? managedDepartmentIds : undefined,
            subDepartmentId: isSupervisor ? undefined : subDeptFilter,
            createdById: creatorFilter,
          }),
          prisma.department.findMany({
            where: {
              deletedAt: null,
              ...(deptFilter ? { id: deptFilter } : {}),
              ...((isAdmin || isDeptAdmin) ? { id: { in: managedDepartmentIds } } : {}),
            },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              subDepartments: {
                where: {
                  deletedAt: null,
                  ...(subDeptFilter ? { id: subDeptFilter } : {}),
                },
                orderBy: { name: "asc" },
                select: { id: true, name: true },
              },
            },
          }),
        ])
    : [emptyManagedDocuments, emptyManagedDocuments, []];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="border-b border-slate-300 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Documents</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">SOP library</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Upload and manage the master SOP collection, separated into Published and Draft sections.
        </p>
      </header>

      <SopLibrary
        publishedItems={publishedData.items}
        draftItems={draftData.items}
        publishedPagination={{
          page: publishedData.page,
          pageSize: publishedData.pageSize,
          total: publishedData.total,
          totalPages: publishedData.totalPages,
        }}
        draftPagination={{
          page: draftData.page,
          pageSize: draftData.pageSize,
          total: draftData.total,
          totalPages: draftData.totalPages,
        }}
        departments={departments}
        isSuperAdmin={isSuperAdmin}
        isAdmin={isAdmin}
        isDeptAdmin={isDeptAdmin}
        isSupervisor={isSupervisor}
        canUploadSopDocument={canUploadSopDocument}
      />
    </div>
  );
}
