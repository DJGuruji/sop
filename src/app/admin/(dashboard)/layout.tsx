import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { AdminToastHost } from "@/components/admin/toast-host";

export const metadata: Metadata = {
  title: "Admin • SOP",
};

async function getLayoutData(actorId: string) {
  // Run both reads inside one transaction so Prisma uses a single DB connection.
  const [user, pendingApprovals] = await prisma.$transaction([
    prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true, email: true, role: true, departmentId: true, subDepartmentId: true },
    }),
    prisma.approvalRequest.count({ where: { status: "PENDING", deletedAt: null } }),
  ]);

  return { user, pendingApprovals };
}

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { user, pendingApprovals } = await getLayoutData(session.sub);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <SidebarNav
        pendingApprovalsCount={pendingApprovals}
        viewerRole={user?.role ?? session.role}
        supervisorDepartmentId={user?.departmentId ?? null}
        supervisorSubDepartmentId={user?.subDepartmentId ?? null}
      />
      <div className="flex flex-1 flex-col min-w-0 pl-64">
        <DashboardHeader session={{ name: user?.name, email: user?.email, role: user?.role ?? session.role }} />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <AdminToastHost />
    </div>
  );
}
