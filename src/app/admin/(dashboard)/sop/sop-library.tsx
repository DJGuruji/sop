"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SOP_TEMPLATE_DOCX_FILENAME,
  SOP_TEMPLATE_DOCX_PATH,
  SOP_TEMPLATE_PDF_FILENAME,
  SOP_TEMPLATE_PDF_PATH,
} from "@/lib/sop-template-files";
import { toastSuccess } from "@/lib/app-toast";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SopUploadSopModal } from "./sop-upload-sop-modal";
import { SopLibraryManager, type ManagedSopLibraryItem } from "./sop-library-manager";
import { SopFormModal } from "./sop-form-modal";

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

type Props = {
  publishedItems: ManagedSopLibraryItem[];
  draftItems: ManagedSopLibraryItem[];
  publishedPagination: Pagination;
  draftPagination: Pagination;
  departments: { id: string; name: string; subDepartments: { id: string; name: string }[] }[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isDeptAdmin: boolean;
  isSupervisor: boolean;
  canUploadSopDocument: boolean;
};

export function SopLibrary({
  publishedItems,
  draftItems,
  publishedPagination,
  draftPagination,
  departments,
  isSuperAdmin,
  isAdmin,
  isDeptAdmin,
  isSupervisor,
  canUploadSopDocument,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "draft" ? "draft" : "published";

  const [pdfOpen, setPdfOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadSopOpen, setUploadSopOpen] = useState(false);
  const [sopFormOpen, setSopFormOpen] = useState(false);
  const [pdfCacheKey, setPdfCacheKey] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    setPdfOpen(false);
    setUploadModalOpen(false);
    setUploadSopOpen(false);
    setSopFormOpen(false);
  }, []);

  useEffect(() => {
    if (!pdfOpen && !uploadModalOpen && !uploadSopOpen && !sopFormOpen) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pdfOpen, uploadModalOpen, uploadSopOpen, onKeyDown]);

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
      setUploadError("Choose one or both files: Sop-Template.docx and Sop-Template.pdf.");
      return;
    }

    const allowed = new Set([SOP_TEMPLATE_DOCX_FILENAME, SOP_TEMPLATE_PDF_FILENAME]);
    for (const f of uploadFiles) {
      if (!allowed.has(f.name)) {
        setUploadError(`File name must be exactly "${SOP_TEMPLATE_DOCX_FILENAME}" or "${SOP_TEMPLATE_PDF_FILENAME}".`);
        return;
      }
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of uploadFiles) {
        formData.append("files", f);
      }
      const res = await fetch("/api/sop/template-files", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as
        | { success: true; data: { replaced: string[] } }
        | { success: false; error: { message: string } };

      if (!res.ok || data.success === false) {
        setUploadError(data.success === false ? data.error.message : "Upload failed.");
        return;
      }
      if (data.success && data.data.replaced.includes(SOP_TEMPLATE_PDF_FILENAME)) {
        setPdfCacheKey((k) => k + 1);
      }
      setUploadFiles([]);
      const input = document.getElementById("sop-template-files-input") as HTMLInputElement | null;
      if (input) input.value = "";
      closeUploadModal();
      toastSuccess("SOP templates uploaded successfully.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* Template actions — buttons only */}
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
            href={SOP_TEMPLATE_DOCX_PATH}
            download={SOP_TEMPLATE_DOCX_FILENAME}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-w-[9rem]"
          >
            Download Sample Template
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
          {canUploadSopDocument ? (
            <button
              type="button"
              onClick={() => setUploadSopOpen(true)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-w-[9rem]"
            >
              Upload SOP
            </button>
          ) : null}
        </div>
      </section>

      {(isSuperAdmin || isAdmin || isDeptAdmin || isSupervisor) ? (
        <div className="space-y-6">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("tab", "draft");
                router.push(`${pathname}?${params.toString()}`);
              }}
              className={`pb-3 px-6 text-sm font-semibold transition-all border-b-2 ${
                activeTab === "draft"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
              }`}
            >
              Unpublished (Drafts)
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                activeTab === "draft" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {draftPagination.total}
              </span>
            </button>
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("tab", "published");
                router.push(`${pathname}?${params.toString()}`);
              }}
              className={`pb-3 px-6 text-sm font-semibold transition-all border-b-2 ${
                activeTab === "published"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
              }`}
            >
              Published
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                activeTab === "published" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {publishedPagination.total}
              </span>
            </button>
          </div>

          <div className="pt-2">
            {activeTab === "draft" ? (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="mb-6 text-sm text-slate-600">
                  These SOPs are currently in draft or pending review. They are not visible to regular users yet.
                </p>
                <SopLibraryManager
                  items={draftItems}
                  departments={departments}
                  pagination={draftPagination}
                  pageParam="d"
                  isSupervisor={isSupervisor}
                  isDeptAdmin={isDeptAdmin}
                  isAdmin={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                />
              </section>
            ) : (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="mb-6 text-sm text-slate-600">
                  These SOPs are live and visible to users in their respective departments.
                </p>
                <SopLibraryManager
                  items={publishedItems}
                  departments={departments}
                  pagination={publishedPagination}
                  pageParam="p"
                  isSupervisor={isSupervisor}
                  isDeptAdmin={isDeptAdmin}
                  isAdmin={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                />
              </section>
            )}
          </div>
        </div>
      ) : null}

      {pdfOpen ? (
        <div
          className="fixed inset-0 z-50 h-[100dvh] w-full bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-label="PDF preview"
        >
          <iframe
            title="SOP template PDF"
            src={`${SOP_TEMPLATE_PDF_PATH}?v=${pdfCacheKey}`}
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

      <SopUploadSopModal
        open={uploadSopOpen}
        onClose={() => setUploadSopOpen(false)}
        onOpenForm={() => setSopFormOpen(true)}
      />
      <SopFormModal open={sopFormOpen} onClose={() => setSopFormOpen(false)} />

      {uploadModalOpen && isSuperAdmin ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sop-upload-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="sop-upload-modal-title" className="text-lg font-semibold text-slate-900">
                  Upload SOP templates
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
                <label htmlFor="sop-template-files-input" className="mb-1 block text-sm font-medium text-slate-700">
                  Files
                </label>
                <input
                  id="sop-template-files-input"
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
