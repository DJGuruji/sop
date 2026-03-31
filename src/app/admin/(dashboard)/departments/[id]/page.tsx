"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DepartmentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [departmentName, setDepartmentName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ success?: boolean; data?: { user?: { role?: string; departmentId?: string | null; subDepartmentId?: string | null } } }>)
      .then((me) => {
        if (cancelled || !me.success || !me.data?.user) return;
        const u = me.data.user;
        if (u.role === "SUPERVISOR" && u.departmentId === id && u.subDepartmentId) {
          router.replace(`/admin/departments/${u.departmentId}/subdepartments/${u.subDepartmentId}`);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data: { success?: boolean; data?: { departments?: { id: string; name: string }[] } }) => {
        if (cancelled || !data.success || !data.data?.departments) return;
        const dept = data.data.departments.find((d) => d.id === id);
        if (dept) setDepartmentName(dept.name);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-600">
        <Link href="/admin/departments" className="hover:text-slate-900">Departments</Link>
        <span>/</span>
        <span className="font-medium text-slate-900">{departmentName || "…"}</span>
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Department</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {departmentName || "…"}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        View SOPs and policies for this department, or manage sub-departments.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href={`/admin/departments/${id}/sop`}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">SOP</p>
            <p className="text-xs text-slate-600">View and manage SOPs for this department</p>
          </div>
        </Link>
        <Link
          href={`/admin/departments/${id}/policy`}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Policy</p>
            <p className="text-xs text-slate-600">View and manage policies for this department</p>
          </div>
        </Link>
      </div>

      <div className="mt-6">
        <Link
          href={`/admin/departments/${id}/subdepartments`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
          </svg>
          Sub-departments
        </Link>
      </div>
    </div>
  );
}
