import { getSession } from "@/lib/auth";
import { getManagedDepartmentIdsForDeptAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ApprovalsClient, type ApprovalDisplayItem } from "./approvals-client";
import { ApprovalStatus, DocumentStatus, Role } from "@/generated/prisma/enums";

const docInclude = {
  document: { select: { id: true, serialNo: true, title: true, isPublished: true } },
  requester: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      subDepartmentId: true,
      department: { select: { name: true } },
      subDepartment: { select: { name: true } },
    },
  },
  approver: {
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { name: true } },
      subDepartment: { select: { name: true } },
    },
  },
  deptApprovedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { name: true } },
      subDepartment: { select: { name: true } },
    },
  },
};

type ApprovalQueryRow = {
  id: string;
  approverId: string;
  document: { id: string; serialNo: string; title: string; isPublished: boolean };
  requester: {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentId: string | null;
    subDepartmentId: string | null;
    department: { name: string } | null;
    subDepartment: { name: string } | null;
  };
  approver: {
    id: string;
    name: string;
    email: string;
    department: { name: string } | null;
    subDepartment: { name: string } | null;
  };
  deptApprovedBy: {
    id: string;
    name: string;
    email: string;
    department: { name: string } | null;
    subDepartment: { name: string } | null;
  } | null;
  status: string;
  createdAt: Date;
  remarks: string | null;
  deptApprovedAt: Date | null;
};

type ApprovalTab = {
  id: string;
  label: string;
  pending: ApprovalDisplayItem[];
  approved: ApprovalDisplayItem[];
  rejected: ApprovalDisplayItem[];
  pendingTotal: number;
  approvedTotal: number;
  rejectedTotal: number;
};

