"use client";

import { useEffect, useRef, useState } from "react";
import { toastSuccess } from "@/lib/app-toast";
import type { SopFormData } from "./sop-form-content";
import type { ManagedSopLibraryItem } from "./sop-library-manager";

type Props = {
  item: ManagedSopLibraryItem | null;
  mode: "view" | "edit" | null;
  onClose: () => void;
  /** e.g. `router.refresh` from the host page */
  onAfterSave?: () => void;
};

export function SopLibraryViewEditModal({ item, mode, onClose, onAfterSave }: Props) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [contentDepartmentName, setContentDepartmentName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [sections, setSections] = useState<{ id: string; title: string; bodyHtml: string }[]>([]);
  const [formData, setFormData] = useState<SopFormData | null>(null);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setVersion(item.versionLabel);
    setEffectiveDate(item.effectiveDate);
    setContentDepartmentName(item.contentDepartmentName);
    setPreparedBy(item.preparedBy);
    setApprovedBy(item.approvedBy);
    setSections(item.sections);
    setFormData(item.formData);
    setError(null);
  }, [item]);

  useEffect(() => {
    if (!item || mode !== "edit") return;
    for (const section of item.sections) {
      const node = sectionRefs.current[section.id];
      if (node) node.innerHTML = section.bodyHtml;
    }
  }, [item, mode]);

  async function handleSave() {
    if (!item) return;
    setBusy(true);
    setError(null);

    const nextSections = sections.map((section) => ({
      ...section,
      bodyHtml: sectionRefs.current[section.id]?.innerHTML ?? section.bodyHtml,
    }));

    const res = await fetch("/api/sop/library-items/save-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        title,
        effectiveDate,
        contentDepartmentName,
        preparedBy,
        approvedBy,
        sections: nextSections,
        formData,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || data.success === false) {
      setError(data.error?.message ?? "Failed to save SOP.");
      setBusy(false);
      return;
    }

    toastSuccess("SOP changes saved.");
    onAfterSave?.();
    onClose();
    setBusy(false);
  }

  function addSection() {
    setSections((current) => [
      ...current,
      {
        id: `section-${Date.now()}`,
        title: `Section ${current.length + 1}`,
        bodyHtml: "<p></p>",
      },
    ]);
  }

  function removeSection(id: string) {
    setSections((current) => current.filter((section) => section.id !== id));
  }

  function insertImage(sectionId: string) {
    const url = typeof window !== "undefined" ? window.prompt("Enter image URL") : null;
    if (!url?.trim()) return;
    const width = typeof window !== "undefined" ? window.prompt("Image width percentage", "100") : "100";
    const safeWidth = Number(width);
    const widthStyle = Number.isFinite(safeWidth) && safeWidth > 0 && safeWidth <= 100 ? `${safeWidth}%` : "100%";

    const node = sectionRefs.current[sectionId];
    const imageHtml = `<img src="${url.trim()}" alt="Inserted image" style="display:block;width:${widthStyle};max-width:100%;height:auto;margin:12px 0;" />`;

    if (node && typeof window !== "undefined") {
      node.focus();
      document.execCommand("insertHTML", false, imageHtml);
      return;
    }

    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, bodyHtml: `${section.bodyHtml}${imageHtml}` } : section,
      ),
    );
  }

  if (!item || !mode) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SOP Management</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{item.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Document Title</label>
                {mode === "edit" ? (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none focus:border-slate-500"
                  />
                ) : (
                  <p className="mt-1 text-lg font-bold text-slate-900">{title}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Version</label>
                <p className="mt-1 font-medium text-slate-700">{version}</p>
                {mode === "edit" && (
                  <p className="mt-1 text-xs text-slate-500">Version will be updated automatically when republished</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Effective Date</label>
                {mode === "edit" ? (
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
                  />
                ) : (
                  <p className="mt-1 font-medium text-slate-700">{effectiveDate || "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Department</label>
                {mode === "edit" ? (
                  <input
                    value={contentDepartmentName}
                    onChange={(e) => setContentDepartmentName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
                  />
                ) : (
                  <p className="mt-1 font-medium text-slate-700">{contentDepartmentName}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Prepared By</label>
                {mode === "edit" ? (
                  <input
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
                  />
                ) : (
                  <p className="mt-1 font-medium text-slate-700">{preparedBy || "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approved By</label>
                {mode === "edit" ? (
                  <input
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
                  />
                ) : (
                  <p className="mt-1 font-medium text-slate-700">{approvedBy || "—"}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {mode === "edit" ? "Editable SOP Sections" : "Rendered SOP Sections"}
                </p>
                {mode === "edit" ? (
                  <button
                    type="button"
                    onClick={addSection}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add Section
                  </button>
                ) : null}
              </div>

              {sections
                .filter((s) => (formData ? s.title !== "Document Details" : true))
                .map((section, index) => (
                  <div key={section.id} className="rounded-2xl border border-slate-300 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <input
                        value={section.title}
                        disabled={mode === "view"}
                        onChange={(e) =>
                          setSections((current) =>
                            current.map((row) =>
                              row.id === section.id ? { ...row, title: e.target.value } : row,
                            ),
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-50"
                        placeholder={`Section ${index + 1}`}
                      />
                      {mode === "edit" ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => insertImage(section.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Add Image
                          </button>
                          {sections.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeSection(section.id)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div
                      ref={(node) => {
                        sectionRefs.current[section.id] = node;
                      }}
                      contentEditable={mode === "edit"}
                      suppressContentEditableWarning
                      className={`min-h-[12rem] rounded-2xl border border-slate-300 px-4 py-4 text-sm leading-7 text-slate-800 outline-none ${
                        mode === "edit" ? "bg-white focus:border-slate-500" : "bg-slate-50"
                      }`}
                      dangerouslySetInnerHTML={{ __html: section.bodyHtml }}
                    />
                  </div>
                ))}
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Source File</p>
                <p className="mt-2 break-all text-slate-600">{item.sourceFileName}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{item.sourceFormat}</p>
                {item.sourceFileUrl ? (
                  <a
                    href={item.sourceFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Download Original
                  </a>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Current Assignment</p>
                <p className="mt-2 text-slate-600">{item.departmentName}</p>
                <p className="mt-1 text-slate-600">{item.subDepartmentName || "Department level"}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Edits create a new draft revision and require publish again.
                </p>
              </div>
            </aside>
          </div>

          {mode === "edit" ? (
            <div className="mt-8 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save Revision"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
