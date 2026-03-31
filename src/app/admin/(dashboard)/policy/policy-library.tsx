"use client";

import { useCallback, useEffect, useState } from "react";
import {
  POLICY_TEMPLATE_DOCX_FILENAME,
  POLICY_TEMPLATE_DOCX_PATH,
  POLICY_TEMPLATE_PDF_FILENAME,
  POLICY_TEMPLATE_PDF_PATH,
} from "@/lib/policy-template-files";
import type { LibraryTemplateRow } from "@/lib/document-library-display";
import { toastSuccess } from "@/lib/app-toast";
import { LibraryStaticTemplateCard } from "@/components/admin/library-static-template-card";

export type PolicyTemplateRow = LibraryTemplateRow;

type Props = {
  templates: PolicyTemplateRow[];
  isSuperAdmin: boolean;
};

export function PolicyLibrary({ templates, isSuperAdmin }: Props) {
  const [pdfOpen, setPdfOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pdfCacheKey, setPdfCacheKey] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    setPdfOpen(false);
    setUploadModalOpen(false);
  }, []);

  useEffect(() => {
    if (!pdfOpen && !uploadModalOpen) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pdfOpen, uploadModalOpen, onKeyDown]);

  function openUploadModal() {
    setUploadError(null);
    setUploadModalOpen(true);
  }

  function closeUploadModal() {
    setUploadModalOpen(false);
    setUploadError(null);
  }

  async function onReplaceTemplates(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);
    if (uploadFiles.length === 0) {
      setUploadError(
        `Choose one or both files: ${POLICY_TEMPLATE_DOCX_FILENAME} and ${POLICY_TEMPLATE_PDF_FILENAME}.`,
      );
      return;
    }

    const allowed = new Set([POLICY_TEMPLATE_DOCX_FILENAME, POLICY_TEMPLATE_PDF_FILENAME]);
    for (const f of uploadFiles) {
      if (!allowed.has(f.name)) {
        setUploadError(
          `File name must be exactly "${POLICY_TEMPLATE_DOCX_FILENAME}" or "${POLICY_TEMPLATE_PDF_FILENAME}".`,
        );
        return;
      }
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of uploadFiles) {
        formData.append("files", f);
      }
      const res = await fetch("/api/policy/template-files", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as
        | { success: true; data: { replaced: string[] } }
        | { success: false; error: { message: string } };

      if (!res.ok || data.success === false) {
        setUploadError(data.success === false ? data.error.message : "Upload failed.");
        return;
      }
      if (data.success && data.data.replaced.includes(POLICY_TEMPLATE_PDF_FILENAME)) {
        setPdfCacheKey((k) => k + 1);
      }
      setUploadFiles([]);
      const input = document.getElementById("policy-template-files-input") as HTMLInputElement | null;
      if (input) input.value = "";
      closeUploadModal();
      toastSuccess("Policy templates uploaded successfully.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setPdfOpen(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800 sm:min-w-[9rem]"
          >
            View PDF
          </button>
          <a
            href={POLICY_TEMPLATE_DOCX_PATH}
            download={POLICY_TEMPLATE_DOCX_FILENAME}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-w-[9rem]"
          >
            Download Word
          </a>
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={openUploadModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-w-[9rem]"
            >
              Upload templates
            </button>
          ) : null}
        </div>
      </section>

      {/* Additional library entries — same layout as SOP library */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Policy library</h2>
        <p className="mt-1 text-sm text-slate-600">Uploaded policy documents.</p>
        <div className="mt-6 space-y-4">
          <LibraryStaticTemplateCard
            serialNo="POLICY-TEMPLATE"
            heading={POLICY_TEMPLATE_DOCX_FILENAME}
            recordTitle="Policy Template"
            fileLabel={POLICY_TEMPLATE_DOCX_FILENAME}
            version="1.0"
            department="[Enter here]"
            effectiveDate="[Enter here]"
          />
          {templates.length > 0 ? (
            templates.map((t) => (
              <article key={t.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">{t.serialNo}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{t.displayName}</h3>
                  {t.recordTitle !== t.displayName ? (
                    <p className="mt-0.5 text-xs text-slate-500">Record title: {t.recordTitle}</p>
                  ) : null}
                </div>
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-slate-500">Word file</dt>
                      <dd className="font-medium text-slate-900">{t.fileLabel}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-slate-500">Version · Department</dt>
                      <dd className="text-slate-700">
                        {t.version} · {t.departmentLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-slate-500">Effective date</dt>
                      <dd className="text-slate-700">{t.effectiveDate}</dd>
                    </div>
                  </dl>
                </div>
                {t.fileUrl ? (
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-3">
                    <a
                      href={t.fileUrl}
                      download={t.downloadFileName}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Download Word
                    </a>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-600">
              No additional policy documents in the library yet.
            </div>
          )}
        </div>
      </section>

      {pdfOpen ? (
        <div
          className="fixed inset-0 z-50 h-[100dvh] w-full bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-label="PDF preview"
        >
          <iframe
            title="Policy template PDF"
            src={`${POLICY_TEMPLATE_PDF_PATH}?v=${pdfCacheKey}`}
            className="block h-full w-full border-0 bg-slate-100"
          />
          <button
            type="button"
            onClick={() => setPdfOpen(false)}
            className="absolute right-4 top-4 z-[60] rounded-lg border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-800 shadow-md backdrop-blur-sm hover:bg-white"
          >
            Close
          </button>
        </div>
      ) : null}

      {uploadModalOpen && isSuperAdmin ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-upload-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="policy-upload-modal-title" className="text-lg font-semibold text-slate-900">
                  Upload policy templates
                </h2>
            
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={(e) => void onReplaceTemplates(e)} className="mt-5 space-y-4">
              <div>
                <label htmlFor="policy-template-files-input" className="mb-1 block text-sm font-medium text-slate-700">
                  Files
                </label>
                <input
                  id="policy-template-files-input"
                  type="file"
                  multiple
                  accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-slate-500"
                />
              </div>
              {uploadFiles.length > 0 ? (
                <ul className="text-xs text-slate-600">
                  {uploadFiles.map((f) => (
                    <li key={f.name + f.size}>
                      <span className="font-mono">{f.name}</span>
                      <span className="text-slate-400"> · {(f.size / 1024).toFixed(1)} KB</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {uploadError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {uploadError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
