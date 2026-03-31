import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicDepartmentSubDepartments } from "@/lib/public-departments";
import { requireViewerUser } from "@/lib/viewer-access";

type DepartmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DepartmentDetailPage({ params }: DepartmentDetailPageProps) {
  await requireViewerUser();

  const { id } = await params;
  const { department, subDepartments } = await getPublicDepartmentSubDepartments(id);

  if (!department) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#eef1fb] text-[#0d1635]">
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-10">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.04em] text-[#0d1635]">Lakshya</p>
            <p className="mt-1 text-sm text-slate-500">Department sub-departments</p>
          </div>

          <Link
            href="/departments"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0d1635] transition hover:bg-slate-50"
          >
            Back to Departments
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#b58e39]">Department</p>
        <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.05em] text-[#0d1635]">{department.name}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {department.sopCount} {department.sopCount === 1 ? "published SOP" : "published SOPs"} across all sub-departments.
        </p>

        {subDepartments.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
            No sub-departments are available for this department.
          </div>
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {subDepartments.map((subDepartment) => (
              <Link
                key={subDepartment.id}
                href={`/departments/${encodeURIComponent(department.id)}/subdepartments/${encodeURIComponent(subDepartment.id)}`}
                className="rounded-3xl border border-white/70 bg-white px-7 py-8 shadow-[0_18px_45px_rgba(13,22,53,0.06)]"
              >
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                  {subDepartment.code?.trim() || "Sub-department"}
                </p>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[#0d1635]">{subDepartment.name}</h2>
                <p className="mt-6 text-base font-medium text-slate-600">
                  {subDepartment.sopCount} {subDepartment.sopCount === 1 ? "SOP" : "SOPs"}
                </p>
                <p className="mt-8 text-sm font-semibold text-[#115b95]">View SOPs</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
