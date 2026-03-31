import { NextResponse } from "next/server";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { listAuditLogs } from "@/services/auditLogService";
import { Role } from "@/generated/prisma/enums";

/** Export audit logs as CSV. Only SUPER_ADMIN and ADMIN. */
export async function GET(req: Request) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: { code: auth.code, message: "Forbidden" } },
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }
  if (auth.actor.role !== Role.SUPER_ADMIN && auth.actor.role !== Role.ADMIN) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Only Super Admin and Admin can export audit logs." } },
      { status: 403 },
    );
  }

  const rows: string[][] = [];
  // Match the audit table columns: Time, Actor, Role, Email, Action, Entity
  const headers = ["Time", "Actor", "Role", "Email", "Action", "Entity"];
  rows.push(headers);

  let cursor: string | undefined;
  const limit = 500;
  do {
    const { items, nextCursor } = await listAuditLogs({
      actor: auth.actor,
      limit,
      cursor,
    });
    for (const r of items) {
      const actorName = r.actor?.name ?? "";
      const actorRole = r.actor?.role ?? "";
      const actorEmail = r.actor?.email ?? "";
      const entity = r.entityType;
      const escape = (s: string) => {
        const t = String(s).replace(/"/g, '""');
        return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
      };
      rows.push([
        r.createdAt,
        escape(actorName),
        escape(actorRole),
        escape(actorEmail),
        r.action,
        entity,
      ]);
    }
    cursor = nextCursor ?? undefined;
  } while (cursor);

  const bom = "\uFEFF";
  const csv = bom + rows.map((row) => row.join(",")).join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-logs.csv"',
    },
  });
}
