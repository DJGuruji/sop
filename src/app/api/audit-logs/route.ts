import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, AUDIT_LOG_VIEW_ROLES } from "@/lib/authz";
import { listAuditLogs } from "@/services/auditLogService";
import { listAuditLogsQuerySchema } from "@/validators/logValidators";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  const auth = await requireActor(AUDIT_LOG_VIEW_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  const url = new URL(req.url);
  const parsed = listAuditLogsQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid query"), { status: 400 });
  }

  const { items, nextCursor } = await listAuditLogs({
    actor: auth.actor,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
  });

  return NextResponse.json(ok({ logs: items, nextCursor }), { status: 200 });
}

/** Clear all audit logs (soft-delete). Only SUPER_ADMIN. */
export async function DELETE(req: Request) {
  const auth = await requireActor(AUDIT_LOG_VIEW_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }
  if (auth.actor.role !== Role.SUPER_ADMIN) {
    return NextResponse.json(fail("FORBIDDEN", "Only Super Admin can clear audit logs"), { status: 403 });
  }

  const now = new Date();
  await prisma.auditLog.updateMany({
    where: { deletedAt: null },
    data: { deletedAt: now },
  });

  return NextResponse.json(ok({ cleared: true }), { status: 200 });
}