function mapRow(row: ApprovalQueryRow): ApprovalDisplayItem {
  return {
    id: row.id,
    approverId: row.approverId,
    documentId: row.document.id,
    serialNo: row.document.serialNo,
    documentTitle: row.document.title,
    isPublished: row.document.isPublished,
    requesterName: row.requester.name,
    requesterEmail: row.requester.email,
    requesterRole: row.requester.role,
    requesterDepartmentId: row.requester.departmentId,
    requesterSubDepartmentId: row.requester.subDepartmentId,
    requesterDepartmentName: row.requester.department?.name ?? null,
    requesterSubDepartmentName: row.requester.subDepartment?.name ?? null,
    approverName: row.approver.name,
    approverEmail: row.approver.email,
    approverDepartmentName: row.approver.department?.name ?? null,
    approverSubDepartmentName: row.approver.subDepartment?.name ?? null,
    deptApprovedByName: row.deptApprovedBy?.name ?? null,
    deptApprovedByEmail: row.deptApprovedBy?.email ?? null,
    deptApprovedByDepartmentName: row.deptApprovedBy?.department?.name ?? null,
    deptApprovedBySubDepartmentName: row.deptApprovedBy?.subDepartment?.name ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    remarks: row.remarks,
    deptApprovedAt: row.deptApprovedAt ? row.deptApprovedAt.toISOString() : null,
  };
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ApprovalsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { sub: actorId, role, departmentId } = session;
  
  // Parse pagination parameters
  const params = await searchParams;
  const currentPage = parseInt(params.page as string) || 1;
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;

  const managedDepartmentIds =
    role === Role.DEPARTMENT_ADMIN
      ? await getManagedDepartmentIdsForDeptAdmin(actorId, departmentId ?? null)
      : [];

  // Fetch departments for publish modal (needed for dept admins and higher)
  const departments = role !== Role.SUPERVISOR ? await prisma.department.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      subDepartments: {
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  }) : [];

  const deptAdminPendingDocStatuses: DocumentStatus[] = [
    DocumentStatus.PENDING_APPROVAL,
    DocumentStatus.PENDING_DEPT_ADMIN_APPROVAL,
  ];

  let tabs: ApprovalTab[] = [];

  if (role === Role.SUPERVISOR) {
    // Tab 1: Dept Admin - SOPs handled by department admin
    const deptPending = await prisma.approvalRequest.findMany({
      where: { 
        requesterId: actorId, 
        status: "PENDING", 
        deptApprovedAt: null // Not yet handled by dept admin
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });
    
    // SOPs approved by dept admin (not escalated to admin)
    const deptApproved = await prisma.approvalRequest.findMany({
      where: { 
        requesterId: actorId, 
        deptApprovedAt: { not: null },
        status: ApprovalStatus.APPROVED,
        document: {
          deletedAt: null,
          status: DocumentStatus.APPROVED // Direct dept admin approval
        }
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    // SOPs rejected by dept admin - get most recent rejection per document
    // Only show items that were rejected by dept admin (not escalated to admin)
    const deptRejected = await prisma.approvalRequest.findMany({
      where: { 
        requesterId: actorId, 
        status: ApprovalStatus.REJECTED,
        deptApprovedAt: null, // Rejected by dept admin (not escalated)
        document: {
          deletedAt: null
        }
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      distinct: ['documentId'], // Only get the most recent rejection per document
    });

    // Tab 2: Admin - SOPs that went through admin level
    const adminPending = await prisma.approvalRequest.findMany({
      where: { 
        requesterId: actorId, 
        status: "PENDING", 
        deptApprovedAt: { not: null }, // Escalated by dept admin
        document: {
          deletedAt: null,
          status: DocumentStatus.PENDING_ADMIN_APPROVAL
        }
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });
    
    // SOPs approved by admin (after escalation)
    const adminApproved = await prisma.approvalRequest.findMany({
      where: { 
        requesterId: actorId, 
        deptApprovedAt: { not: null }, // Was escalated
        status: "APPROVED",
        document: {
          deletedAt: null,
          status: DocumentStatus.ADMIN_APPROVED // Admin approval
        }
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    // SOPs rejected by admin (after escalation) - get most recent rejection per document
    const adminRejected = await prisma.approvalRequest.findMany({
      where: { 
        requesterId: actorId, 
        deptApprovedAt: { not: null }, // Was escalated
        status: ApprovalStatus.REJECTED,
        document: {
          deletedAt: null
        }
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      distinct: ['documentId'], // Only get the most recent rejection per document
    });

    tabs = [
      {
        id: "dept_admin",
        label: "Dept Admin",
        pending: deptPending.map(mapRow),
        approved: deptApproved.map(mapRow),
        rejected: deptRejected.map(mapRow),
        pendingTotal: deptPending.length,
        approvedTotal: deptApproved.length,
        rejectedTotal: deptRejected.length,
      },
      {
        id: "admin",
        label: "Admin",
        pending: adminPending.map(mapRow),
        approved: adminApproved.map(mapRow),
        rejected: adminRejected.map(mapRow),
        pendingTotal: adminPending.length,
        approvedTotal: adminApproved.length,
        rejectedTotal: adminRejected.length,
      },
    ];
  } else if (role === Role.DEPARTMENT_ADMIN) {
    // Tab "Requested": pending items for this department — by department scope OR explicit approver assignment
    // (JWT `departmentId` can be stale; scope is refreshed via DB in getManagedDepartmentIdsForDeptAdmin).
    const docPending = {
      deletedAt: null,
      status: { in: deptAdminPendingDocStatuses },
    };

    // Requested Tab - Pending: SOPs from supervisors awaiting dept admin approval
    const incomingPending = await prisma.approvalRequest.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        deptApprovedAt: null, // Not yet approved by dept admin
        deletedAt: null,
        OR: [
          ...(managedDepartmentIds.length > 0
            ? [
                {
                  requester: { role: Role.SUPERVISOR },
                  document: {
                    ...docPending,
                    departmentId: { in: managedDepartmentIds },
                  },
                },
              ]
            : []),
          {
            approverId: actorId,
            deptApprovedAt: null,
            document: { ...docPending },
          },
        ],
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    // Requested Tab - Approved: SOPs from supervisors approved by this dept admin (not escalated)
    const incomingApproved = await prisma.approvalRequest.findMany({
      where: {
        deptApprovedById: actorId, // Approved by this dept admin
        deptApprovedAt: { not: null },
        status: ApprovalStatus.APPROVED, // Fully approved
        deletedAt: null,
        // Only items that were directly approved (not escalated)
        document: {
          deletedAt: null,
          status: DocumentStatus.APPROVED // Direct approval, not admin-approved
        }
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    // Request Tab - Pending: SOPs sent to admin by this dept admin (escalated or directly submitted)
    const outgoingPending = await prisma.approvalRequest.findMany({
      where: { 
        status: ApprovalStatus.PENDING,
        deletedAt: null,
        OR: [
          // SOPs escalated by this dept admin
          {
            deptApprovedById: actorId,
            deptApprovedAt: { not: null },
            document: {
              deletedAt: null,
              status: DocumentStatus.PENDING_ADMIN_APPROVAL
            }
          },
          // SOPs created and submitted directly by this dept admin
          {
            requesterId: actorId,
            document: {
              deletedAt: null,
              status: DocumentStatus.PENDING_ADMIN_APPROVAL
            }
          }
        ]
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      distinct: ['documentId'], // Avoid duplicates if both conditions match
    });
    
    // Request Tab - Approved: SOPs sent to admin by this dept admin and then approved (escalated or directly submitted)
    const outgoingApproved = await prisma.approvalRequest.findMany({
      where: { 
        status: ApprovalStatus.APPROVED,
        deletedAt: null,
        OR: [
          // SOPs escalated by this dept admin and approved by admin
          {
            deptApprovedById: actorId,
            deptApprovedAt: { not: null },
            document: {
              deletedAt: null,
              status: DocumentStatus.ADMIN_APPROVED
            }
          },
          // SOPs created and submitted directly by this dept admin and approved by admin
          {
            requesterId: actorId,
            document: {
              deletedAt: null,
              status: DocumentStatus.ADMIN_APPROVED
            }
          }
        ]
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      distinct: ['documentId'], // Avoid duplicates if both conditions match
    });

    // Requested Tab - Rejected: SOPs from supervisors rejected by this dept admin - get most recent rejection per document
    // Only show items that were directly rejected by this dept admin (not escalated to admin)
    const incomingRejected = await prisma.approvalRequest.findMany({
      where: {
        approverId: actorId, // This dept admin is the approver who rejected it
        status: ApprovalStatus.REJECTED,
        deptApprovedAt: null, // Not escalated to admin (direct dept admin rejection)
        deletedAt: null,
        document: {
          deletedAt: null
        }
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      distinct: ['documentId'], // Only get the most recent rejection per document
    });

    // Request Tab - Rejected: SOPs sent to admin by this dept admin and then rejected (escalated or directly submitted)
    const outgoingRejected = await prisma.approvalRequest.findMany({
      where: { 
        status: ApprovalStatus.REJECTED,
        deletedAt: null,
        OR: [
          // SOPs escalated by this dept admin and rejected by admin
          {
            deptApprovedById: actorId,
            deptApprovedAt: { not: null },
            document: {
              deletedAt: null
            }
          },
          // SOPs created and submitted directly by this dept admin and rejected by admin
          {
            requesterId: actorId,
            document: {
              deletedAt: null,
              status: DocumentStatus.ADMIN_REJECTED
            }
          }
        ]
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      distinct: ['documentId'], // Only get the most recent rejection per document
    });

    tabs = [
      {
        id: "requested",
        label: "Requested",
        pending: incomingPending.map(mapRow),
        approved: incomingApproved.map(mapRow),
        rejected: incomingRejected.map(mapRow),
        pendingTotal: incomingPending.length,
        approvedTotal: incomingApproved.length,
        rejectedTotal: incomingRejected.length,
      },
      {
        id: "request",
        label: "Request",
        pending: outgoingPending.map(mapRow),
        approved: outgoingApproved.map(mapRow),
        rejected: outgoingRejected.map(mapRow),
        pendingTotal: outgoingPending.length,
        approvedTotal: outgoingApproved.length,
        rejectedTotal: outgoingRejected.length,
      },
    ];
  } else if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    // Requested Tab - Pending: SOPs escalated to admin level (awaiting admin approval)
    const adminRequestedPending = await prisma.approvalRequest.findMany({
      where: { 
        status: "PENDING",
        deletedAt: null,
        OR: [
          // SOPs escalated from dept admin
          { 
            deptApprovedAt: { not: null },
            document: {
              deletedAt: null,
              status: DocumentStatus.PENDING_ADMIN_APPROVAL
            }
          },
          // SOPs directly from dept admin/admin roles
          { requester: { role: Role.DEPARTMENT_ADMIN } },
          { requester: { role: Role.ADMIN } },
          { requester: { role: Role.SUPER_ADMIN } }
        ]
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });
    
    // Requested Tab - Approved: SOPs approved by admin (escalated or directly submitted)
    const adminRequestedApproved = await prisma.approvalRequest.findMany({
      where: { 
        status: "APPROVED",
        deletedAt: null,
        OR: [
          // SOPs escalated from dept admin and approved by admin
          {
            deptApprovedAt: { not: null },
            document: {
              deletedAt: null,
              status: DocumentStatus.ADMIN_APPROVED
            }
          },
          // SOPs directly submitted by dept admin and approved by admin
          {
            requester: { role: Role.DEPARTMENT_ADMIN },
            document: {
              deletedAt: null,
              status: DocumentStatus.ADMIN_APPROVED
            }
          }
        ]
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    // Requested Tab - Rejected: SOPs rejected by admin - get most recent rejection per document
    const adminRequestedRejected = await prisma.approvalRequest.findMany({
      where: { 
        status: ApprovalStatus.REJECTED,
        deletedAt: null,
        OR: [
          // SOPs escalated from dept admin and rejected by admin
          {
            deptApprovedAt: { not: null },
            document: {
              deletedAt: null
            }
          },
          // SOPs directly submitted by dept admin and rejected by admin
          {
            requester: { role: Role.DEPARTMENT_ADMIN },
            document: {
              deletedAt: null,
              status: DocumentStatus.ADMIN_REJECTED
            }
          }
        ]
      },
      include: docInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      distinct: ['documentId'], // Only get the most recent rejection per document
    });

    tabs = [
      {
        id: "requested",
        label: "Requested",
        pending: adminRequestedPending.map(mapRow),
        approved: adminRequestedApproved.map(mapRow),
        rejected: adminRequestedRejected.map(mapRow),
        pendingTotal: adminRequestedPending.length,
        approvedTotal: adminRequestedApproved.length,
        rejectedTotal: adminRequestedRejected.length,
      },
    ];
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="border-b border-slate-300 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Management</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Approvals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Manage pending and completed approval workflows for SOPs based on your organizational role.
        </p>
      </header>

      <ApprovalsClient 
        role={role} 
        currentUserId={actorId} 
        tabs={tabs} 
        departments={departments}
        currentPage={currentPage}
        pageSize={pageSize}
      />
    </div>
  );
}
