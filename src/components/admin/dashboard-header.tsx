"use client";

type Session = { name?: string; email?: string; role?: string };

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7a9 9 0 00-9-9 8.967 8.967 0 00-9 9v.7a8.967 8.967 0 005.454 8.382 23.848 23.848 0 005.454 1.31M12 21a3 3 0 01-3-3v-1.5a3 3 0 116 0V18a3 3 0 01-3 3z" />
    </svg>
  );
}

export function DashboardHeader({ session }: { session: Session }) {
  const name = session?.name ?? "User";
  const role = session?.role ?? "Admin";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {initial}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
            <p className="truncate text-xs font-normal uppercase tracking-wider text-slate-500">{role.replace(/_/g, " ")}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="ml-2 rounded-lg border border-slate-200 bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
