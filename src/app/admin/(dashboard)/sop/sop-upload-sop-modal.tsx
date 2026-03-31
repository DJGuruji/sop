"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess } from "@/lib/app-toast";

type ScopeDept = { id: string; name: string; subDepartments: { id: string; name: string }[] };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called when user picks the "Complete Form" option */
  onOpenForm: () => void;
};

type ChoiceMode = "choose" | "upload";

export function SopUploadSopModal({ open, onClose, onOpenForm }: Props) {
  const router = useRouter();
  const [choiceMode, setChoiceMode] = useState<ChoiceMode>("choose");
  const [loadingScope, setLoadingScope] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [departments, setDepartments] = useState<ScopeDept[]>([]);

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [subDepartmentId, setSubDepartmentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChoiceMode("choose");
    setScopeError(null);
    setLoadingScope(true);
    fetch("/api/sop/library-upload-scope")
      .then((r) => r.json() as Promise<{ success?: boolean; data?: { role: string; departments: ScopeDept[] } }>)
      .then((data) => {
        if (!data.success || !data.data) {
          setScopeError("Unable to load departments.");
          setDepartments([]);
          return;
        }
        const r = data.data.role;
        setRole(r);
        setDepartments(data.data.departments);
        const first = data.data.departments[0];
        if (first) {
          setDepartmentId(first.id);
          const firstSub = first.subDepartments[0];
          // Supervisors must have their sub; others default to department-level (no sub) until they pick one.
          setSubDepartmentId(r === "SUPERVISOR" && firstSub ? firstSub.id : "");
        } else {
          setDepartmentId("");
          setSubDepartmentId("");
        }
      })
      .catch(() => {
        setScopeError("Unable to load departments.");
        setDepartments([]);
      })
      .finally(() => setLoadingScope(false));
  }, [open]);

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === departmentId) ?? null,
    [departments, departmentId],
  );

  const subOptions = selectedDept?.subDepartments ?? [];

  useEffect(() => {
    const d = departments.find((x) => x.id === departmentId);
    if (!d) return;

    if (role === "SUPERVISOR") {
      if (!d.subDepartments.length) {
        setSubDepartmentId("");
        return;
      }
      setSubDepartmentId((prev) =>
        d.subDepartments.some((s) => s.id === prev) ? prev : d.subDepartments[0]!.id,
      );
      return;
    }

    // Optional sub-department: keep selection only if it still belongs to this department; otherwise "None".
    if (!d.subDepartments.length) {
      setSubDepartmentId("");
      return;
    }
    setSubDepartmentId((prev) => (d.subDepartments.some((s) => s.id === prev) ? prev : ""));
  }, [departmentId, departments, role]);

  function resetForm() {
    setTitle("");
    setVersion("1.0");
    setEffectiveDate("");
    setFile(null);
    setFormError(null);
    setChoiceMode("choose");
    const inp = document.getElementById("sop-upload-sop-file") as HTMLInputElement | null;
    if (inp) inp.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !effectiveDate || !departmentId || !file) {
      setFormError("Fill in all required fields and choose a Word or PDF file.");
      return;
    }
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".doc") && !ext.endsWith(".docx") && !ext.endsWith(".pdf")) {
      setFormError("File must be .doc, .docx, or .pdf.");
      return;
    }
    if (role === "SUPERVISOR" && !subDepartmentId) {
      setFormError("Sub-department is required.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("effectiveDate", effectiveDate);
      formData.set("departmentId", departmentId);
      if (subDepartmentId) formData.set("subDepartmentId", subDepartmentId);
      formData.set("file", file);

      const res = await fetch("/api/sop/library-items/upload", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as
        | { success: true }
        | { success: false; error: { message: string } };

      if (!res.ok || data.success === false) {
        setFormError(data.success === false ? data.error.message : "Upload failed.");
        return;
      }
      resetForm();
      onClose();
      toastSuccess("SOP uploaded successfully.");
      router.push("/admin/sop?tab=draft");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const showSubDept = subOptions.length > 0;
  /** Single assigned / scoped department — no org-wide department picker. */
  const singleScopedDept = role === "SUPERVISOR" || (role === "DEPARTMENT_ADMIN" && departments.length <= 1);
  const supervisorScope = role === "SUPERVISOR" && selectedDept && subOptions.length > 0;
  const supervisorSubName = supervisorScope ? subOptions.find((s) => s.id === subDepartmentId)?.name ?? subOptions[0]?.name : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sop-upload-sop-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            {choiceMode === "upload" && (
              <button
                type="button"
                onClick={() => setChoiceMode("choose")}
                className="mb-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                ← Back
              </button>
            )}
            <h2 id="sop-upload-sop-title" className="text-lg font-semibold text-slate-900">
              {choiceMode === "choose" ? "Add SOP" : "Upload SOP File"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {loadingScope ? (
          <p className="mt-6 text-sm text-slate-600">Loading…</p>
        ) : scopeError ? (
          <p className="mt-6 text-sm text-red-700">{scopeError}</p>
        ) : departments.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">No departments are available for your account.</p>
        ) : choiceMode === "choose" ? (
          /* ── Choice Screen ── */
          <div className="mt-5 space-y-3">
            <p className="text-sm text-slate-600">How would you like to add this SOP?</p>
            <button
              type="button"
              onClick={() => setChoiceMode("upload")}
              className="flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Upload SOP File</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Upload an existing Word (.doc/.docx) or PDF file. We&apos;ll convert it to editable HTML.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenForm();
              }}
              className="flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Complete Form</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Fill in the structured SOP template with all required fields. Preview the document as you type.
                </p>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4">
            <div>
              <label htmlFor="sop-upload-title" className="mb-1 block text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="sop-upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="SOP title"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sop-upload-version" className="mb-1 block text-sm font-medium text-slate-700">
                  Version
                </label>
                <input
                  id="sop-upload-version"
                  value={version}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-500">Version is automatically assigned</p>
              </div>
              <div>
                <label htmlFor="sop-upload-effective" className="mb-1 block text-sm font-medium text-slate-700">
                  Effective date <span className="text-red-500">*</span>
                </label>
                <input
                  id="sop-upload-effective"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  required
                />
              </div>
            </div>

            {role === "SUPERVISOR" && selectedDept ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Scope</p>
                <p className="mt-1">
                  <span className="text-slate-500">Department:</span> {selectedDept.name}
                </p>
                <p className="mt-0.5">
                  <span className="text-slate-500">Sub-department:</span> {supervisorSubName || "—"}
                </p>
                <p className="mt-2 text-xs text-slate-500">SOPs are created for your assigned sub-department.</p>
              </div>
            ) : null}

            {role === "DEPARTMENT_ADMIN" && selectedDept ? (
              <div>
                {singleScopedDept ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Department</p>
                    <p className="mt-1">{selectedDept.name}</p>
                    <p className="mt-2 text-xs text-slate-500">You can only upload SOPs under your department.</p>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="sop-upload-dept" className="mb-1 block text-sm font-medium text-slate-700">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="sop-upload-dept"
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                      required
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Only departments you manage are listed.</p>
                  </div>
                )}
                {showSubDept ? (
                  <div className="mt-4">
                    <label htmlFor="sop-upload-sub" className="mb-1 block text-sm font-medium text-slate-700">
                      Sub-department
                      <span className="font-normal text-slate-500"> (optional)</span>
                    </label>
                    <select
                      id="sop-upload-sub"
                      value={subDepartmentId}
                      onChange={(e) => setSubDepartmentId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                    >
                      <option value="">— None (department-level SOP) —</option>
                      {subOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">No sub-departments yet — SOP will be department-level.</p>
                )}
              </div>
            ) : null}

            {role !== "SUPERVISOR" && role !== "DEPARTMENT_ADMIN" ? (
              <div>
                <label htmlFor="sop-upload-dept" className="mb-1 block text-sm font-medium text-slate-700">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  id="sop-upload-dept"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {role !== "SUPERVISOR" && role !== "DEPARTMENT_ADMIN" && showSubDept ? (
              <div>
                <label htmlFor="sop-upload-sub" className="mb-1 block text-sm font-medium text-slate-700">
                  Sub-department
                  <span className="font-normal text-slate-500"> (optional)</span>
                </label>
                <select
                  id="sop-upload-sub"
                  value={subDepartmentId}
                  onChange={(e) => setSubDepartmentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">— None —</option>
                  {subOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label htmlFor="sop-upload-sop-file" className="mb-1 block text-sm font-medium text-slate-700">
                File (.doc, .docx, or .pdf) <span className="text-red-500">*</span>
              </label>
              <input
                id="sop-upload-sop-file"
                type="file"
                accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-slate-500"
                required
              />
            </div>

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {formError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
