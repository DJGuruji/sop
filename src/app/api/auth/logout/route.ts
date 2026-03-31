import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ok } from "@/lib/apiResponse";

export async function POST(req: Request) {
  const jar = await cookies();

  const token = jar.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token).catch(() => null) : null;
  await writeAuditLog({
    actorId: session?.sub ?? null,
    action: AuditAction.LOGOUT,
    entityType: "Auth",
    entityId: session?.sub ?? "unknown",
    meta: { outcome: "ALLOW" },
    req,
  });

  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json(ok({}), { status: 200 });
}

