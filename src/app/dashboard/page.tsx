import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as <span className="font-medium">{session.role}</span>.
          </p>
        </div>
        <LogoutButton />
      </div>
      <div className="mt-6 rounded-md border border-slate-200 bg-white p-4 text-sm">
        <pre className="whitespace-pre-wrap">{JSON.stringify(session, null, 2)}</pre>
      </div>
    </div>
  );
}

