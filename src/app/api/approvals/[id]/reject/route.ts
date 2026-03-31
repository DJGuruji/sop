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
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };

    if (!reason || !reason.trim()) {
      return NextResponse.json({ success: false, error: { message: "Rejection reason is required." } }, { status: 400 });
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalRequestId },
      include: { document: true, requester: true }
    });

    if (!approval || approval.status !== ApprovalStatus.PENDING) {
      return NextResponse.json({ success: false, error: { message: "Invalid approval request." } }, { status: 404 });
    }

    const isDeptAdminRejection = session.role === Role.DEPARTMENT_ADMIN;
    const isAdminRejection = session.role === Role.ADMIN || session.role === Role.SUPER_ADMIN;

    if (!isDeptAdminRejection && !isAdminRejection) {
      return NextResponse.json({ success: false, error: { message: "Not authorized to reject." } }, { status: 403 });
    }

    // Check if dept admin is rejecting an escalated item (not allowed)
    if (isDeptAdminRejection && approval.deptApprovedAt) {
      return NextResponse.json({ success: false, error: { message: "Cannot reject escalated items." } }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Update approval request
      await tx.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.REJECTED,
          actedAt: new Date(),
          remarks: reason.trim()
        }
      });

      // Update document status
      await tx.document.update({
        where: { id: approval.documentId },
        data: { 
          status: isDeptAdminRejection ? DocumentStatus.REJECTED : DocumentStatus.ADMIN_REJECTED 
        }
      });

      // Create notification for requester
      await tx.notification.create({
        data: {
          userId: approval.requesterId,
          title: `SOP Rejected`,
          message: `Your SOP "${approval.document.title}" has been rejected by ${isDeptAdminRejection ? 'Department Admin' : 'Admin'}. Reason: ${reason.trim()}`,
          link: "/admin/sop?tab=draft"
        }
      });
    });

    await writeAuditLog({
      actorId: session.sub,
      action: AuditAction.REJECT,
      entityType: "ApprovalRequest",
      entityId: approval.id,
      entityTitle: `Approval Request for ${approval.document.title}`,
      meta: { reason: reason.trim(), role: session.role },
      req
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reject error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error." } }, { status: 500 });
  }
}