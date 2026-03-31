import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSopDetail } from "@/lib/public-departments";
import { sanitizeEditableHtml } from "@/lib/sop-editable-content";
import { requireViewerUser } from "@/lib/viewer-access";

type SopViewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SopViewPage({ params }: SopViewPageProps) {
  await requireViewerUser();

  const { id } = await params;
  const sop = await getPublicSopDetail(id);

  if (!sop) {
    notFound();
  }

  const departmentLabel = sop.subDepartmentName ? `${sop.departmentName} / ${sop.subDepartmentName}` : sop.departmentName;

  return (
    <main className="min-h-screen bg-[#eef1fb] text-[#0d1635]">
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-10">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.04em] text-[#0d1635]">Lakshya</p>
            <p className="mt-1 text-sm text-slate-500">SOP viewer</p>
          </div>

          <Link
            href="/departments"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0d1635] transition hover:bg-slate-50"
          >
            Back to Departments
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20 lg:px-10">
        <div className="rounded-3xl bg-white px-8 py-10 shadow-[0_18px_45px_rgba(13,22,53,0.06)]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#b58e39]">{departmentLabel}</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.05em] text-[#0d1635]">{sop.title}</h1>

          <div className="mt-6 flex flex-wrap gap-6 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Version:</span> {sop.version}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Effective date:</span> {sop.effectiveDate}
            </p>
          </div>

          <div
            className="prose prose-slate mt-10 max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeEditableHtml(sop.editableHtml) }}
          />
        </div>
      </section>
    </main>
  );
}
