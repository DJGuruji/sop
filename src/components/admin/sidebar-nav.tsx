"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLink =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200/80 hover:text-slate-900";
const navLinkActive =
  "flex items-center gap-3 rounded-lg border-l-4 border-blue-600 bg-blue-50/50 px-3 py-2 text-sm font-medium text-blue-700 border-l-[3px]";

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function LibraryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function ApprovalsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PolicyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7a9 9 0 00-9-9 8.967 8.967 0 00-9 9v.7a8.967 8.967 0 005.454 8.382 23.848 23.848 0 005.454 1.31M12 21a3 3 0 01-3-3v-1.5a3 3 0 116 0V18a3 3 0 01-3 3z" />
    </svg>
  );
}

function ClipboardDocumentListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

type SidebarNavProps = {
  pendingApprovalsCount?: number;
  viewerRole?: string | null;
  supervisorDepartmentId?: string | null;
  supervisorSubDepartmentId?: string | null;
};

export function SidebarNav({
  pendingApprovalsCount = 0,
  viewerRole = null,
  supervisorDepartmentId = null,
  supervisorSubDepartmentId = null,
}: SidebarNavProps) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path || (path !== "/admin" && pathname.startsWith(path));

  const isSupervisor = viewerRole === "SUPERVISOR";
  const supervisorDeptHref =
    supervisorDepartmentId && supervisorSubDepartmentId
      ? `/admin/departments/${supervisorDepartmentId}/subdepartments/${supervisorSubDepartmentId}`
      : "/admin/departments";

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col overflow-y-auto border-r border-slate-200 bg-[#F8F9FA]">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <DocIcon className="h-5 w-5" />
        </div>
        <span className="text-base font-bold tracking-tight text-slate-900">SOP CENTRAL</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">General</p>
          <div className="space-y-0.5">
            <Link href="/admin" className={isActive("/admin") && pathname === "/admin" ? navLinkActive : navLink}>
              <HomeIcon className="h-5 w-5 shrink-0" />
              Home
            </Link>
            <Link href="/admin/sop" className={isActive("/admin/sop") ? navLinkActive : navLink}>
              <LibraryIcon className="h-5 w-5 shrink-0" />
              SOP Library
            </Link>
            {/* <Link href="/admin/policy" className={isActive("/admin/policy") ? navLinkActive : navLink}>
              <PolicyIcon className="h-5 w-5 shrink-0" />
              Policy Library
            </Link> */}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Departments</p>
          <div className="space-y-0.5">
            <Link
              href={isSupervisor ? supervisorDeptHref : "/admin/departments"}
              className={
                isSupervisor
                  ? pathname.includes("/subdepartments/") && pathname.startsWith("/admin/departments")
                    ? navLinkActive
                    : navLink
                  : isActive("/admin/departments")
                    ? navLinkActive
                    : navLink
              }
            >
              <BuildingIcon className="h-5 w-5 shrink-0" />
              {isSupervisor ? "My sub-department" : "Departments"}
            </Link>
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Management</p>
          <div className="space-y-0.5">
            <Link href="/admin/approvals" className={isActive("/admin/approvals") ? navLinkActive : navLink}>
              <ApprovalsIcon className="h-5 w-5 shrink-0" />
              <span className="flex-1">Approvals</span>
              {pendingApprovalsCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>
            {!isSupervisor ? (
              <Link href="/admin/users" className={isActive("/admin/users") ? navLinkActive : navLink}>
                <GearIcon className="h-5 w-5 shrink-0" />
                User management
              </Link>
            ) : null}
            <Link href="/admin/notifications" className={isActive("/admin/notifications") ? navLinkActive : navLink}>
              <BellIcon className="h-5 w-5 shrink-0" />
              Notifications
            </Link>
            <Link href="/admin/logs" className={isActive("/admin/logs") ? navLinkActive : navLink}>
              <ClipboardDocumentListIcon className="h-5 w-5 shrink-0" />
              Audit logs
            </Link>
          </div>
        </div>
      </nav>

    
    </aside>
  );
}
