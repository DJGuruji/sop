"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { SopDocumentsSection } from "@/components/admin/sop-documents-section";

export default function DepartmentSopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = use(params);
  const [deptName, setDeptName] = useState<string>("");

  const onLoaded = useCallback(
    (meta: { department?: { name: string } }) => {
      if (meta.department?.name) setDeptName(meta.department.name);
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
          <Link href="/admin/departments" className="hover:text-slate-900">
            Departments
          </Link>
          <span>/</span>
          <Link href={`/admin/departments/${departmentId}`} className="hover:text-slate-900">
            {deptName || "…"}
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-900">SOP</span>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Documents</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          SOP — {deptName || "Department"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          SOPs for this department that are not assigned to a specific sub-department (upload with sub-department
          &quot;None&quot;). Drafts can be sent for approval; department admins may escalate to an org Admin.
        </p>
      </div>

      <SopDocumentsSection
        listUrl={`/api/departments/${encodeURIComponent(departmentId)}/sops`}
        sopSectionTitle="Department SOPs"
        onLoaded={onLoaded}
      />
    </div>
  );
}
