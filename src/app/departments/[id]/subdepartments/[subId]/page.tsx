import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSubDepartmentSops } from "@/lib/public-departments";
import { requireViewerUser } from "@/lib/viewer-access";

type SubDepartmentPageProps = {
  params: Promise<{ id: string; subId: string }>;
  searchParams?: Promise<{ q?: string; sort?: string }>;
};

export default async function SubDepartmentPage({ params, searchParams }: SubDepartmentPageProps) {
  await requireViewerUser();

  const [{ id, subId }, filters] = await Promise.all([params, searchParams]);
  const query = typeof filters?.q === "string" ? filters.q.trim() : "";
  const sort = typeof filters?.sort === "string" ? filters.sort : "latest";

  const { department, subDepartment, sops } = await getPublicSubDepartmentSops(id, subId);

  if (!department || !subDepartment) {
    notFound();
  }

  const filteredSops = sops
    .filter((sop) => (query ? sop.title.toLowerCase().includes(query.toLowerCase()) : true))
    .sort((left, right) => {
      if (sort === "az") return left.title.localeCompare(right.title);
      if (sort === "za") return right.title.localeCompare(left.title);
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

  return (
    <main className="min-h-screen bg-[#eef1fb] text-[#0d1635]">
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-10">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.04em] text-[#0d1635]">Lakshya</p>
            <p className="mt-1 text-sm text-slate-500">Sub-department SOP directory</p>
          </div>

          <Link
            href={`/departments/${encodeURIComponent(department.id)}`}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0d1635] transition hover:bg-slate-50"
          >
            Back to Sub-departments
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#b58e39]">{department.name}</p>
        <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.05em] text-[#0d1635]">{subDepartment.name}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Search and filter published SOPs in this sub-department, then open any SOP to view it.
        </p>

        <form className="mt-10 rounded-3xl bg-white p-6 shadow-[0_18px_45px_rgba(13,22,53,0.06)]">
          <div className="grid gap-5 md:grid-cols-[1fr_220px_auto]">
            <div>
              <label htmlFor="q" className="mb-2 block text-sm font-semibold text-slate-700">
                Search SOP
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search by SOP name"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#115b95]"
              />
            </div>

            <div>
              <label htmlFor="sort" className="mb-2 block text-sm font-semibold text-slate-700">
                Filter
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#115b95]"
              >
                <option value="latest">Latest updated</option>
                <option value="az">Name A-Z</option>
                <option value="za">Name Z-A</option>
              </select>
            </div>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="rounded-xl bg-[#0d1635] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#162550]"
              >
                Apply
              </button>
              <Link
                href={`/departments/${encodeURIComponent(department.id)}/subdepartments/${encodeURIComponent(subDepartment.id)}`}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#b58e39]">Published SOPs</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[#0d1635]">SOP List</h2>
          </div>
          <p className="text-sm text-slate-500">{filteredSops.length} result(s)</p>
        </div>

        {filteredSops.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
            No published SOPs match this search or filter.
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_18px_45px_rgba(13,22,53,0.06)]">
            <div className="grid grid-cols-[1.2fr_0.6fr_0.4fr] border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-600">
              <p>SOP Name</p>
              <p>Sub-department</p>
              <p>Action</p>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredSops.map((sop) => (
                <div key={sop.id} className="grid grid-cols-[1.2fr_0.6fr_0.4fr] items-center px-6 py-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{sop.title}</p>
                  <p>{sop.subDepartmentName ?? subDepartment.name}</p>
                  <div>
                    <Link
                      href={`/sops/${encodeURIComponent(sop.id)}`}
                      className="inline-flex rounded-lg bg-[#115b95] px-4 py-2 font-semibold text-white transition hover:bg-[#0d4f82]"
                    >
                      View SOP
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
