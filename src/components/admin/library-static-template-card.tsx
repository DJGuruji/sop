/** Static “reference” row for standard Word template (same card UI as DB-backed library items). No download — use toolbar actions above. */
export function LibraryStaticTemplateCard({
  serialNo,
  heading,
  recordTitle,
  fileLabel,
  version,
  department,
  effectiveDate,
}: {
  serialNo: string;
  /** Main card title — canonical file name, e.g. Sop-Template.docx */
  heading: string;
  /** Shown as “Record title” when different from heading */
  recordTitle: string;
  fileLabel: string;
  version: string;
  department: string;
  effectiveDate: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">{serialNo}</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{heading}</h3>
        {recordTitle !== heading ? (
          <p className="mt-0.5 text-xs text-slate-500">Record title: {recordTitle}</p>
        ) : null}
      </div>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-slate-500">Word file</dt>
            <dd className="font-medium text-slate-900">{fileLabel}</dd>
          </div>
        </dl>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-slate-500">Version · Department</dt>
            <dd className="text-slate-700">
              {version} · {department}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-slate-500">Effective date</dt>
            <dd className="text-slate-700">{effectiveDate}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
