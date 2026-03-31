import Link from "next/link";
import { getPublicDepartmentSummaries, getPublicSopSummaries } from "@/lib/public-departments";
import { requireViewerUser } from "@/lib/viewer-access";

type DepartmentsPageProps = {
  searchParams?: Promise<{
    department?: string;
    sop?: string;
  }>;
};

export default async function DepartmentsPage({ searchParams }: DepartmentsPageProps) {
  await requireViewerUser();

  const params = (await searchParams) ?? {};
  const selectedDepartmentId = typeof params.department === "string" ? params.department : "";
  const sopSearch = typeof params.sop === "string" ? params.sop.trim() : "";

  const [departments, sops] = await Promise.all([getPublicDepartmentSummaries(), getPublicSopSummaries()]);

  const visibleDepartments = selectedDepartmentId
    ? departments.filter((department) => department.id === selectedDepartmentId)
    : departments;

  const visibleSops = sops.filter((sop) => {
    if (selectedDepartmentId && sop.departmentId !== selectedDepartmentId) return false;
    if (sopSearch && !sop.title.toLowerCase().includes(sopSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-[#eef1fb] text-[#0d1635]">
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-10">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.04em] text-[#0d1635]">Lakshya</p>
            <p className="mt-1 text-sm text-slate-500">Departments and SOP coverage</p>
          </div>

          <Link
            href="/"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0d1635] transition hover:bg-slate-50"
          >
            Back to Home
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#b58e39]">Departments</p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.05em] text-[#0d1635]">All Departments</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">Choose a department or search by SOP name.</p>
        </div>

        <form className="mt-10 rounded-3xl bg-white p-6 shadow-[0_18px_45px_rgba(13,22,53,0.06)]">
          <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="department" className="mb-2 block text-sm font-semibold text-slate-700">
                Department
              </label>
              <select
                id="department"
                name="department"
                defaultValue={selectedDepartmentId}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#115b95]"
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sop" className="mb-2 block text-sm font-semibold text-slate-700">
                SOP Name
              </label>
              <input
                id="sop"
                name="sop"
                type="search"
                defaultValue={sopSearch}
                placeholder="Search SOP name"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#115b95]"
              />
            </div>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="rounded-xl bg-[#0d1635] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#162550]"
              >
                Apply
              </button>
              <Link
                href="/departments"
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </div>
        </form>

        {visibleDepartments.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
            No departments match the selected filter.
          </div>
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleDepartments.map((department) => (
              <Link
                key={department.id}
                href={`/departments/${encodeURIComponent(department.id)}`}
                className="rounded-3xl border border-white/70 bg-white px-7 py-8 shadow-[0_18px_45px_rgba(13,22,53,0.06)]"
              >
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                  {department.code?.trim() || "Department"}
                </p>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[#0d1635]">{department.name}</h2>
                <p className="mt-6 text-base font-medium text-slate-600">
                  {department.sopCount} {department.sopCount === 1 ? "SOP" : "SOPs"}
                </p>
                <p className="mt-8 text-sm font-semibold text-[#115b95]">View sub-departments</p>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#b58e39]">Published SOPs</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[#0d1635]">SOP Directory</h2>
            </div>
            <p className="text-sm text-slate-500">{visibleSops.length} result(s)</p>
          </div>

          {visibleSops.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
              No published SOPs match the selected department or SOP name.
            </div>
          ) : (
            <div className="mt-8 overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_18px_45px_rgba(13,22,53,0.06)]">
              <div className="grid grid-cols-[1.2fr_0.8fr] border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-600">
                <p>SOP Name</p>
                <p>Department</p>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleSops.map((sop) => (
                  <div key={sop.id} className="grid grid-cols-[1.2fr_0.8fr] px-6 py-4 text-sm text-slate-700">
                    <Link href={`/sops/${encodeURIComponent(sop.id)}`} className="font-medium text-slate-900 hover:text-[#115b95]">
                      {sop.title}
                    </Link>
                    <p>{sop.departmentName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
