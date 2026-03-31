"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SopDocumentsSection } from "@/components/admin/sop-documents-section";

export default function SubDepartmentDocumentsPage({
  params,
}: {
  params: Promise<{ id: string; subId: string }>;
}) {
  const { id: departmentId, subId } = use(params);
  const [deptName, setDeptName] = useState("");
  const [subName, setSubName] = useState("");
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ success?: boolean; data?: { user?: { role?: string } } }>)
      .then((data) => {
        if (!cancelled && data.success && data.data?.user?.role) {
          setViewerRole(data.data.user.role);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onLoaded = useCallback((meta: { subDepartment?: { name: string; departmentName: string } }) => {
    if (meta.subDepartment) {
      setSubName(meta.subDepartment.name);
      setDeptName(meta.subDepartment.departmentName);
    }
  }, []);

  const isSupervisor = viewerRole === "SUPERVISOR";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {isSupervisor ? (
            <>
              <Link href="/admin/departments" className="hover:text-slate-900">
                My sub-department
              </Link>
              <span>/</span>
              <span className="font-medium text-slate-900">{subName || "…"}</span>
            </>
          ) : (
            <>
              <Link href="/admin/departments" className="hover:text-slate-900">
                Departments
              </Link>
              <span>/</span>
              <Link href={`/admin/departments/${departmentId}`} className="hover:text-slate-900">
                {deptName || "…"}
              </Link>
              <span>/</span>
              <Link href={`/admin/departments/${departmentId}/subdepartments`} className="hover:text-slate-900">
                Sub-departments
              </Link>
              <span>/</span>
              <span className="font-medium text-slate-900">{subName || "…"}</span>
            </>
          )}
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sub-department</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{subName || "Loading…"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          SOPs and policies for this sub-department. Supervisors can send draft SOPs to the department admin for
          approval.
        </p>
      </div>

      <SopDocumentsSection
        listUrl={`/api/subdepartments/${encodeURIComponent(subId)}/documents`}
        sopSectionTitle="SOPs"
        onLoaded={onLoaded}
      />
    </div>
  );
}
