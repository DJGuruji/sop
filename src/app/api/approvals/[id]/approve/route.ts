import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { DocumentStatus, ApprovalStatus, AuditAction, Role } from "@/generated/prisma/enums";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized." } }, { status: 401 });
    }

    const { id: approvalRequestId } = await props.params;
    const { action, remarks } = (await req.json().catch(() => ({}))) as { action?: "APPROVE" | "ESCALATE", remarks?: string };

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalRequestId },
      include: { document: true }
    });

    if (!approval || approval.status !== ApprovalStatus.PENDING) {
      return NextResponse.json({ success: false, error: { message: "Invalid approval request." } }, { status: 404 });
    }

    const isDeptAdminApproval = session.role === Role.DEPARTMENT_ADMIN;
    const isAdminApproval = session.role === Role.ADMIN || session.role === Role.SUPER_ADMIN;

    if (!isDeptAdminApproval && !isAdminApproval) {
      return NextResponse.json({ success: false, error: { message: "Not authorized to approve." } }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      if (isDeptAdminApproval) {
        if (action === "ESCALATE") {
            // Escalate exactly to Admin level
            await tx.approvalRequest.update({
              where: { id: approval.id },
              data: {
                deptApprovedAt: new Date(),
                deptApprovedById: session.sub,
                remarks: remarks || approval.remarks
              }
            });
            await tx.document.update({
              where: { id: approval.documentId },
              data: { status: DocumentStatus.PENDING_ADMIN_APPROVAL }
            });
        } else {
            // "APPROVE" as dept admin, means they locally approve it natively.
            // Wait, the user requirement says: "After approving SOP: Option 1: Publish directly. Option 2: Send for Admin Approval."
            // We can handle both via Escalating or direct Publish API.
            // Let's assume this endpoint handles "ESCALATE" logic for dept admin. 
            // If they publish, they just call the publish endpoint.
        }
      } else if (isAdminApproval) {
          // Admin approves
          await tx.approvalRequest.update({
            where: { id: approval.id },
            data: {
              status: ApprovalStatus.APPROVED,
              actedAt: new Date(),
              remarks: remarks || approval.remarks
            }
          });
          
          await tx.document.update({
            where: { id: approval.documentId },
            data: { status: DocumentStatus.ADMIN_APPROVED }
          });
      }

      const actionText = action === "ESCALATE" ? "sent to Admin for final approval" : "approved";
      await tx.notification.create({
        data: {
          userId: approval.requesterId,
          title: `SOP Approval Update`,
          message: `Your SOP "${approval.document.title}" has been ${actionText}.`,
          link: "/admin/sop?tab=draft"
        }
      });
      // Need to notify Admins if escalated
      if (action === "ESCALATE") {
        // Find the appropriate admin for the department admin's department
        const deptAdmin = await tx.user.findUnique({
          where: { id: session.sub },
          select: { departmentId: true, department: { select: { createdById: true } } }
        });

        let targetAdmins: { id: string }[] = [];

        if (deptAdmin?.departmentId) {
          // First, try to find the admin who created this department
          if (deptAdmin.department?.createdById) {
            const creatorAdmin = await tx.user.findFirst({
              where: { 
                id: deptAdmin.department.createdById,
                role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
                deletedAt: null 
              },
              select: { id: true }
            });
            if (creatorAdmin) {
              targetAdmins.push(creatorAdmin);
            }
          }

          // If no specific admin found, find any admin assigned to this department
          if (targetAdmins.length === 0) {
            const assignedAdmins = await tx.user.findMany({
              where: {
                role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
                deletedAt: null,
                OR: [
                  { departmentId: deptAdmin.departmentId },
                  { adminDepartmentAssignments: { some: { departmentId: deptAdmin.departmentId } } }
                ]
              },
              select: { id: true }
            });
            targetAdmins = assignedAdmins;
          }
        }

        // Fallback to all admins if no specific admin found
        if (targetAdmins.length === 0) {
          targetAdmins = await tx.user.findMany({
            where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, deletedAt: null },
            select: { id: true }
          });
        }

        if (targetAdmins.length > 0) {
          await tx.notification.createMany({
            data: targetAdmins.map((a) => ({
               userId: a.id,
               title: `New SOP Escalation`,
               message: `SOP "${approval.document.title}" requires your final approval.`,
               link: "/admin/approvals"
            }))
          });
        }
      }
    });

    await writeAuditLog({
        actorId: session.sub,
        action: AuditAction.APPROVE,
        entityType: "ApprovalRequest",
        entityId: approval.id,
        entityTitle: `Approval Request for ${approval.document.title}`,
        meta: { action, role: session.role },
        req
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Approve error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error." } }, { status: 500 });
  }
}
