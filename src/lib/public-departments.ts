import { unstable_noStore as noStore } from "next/cache";
import { DocumentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type PublicDepartmentSummary = {
  id: string;
  name: string;
  code: string | null;
  sopCount: number;
};

export type PublicSopSummary = {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  subDepartmentId: string | null;
  subDepartmentName: string | null;
  updatedAt: string;
};

export type PublicSubDepartmentSummary = {
  id: string;
  name: string;
  code: string | null;
  departmentId: string;
  sopCount: number;
};

type VersionContent = {
  documentTitle?: string;
  version?: string;
  effectiveDate?: string;
  editableHtml?: string;
};

export async function getPublicDepartmentSummaries(limit?: number): Promise<PublicDepartmentSummary[]> {
  noStore();

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    ...(typeof limit === "number" ? { take: limit } : {}),
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          documents: {
            where: {
              deletedAt: null,
              type: DocumentType.SOP,
              isPublished: true,
            },
          },
        },
      },
    },
  });

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: department.code,
    sopCount: department._count.documents,
  }));
}

export async function getPublicSopSummaries(): Promise<PublicSopSummary[]> {
  noStore();

  const sops = await prisma.document.findMany({
    where: {
      deletedAt: null,
      type: DocumentType.SOP,
      isPublished: true,
      department: { deletedAt: null },
    },
    orderBy: [{ title: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      departmentId: true,
      subDepartmentId: true,
      updatedAt: true,
      department: {
        select: {
          name: true,
        },
      },
      subDepartment: {
        select: {
          name: true,
        },
      },
    },
  });

  return sops.map((sop) => ({
    id: sop.id,
    title: sop.title,
    departmentId: sop.departmentId,
    departmentName: sop.department.name,
    subDepartmentId: sop.subDepartmentId,
    subDepartmentName: sop.subDepartment?.name ?? null,
    updatedAt: sop.updatedAt.toISOString(),
  }));
}

export async function getPublicDepartmentSubDepartments(
  departmentId: string,
): Promise<{ department: PublicDepartmentSummary | null; subDepartments: PublicSubDepartmentSummary[] }> {
  noStore();

  const department = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          documents: {
            where: {
              deletedAt: null,
              type: DocumentType.SOP,
              isPublished: true,
            },
          },
        },
      },
    },
  });

  if (!department) {
    return { department: null, subDepartments: [] };
  }

  const subDepartments = await prisma.subDepartment.findMany({
    where: {
      departmentId,
      deletedAt: null,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      departmentId: true,
      _count: {
        select: {
          documents: {
            where: {
              deletedAt: null,
              type: DocumentType.SOP,
              isPublished: true,
            },
          },
        },
      },
    },
  });

  return {
    department: {
      id: department.id,
      name: department.name,
      code: department.code,
      sopCount: department._count.documents,
    },
    subDepartments: subDepartments.map((subDepartment) => ({
      id: subDepartment.id,
      name: subDepartment.name,
      code: subDepartment.code,
      departmentId: subDepartment.departmentId,
      sopCount: subDepartment._count.documents,
    })),
  };
}

export async function getPublicSubDepartmentSops(
  departmentId: string,
  subDepartmentId: string,
): Promise<{
  department: PublicDepartmentSummary | null;
  subDepartment: PublicSubDepartmentSummary | null;
  sops: PublicSopSummary[];
}> {
  noStore();

  const [department, subDepartment, sops] = await Promise.all([
    prisma.department.findFirst({
      where: { id: departmentId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        _count: {
          select: {
            documents: {
              where: {
                deletedAt: null,
                type: DocumentType.SOP,
                isPublished: true,
              },
            },
          },
        },
      },
    }),
    prisma.subDepartment.findFirst({
      where: { id: subDepartmentId, departmentId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        departmentId: true,
        _count: {
          select: {
            documents: {
              where: {
                deletedAt: null,
                type: DocumentType.SOP,
                isPublished: true,
              },
            },
          },
        },
      },
    }),
    prisma.document.findMany({
      where: {
        departmentId,
        subDepartmentId,
        deletedAt: null,
        type: DocumentType.SOP,
        isPublished: true,
      },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        departmentId: true,
        subDepartmentId: true,
        updatedAt: true,
        department: {
          select: {
            name: true,
          },
        },
        subDepartment: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    department: department
      ? {
          id: department.id,
          name: department.name,
          code: department.code,
          sopCount: department._count.documents,
        }
      : null,
    subDepartment: subDepartment
      ? {
          id: subDepartment.id,
          name: subDepartment.name,
          code: subDepartment.code,
          departmentId: subDepartment.departmentId,
          sopCount: subDepartment._count.documents,
        }
      : null,
    sops: sops.map((sop) => ({
      id: sop.id,
      title: sop.title,
      departmentId: sop.departmentId,
      departmentName: sop.department.name,
      subDepartmentId: sop.subDepartmentId,
      subDepartmentName: sop.subDepartment?.name ?? null,
      updatedAt: sop.updatedAt.toISOString(),
    })),
  };
}

export async function getPublicSopDetail(documentId: string): Promise<{
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  departmentName: string;
  subDepartmentName: string | null;
  editableHtml: string;
} | null> {
  noStore();

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      type: DocumentType.SOP,
      isPublished: true,
      department: { deletedAt: null },
    },
    select: {
      id: true,
      title: true,
      currentVersion: true,
      department: { select: { name: true } },
      subDepartment: { select: { name: true } },
      latestVersion: { select: { content: true } },
    },
  });

  if (!document) {
    return null;
  }

  const content = (document.latestVersion?.content ?? {}) as VersionContent;
  const editableHtml =
    typeof content.editableHtml === "string" && content.editableHtml.trim() ? content.editableHtml.trim() : "<p></p>";

  return {
    id: document.id,
    title: content.documentTitle?.trim() || document.title,
    version: content.version?.trim() || String(document.currentVersion),
    effectiveDate: content.effectiveDate?.trim() || "—",
    departmentName: document.department.name,
    subDepartmentName: document.subDepartment?.name ?? null,
    editableHtml,
  };
}
