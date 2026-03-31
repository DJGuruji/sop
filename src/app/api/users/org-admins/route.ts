import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { listOrgAdminsForEscalation } from "@/services/documentApprovalService";

/** Escalation target picker: only org Admin role users (not Super Admin), for department admins. */
const ROLES = [Role.DEPARTMENT_ADMIN];

export async function GET() {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const users = await listOrgAdminsForEscalation();
  return NextResponse.json(ok({ users }), { status: 200 });
}
