import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { submitSopForApproval } from "@/services/documentApprovalService";

const ALLOWED_ROLES = [Role.SUPERVISOR, Role.DEPARTMENT_ADMIN, Role.ADMIN, Role.SUPER_ADMIN];

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ALLOWED_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  const { id: documentId } = await props.params;
  const body = (await req.json().catch(() => ({}))) as { approverUserId?: string };
  let approverUserId =
    typeof body.approverUserId === "string" && body.approverUserId.trim()
      ? body.approverUserId.trim()
      : undefined;

  if (!approverUserId && auth.actor.role === Role.DEPARTMENT_ADMIN) {
    const fallbackApprover = await prisma.user.findFirst({
      where: {
        role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    approverUserId = fallbackApprover?.id;
  }

  const result = await submitSopForApproval(auth.actor, documentId, { approverUserId }, req);
  if (!result.ok) {
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status: 400 });
  }

  return NextResponse.json(ok({ submitted: true }), { status: 200 });
}
