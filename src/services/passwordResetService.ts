import bcrypt from "bcryptjs";
import { AuditAction } from "@/generated/prisma/enums";
import { sha256Hex, randomToken } from "@/lib/crypto";
import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function requestPasswordReset(input: {
  email: string;
  baseUrl: string;
  req: Request;
}) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true, isActive: true },
  });

  if (!user?.isActive) {
    await writeAuditLog({
      actorId: user?.id ?? null,
      action: AuditAction.CREATE,
      entityType: "PasswordResetToken",
      entityId: input.email,
      meta: { outcome: "DENY", reason: user ? "INACTIVE" : "NOT_FOUND" },
      req: input.req,
    });
    return;
  }

  const rawToken = randomToken(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    }),
  ]);

  await writeAuditLog({
    actorId: user.id,
    action: AuditAction.CREATE,
    entityType: "PasswordResetToken",
    entityId: user.id,
    entityTitle: user.email,
    meta: { outcome: "ALLOW", expiresAt: expiresAt.toISOString() },
    req: input.req,
  });

  const resetUrl = `${input.baseUrl}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  await sendMail({
    to: user.email,
    subject: "Reset your password",
    html: `<p>Hi ${user.name},</p><p>Click the link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes.</p><p>If you didn’t request this, you can ignore this email.</p>`,
    text: `Hi ${user.name},\nReset your password: ${resetUrl}\nThis link expires in 30 minutes.`,
  });
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
  req: Request;
}) {
  const tokenHash = sha256Hex(input.token);
  const now = new Date();

  const prt = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!prt || prt.usedAt || prt.expiresAt <= now) {
    await writeAuditLog({
      actorId: prt?.userId ?? null,
      action: AuditAction.UPDATE,
      entityType: "PasswordResetToken",
      entityId: prt?.id ?? tokenHash,
      meta: { outcome: "DENY", reason: !prt ? "NOT_FOUND" : prt.usedAt ? "USED" : "EXPIRED" },
      req: input.req,
    });
    return { ok: false as const };
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: prt.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: prt.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    actorId: prt.userId,
    action: AuditAction.UPDATE,
    entityType: "User",
    entityId: prt.userId,
    meta: { outcome: "ALLOW", action: "PASSWORD_RESET" },
    req: input.req,
  });

  return { ok: true as const };
}

