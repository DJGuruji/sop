import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";

/** Match ADMIN_PORTAL_ROLES in authz (keep local to avoid pulling Prisma into Edge). */
const ADMIN_PORTAL_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.DEPARTMENT_ADMIN,
  Role.SUPERVISOR,
]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminArea = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";

  const isUserLogin = pathname === "/auth/login";
  const isDashboard = pathname.startsWith("/dashboard");
  const isViewerArea = pathname.startsWith("/departments") || pathname.startsWith("/sops");

  const needsAuth = (isAdminArea && !isAdminLogin) || (isDashboard && !isUserLogin) || isViewerArea;
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = isAdminArea ? "/admin/login" : "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const session = await readSessionToken(token).catch(() => null);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = isAdminArea ? "/admin/login" : "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminArea && !ADMIN_PORTAL_ROLES.has(session.role as Role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/departments/:path*", "/sops/:path*"],
};
