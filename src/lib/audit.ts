import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/generated/prisma/enums";

type AuditInput = {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityTitle?: string | null;
  meta?: unknown;
  req?: Request;
};

function getClientIp(req?: Request) {
  if (!req) return undefined;
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || undefined;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return undefined;
}

function getUserAgent(req?: Request) {
  if (!req) return undefined;
  return req.headers.get("user-agent") ?? undefined;
}

export async function writeAuditLog(input: AuditInput) {
  const ipAddress = getClientIp(input.req);
  const userAgent = getUserAgent(input.req);

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityTitle: input.entityTitle ?? null,
        meta: input.meta as never,
        ipAddress,
        userAgent,
      },
    });
  } catch {
    // Auditing should never block the main request path.
  }
}

