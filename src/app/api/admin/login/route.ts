import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AuditAction, Role } from "@/generated/prisma/enums";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requiredEmailDomain, verifyRecaptcha } from "@/lib/recaptcha";
import { ok, fail } from "@/lib/apiResponse";
import { ADMIN_PORTAL_ROLES } from "@/lib/authz";
import { loginBodySchema } from "@/validators/authValidators";

const ADMIN_ROLES = new Set<Role>([Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN]);

export async function POST(req: Request) {
  const parsed = loginBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid credentials"), { status: 400 });
  }

  const { email, password, recaptchaToken } = parsed.data;
  if (!recaptchaToken) return NextResponse.json(fail("RECAPTCHA_REQUIRED", "Missing recaptcha"), { status: 400 });
  const recaptcha = await verifyRecaptcha(recaptchaToken, "login");
  if (!recaptcha.success) {
    await writeAuditLog({
      actorId: null,
      action: AuditAction.LOGIN,
      entityType: "AdminAuth",
      entityId: email ?? "missing-email",
      meta: { outcome: "DENY", reason: "RECAPTCHA_FAILED" },
      req,
    });
    return NextResponse.json(fail("RECAPTCHA_FAILED", "reCAPTCHA failed"), { status: 400 });
  }

  if (!requiredEmailDomain(email ?? "")) {
    await writeAuditLog({
      actorId: null,
      action: AuditAction.LOGIN,
      entityType: "AdminAuth",
      entityId: email ?? "invalid-domain",
      meta: { outcome: "DENY", reason: "INVALID_EMAIL_DOMAIN" },
      req,
    });
    return NextResponse.json(
      fail("INVALID_EMAIL_DOMAIN", "Email must end with @iiclakshya.com"),
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      role: true,
      isActive: true,
      departmentId: true,
      subDepartmentId: true,
    },
  });

  if (!user?.isActive) {
    await writeAuditLog({
      actorId: user?.id ?? null,
      action: AuditAction.LOGIN,
      entityType: "AdminAuth",
      entityId: email,
      meta: { outcome: "DENY", reason: user ? "INACTIVE" : "NOT_FOUND" },
      req,
    });
    return NextResponse.json(fail("INVALID_CREDENTIALS", "Invalid credentials"), { status: 401 });
  }
  if (user.role === Role.EMPLOYEE) {
    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.LOGIN,
      entityType: "AdminAuth",
      entityId: user.id,
      meta: { outcome: "DENY", reason: "EMPLOYEE_USES_EMPLOYEE_PORTAL", role: user.role },
      req,
    });
    return NextResponse.json(
      fail(
        "EMPLOYEE_NOT_ALLOWED",
        "Employee accounts cannot use the admin sign-in. Please use the employee login page instead.",
      ),
      { status: 403 },
    );
  }

  if (!ADMIN_PORTAL_ROLES.includes(user.role)) {
    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.LOGIN,
      entityType: "AdminAuth",
      entityId: user.id,
      meta: { outcome: "DENY", reason: "NOT_ADMIN_PORTAL_ROLE", role: user.role },
      req,
    });
    return NextResponse.json(
      fail("FORBIDDEN", "Your role does not have access to the admin portal."),
      { status: 403 },
    );
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.LOGIN,
      entityType: "AdminAuth",
      entityId: user.id,
      meta: { outcome: "DENY", reason: "BAD_PASSWORD", role: user.role },
      req,
    });
    return NextResponse.json(fail("INVALID_CREDENTIALS", "Invalid credentials"), { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.id,
    role: user.role,
    departmentId: user.departmentId,
    subDepartmentId: user.subDepartmentId,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  await writeAuditLog({
    actorId: user.id,
    action: AuditAction.LOGIN,
    entityType: "AdminAuth",
    entityId: user.id,
    meta: { outcome: "ALLOW", role: user.role },
    req,
  });
  return NextResponse.json(ok({ redirectTo: "/admin" }), { status: 200 });
}

