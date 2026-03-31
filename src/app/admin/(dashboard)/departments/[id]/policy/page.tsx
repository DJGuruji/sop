"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type PolicyRow = {
  id: string;
  serialNo: string;
  title: string;
  status: string;
  currentVersion: number;
  isPublished: boolean;
  subDepartmentName: string | null;
};

export default function DepartmentPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [departmentName, setDepartmentName] = useState<string>("");
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/departments/${encodeURIComponent(id)}/policies`)
      .then((r) => r.json())
      .then((data: {
        success?: boolean;
        data?: {
          department?: { name: string };
          policies?: PolicyRow[];
        };
        error?: { message?: string };
      }) => {
        if (cancelled) return;
        if (!data.success || !data.data) {
          setError(data.error?.message ?? "Unable to load policies.");
          setPolicies([]);
          return;
        }
        setDepartmentName(data.data.department?.name ?? "");
        setPolicies(data.data.policies ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load policies.");
          setPolicies([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
          <Link href="/admin/departments" className="hover:text-slate-900">
            Departments
          </Link>
          <span>/</span>
          <Link href={`/admin/departments/${id}`} className="hover:text-slate-900">
            {departmentName || "..."}
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-900">Policy</span>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Documents</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Policy - {departmentName || "Department"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Published policies for this department, including policies mapped to sub-departments.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
            Loading policies...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : policies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
            No published policies for this department yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Serial No</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {policies.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                    <td className="px-4 py-3 text-slate-600">{item.serialNo}</td>
                    <td className="px-4 py-3 text-slate-600">v{item.currentVersion}</td>
                    <td className="px-4 py-3 text-slate-600">{item.subDepartmentName || "Department level"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.status.replaceAll("_", " ")}
                      {item.isPublished ? " - Published" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
