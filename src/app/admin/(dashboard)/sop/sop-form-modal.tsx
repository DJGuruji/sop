"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess } from "@/lib/app-toast";

import { SopFormPreview, type ProcedureStep, type RevisionRow, type SopFormData } from "./sop-form-content";
import { SopAiAssistant } from "./sop-ai-assistant";

type ScopeDept = { id: string; name: string; subDepartments: { id: string; name: string }[] };

type Props = {
  open: boolean;
  onClose: () => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const LABEL_CLS = "block text-sm font-medium text-slate-700 mb-1";
const INPUT_CLS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200";
const TEXTAREA_CLS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 resize-y min-h-[80px]";

export function SopFormModal({ open, onClose }: Props) {
  const router = useRouter();
  const [loadingScope, setLoadingScope] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [departments, setDepartments] = useState<ScopeDept[]>([]);

  // Document Details
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [subDepartmentId, setSubDepartmentId] = useState("");
  const [contentDepartmentName, setContentDepartmentName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");

  // Sections
  const [purpose, setPurpose] = useState("");
  const [scope, setScope] = useState("");
  const [procedures, setProcedures] = useState<ProcedureStep[]>([
    { id: uid(), step: 1, text: "" },
    { id: uid(), step: 2, text: "" },
    { id: uid(), step: 3, text: "" },
  ]);
  const [dataSecurity, setDataSecurity] = useState<{ id: string; text: string }[]>([
    { id: uid(), text: "" },
  ]);
  const [complianceRequirements, setComplianceRequirements] = useState<{ id: string; text: string }[]>([
    { id: uid(), text: "" },
  ]);
  const [auditAndMonitoring, setAuditAndMonitoring] = useState<{ id: string; text: string }[]>([
    { id: uid(), text: "" },
  ]);
  const [revisionHistory, setRevisionHistory] = useState<RevisionRow[]>([
    { id: uid(), version: "1.0", date: new Date().toISOString().slice(0, 10), changes: "Initial version", author: "" },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preview mode
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScopeError(null);
    setLoadingScope(true);
    fetch("/api/sop/library-upload-scope")
      .then((r) => r.json() as Promise<{ success?: boolean; data?: { role: string; departments: ScopeDept[] } }>)
      .then((data) => {
        if (!data.success || !data.data) {
          setScopeError("Unable to load departments.");
          return;
        }
        setRole(data.data.role);
        setDepartments(data.data.departments);
        const first = data.data.departments[0];
        if (first) {
          setDepartmentId(first.id);
          setContentDepartmentName(first.name);
          const firstSub = first.subDepartments[0];
          setSubDepartmentId(data.data.role === "SUPERVISOR" && firstSub ? firstSub.id : "");
        }
      })
      .catch(() => setScopeError("Unable to load departments."))
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
      setSubDepartmentId((prev) =>
        d.subDepartments.some((s) => s.id === prev) ? prev : d.subDepartments[0]?.id ?? "",
      );
      return;
    }
    setSubDepartmentId((prev) => (d.subDepartments.some((s) => s.id === prev) ? prev : ""));
    setContentDepartmentName(d.name);
  }, [departmentId, departments, role]);

  function resetForm() {
    setTitle("");
    setVersion("1.0");
    setEffectiveDate("");
    setContentDepartmentName("");
    setPreparedBy("");
    setApprovedBy("");
    setPurpose("");
    setScope("");
    setProcedures([
      { id: uid(), step: 1, text: "" },
      { id: uid(), step: 2, text: "" },
      { id: uid(), step: 3, text: "" },
    ]);
    setDataSecurity([{ id: uid(), text: "" }]);
    setComplianceRequirements([{ id: uid(), text: "" }]);
    setAuditAndMonitoring([{ id: uid(), text: "" }]);
    setRevisionHistory([
      { id: uid(), version: "1.0", date: new Date().toISOString().slice(0, 10), changes: "Initial version", author: "" },
    ]);
    setFormError(null);
    setShowPreview(false);
  }

  // Procedure helpers
  function addProcedure() {
    setProcedures((prev) => [...prev, { id: uid(), step: prev.length + 1, text: "" }]);
  }
  function removeProcedure(id: string) {
    setProcedures((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.map((p, i) => ({ ...p, step: i + 1 }));
    });
  }
  function updateProcedure(id: string, text: string) {
    setProcedures((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
  }

  // Safety helpers
  function addSafetyItem(setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>) {
    setter((prev) => [...prev, { id: uid(), text: "" }]);
  }
  function removeSafetyItem(
    id: string,
    setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>,
  ) {
    setter((prev) => prev.filter((p) => p.id !== id));
  }
  function updateSafetyItem(
    id: string,
    text: string,
    setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>,
  ) {
    setter((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
  }

  // Revision history helpers
  function addRevision() {
    setRevisionHistory((prev) => [
      ...prev,
      {
        id: uid(),
        version: "1.1",
        date: new Date().toISOString().slice(0, 10),
        changes: "Updated",
        author: "",
      },
    ]);
  }

  function handleMagicFill(data: any) {
    if (!data) return;
    if (data.title) setTitle(data.title);
    if (data.purpose) setPurpose(data.purpose);
    if (data.scope) setScope(data.scope);

    if (Array.isArray(data.procedure)) {
      setProcedures(data.procedure.map((p: any) => ({ ...p, id: uid() })));
    }

    if (Array.isArray(data.dataSecurity)) {
      setDataSecurity(data.dataSecurity.map((s: string) => ({ id: uid(), text: s })));
    }
    if (Array.isArray(data.complianceRequirements)) {
      setComplianceRequirements(data.complianceRequirements.map((s: string) => ({ id: uid(), text: s })));
    }
    if (Array.isArray(data.auditAndMonitoring)) {
      setAuditAndMonitoring(data.auditAndMonitoring.map((s: string) => ({ id: uid(), text: s })));
    }

    toastSuccess("Magic Fill applied! Please review the form.");
  }
  function removeRevision(id: string) {
    setRevisionHistory((prev) => prev.filter((r) => r.id !== id));
  }
  function updateRevision(id: string, field: keyof Omit<RevisionRow, "id">, value: string) {
    setRevisionHistory((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError("Document title is required.");
    if (!effectiveDate) return setFormError("Effective date is required.");
    if (!departmentId) return setFormError("Department is required.");
    if (role === "SUPERVISOR" && !subDepartmentId) return setFormError("Sub-department is required.");
    if (!purpose.trim()) return setFormError("Purpose section is required.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/sop/library-items/create-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          subDepartmentId: subDepartmentId || null,
          title: title.trim(),
          effectiveDate,
          preparedBy: preparedBy.trim(),
          approvedBy: approvedBy.trim(),
          contentDepartmentName: (contentDepartmentName || selectedDept?.name || "").trim(),
          purpose: purpose.trim(),
          scope: scope.trim(),
          procedure: procedures.map(({ step, text }) => ({ step, text })),
          dataSecurity: dataSecurity.map((s) => s.text.trim()).filter(Boolean),
          complianceRequirements: complianceRequirements.map((s) => s.text.trim()).filter(Boolean),
          auditAndMonitoring: auditAndMonitoring.map((s) => s.text.trim()).filter(Boolean),
          revisionHistory: revisionHistory.map(({ version: v, date, changes, author }) => ({
            version: v,
            date,
            changes,
            author,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { success: true }
        | { success: false; error: { message: string } };
      if (!res.ok || data.success === false) {
        setFormError(data.success === false ? data.error.message : "Failed to create SOP.");
        return;
      }
      resetForm();
      onClose();
      toastSuccess("SOP created successfully.");
      router.push("/admin/sop?tab=draft");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const singleScopedDept =
    role === "SUPERVISOR" || (role === "DEPARTMENT_ADMIN" && departments.length <= 1);
  const supervisorSubName =
    role === "SUPERVISOR" ? subOptions.find((s) => s.id === subDepartmentId)?.name ?? "" : "";

  return (
    <>
      <SopAiAssistant
        context={{
          title,
          department: contentDepartmentName || selectedDept?.name || "Untitled",
          purpose,
        }}
        onApply={handleMagicFill}
      />
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sop-form-modal-title"
      >
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Create SOP</p>
            <h2 id="sop-form-modal-title" className="mt-1 text-xl font-semibold text-slate-900">
              Complete SOP Form
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Fill in the structured template. The form will be converted to an editable HTML SOP document.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        {loadingScope ? (
          <div className="px-6 py-10 text-sm text-slate-600">Loading…</div>
        ) : scopeError ? (
          <div className="px-6 py-10 text-sm text-red-700">{scopeError}</div>
        ) : departments.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-600">No departments available.</div>
        ) : (
          <div className={`grid gap-0 ${showPreview ? "lg:grid-cols-2" : ""}`}>
            {/* Form */}
            <form
              onSubmit={(e) => void onSubmit(e)}
              className="space-y-0 divide-y divide-slate-100"
            >
              {/* ── Document Details ── */}
              <section className="px-6 py-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Document Details
                </h3>

                {/* Department scope */}
                {role === "SUPERVISOR" && selectedDept ? (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Scope</p>
                    <p className="mt-1">
                      <span className="text-slate-500">Department:</span> {selectedDept.name}
                    </p>
                    <p className="mt-0.5">
                      <span className="text-slate-500">Sub-department:</span>{" "}
                      {supervisorSubName || "—"}
                    </p>
                  </div>
                ) : singleScopedDept && selectedDept ? (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Department:</span>{" "}
                    {selectedDept.name}
                  </div>
                ) : (
                  <div className="mb-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="sop-form-dept" className={LABEL_CLS}>
                        Department <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="sop-form-dept"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        className={INPUT_CLS}
                        required
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {subOptions.length > 0 ? (
                      <div>
                        <label htmlFor="sop-form-sub" className={LABEL_CLS}>
                          Sub-department{" "}
                          <span className="font-normal text-slate-500">(optional)</span>
                        </label>
                        <select
                          id="sop-form-sub"
                          value={subDepartmentId}
                          onChange={(e) => setSubDepartmentId(e.target.value)}
                          className={INPUT_CLS}
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
                  </div>
                )}

                {/* Dept sub select for DEPT_ADMIN with single dept */}
                {role === "DEPARTMENT_ADMIN" && singleScopedDept && subOptions.length > 0 ? (
                  <div className="mb-4">
                    <label htmlFor="sop-form-sub-da" className={LABEL_CLS}>
                      Sub-department{" "}
                      <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <select
                      id="sop-form-sub-da"
                      value={subDepartmentId}
                      onChange={(e) => setSubDepartmentId(e.target.value)}
                      className={INPUT_CLS}
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="sop-form-title" className={LABEL_CLS}>
                      Document Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="sop-form-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={INPUT_CLS}
                      placeholder="Enter document title"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="sop-form-effective" className={LABEL_CLS}>
                      Effective Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="sop-form-effective"
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className={INPUT_CLS}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="sop-form-version" className={LABEL_CLS}>
                      Version
                    </label>
                    <input
                      id="sop-form-version"
                      value={version}
                      readOnly
                      className={`${INPUT_CLS} bg-slate-50 text-slate-600 cursor-not-allowed`}
                      placeholder="1.0"
                    />
                    <p className="mt-1 text-xs text-slate-500">Version is automatically assigned</p>
                  </div>
                  <div>
                    <label htmlFor="sop-form-dept-label" className={LABEL_CLS}>
                      Department (on document)
                    </label>
                    <input
                      id="sop-form-dept-label"
                      value={contentDepartmentName}
                      onChange={(e) => setContentDepartmentName(e.target.value)}
                      className={INPUT_CLS}
                      placeholder={selectedDept?.name ?? "Department name"}
                    />
                  </div>
                  <div>
                    <label htmlFor="sop-form-prepared" className={LABEL_CLS}>
                      Prepared By
                    </label>
                    <input
                      id="sop-form-prepared"
                      value={preparedBy}
                      onChange={(e) => setPreparedBy(e.target.value)}
                      className={INPUT_CLS}
                      placeholder="Name / designation"
                    />
                  </div>
                  <div>
                    <label htmlFor="sop-form-approved" className={LABEL_CLS}>
                      Approved By
                    </label>
                    <input
                      id="sop-form-approved"
                      value={approvedBy}
                      onChange={(e) => setApprovedBy(e.target.value)}
                      className={INPUT_CLS}
                      placeholder="Name / designation"
                    />
                  </div>
                </div>
              </section>

              {/* ── 1. Purpose ── */}
              <section className="px-6 py-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  1. Purpose
                </h3>
                <label htmlFor="sop-form-purpose" className={LABEL_CLS}>
                  Describe the purpose of this SOP. <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="sop-form-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className={TEXTAREA_CLS}
                  placeholder="Describe the purpose of this SOP."
                  required
                />
              </section>

              {/* ── 2. Scope ── */}
              <section className="px-6 py-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  2. Scope
                </h3>
                <label htmlFor="sop-form-scope" className={LABEL_CLS}>
                  Define who and what this SOP applies to.
                </label>
                <textarea
                  id="sop-form-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className={TEXTAREA_CLS}
                  placeholder="Define who and what this SOP applies to."
                />
              </section>

              {/* ── 3. Procedure ── */}
              <section className="px-6 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    3. Procedure
                  </h3>
                  <button
                    type="button"
                    onClick={addProcedure}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {procedures.map((proc) => (
                    <div key={proc.id} className="flex gap-3">
                      <div className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {proc.step}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={proc.text}
                          onChange={(e) => updateProcedure(proc.id, e.target.value)}
                          className={TEXTAREA_CLS + " min-h-[60px]"}
                          placeholder={`Step ${proc.step} description (one item per line)`}
                        />
                      </div>
                      {procedures.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeProcedure(proc.id)}
                          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              {/* ── 4. Safety and Compliance ── */}
              <section className="px-6 py-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  4. Safety and Compliance
                </h3>
                <div className="space-y-6">
                  {/* 4.1 Data Security */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className={LABEL_CLS + " mb-0"}>4.1 Data Security</label>
                      <button
                        type="button"
                        onClick={() => addSafetyItem(setDataSecurity)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        + Add Step
                      </button>
                    </div>
                    <div className="space-y-2">
                      {dataSecurity.map((s) => (
                        <div key={s.id} className="flex gap-2">
                          <input
                            value={s.text}
                            onChange={(e) => updateSafetyItem(s.id, e.target.value, setDataSecurity)}
                            className={INPUT_CLS}
                            placeholder="Data security measure"
                          />
                          {dataSecurity.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeSafetyItem(s.id, setDataSecurity)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 text-red-600 hover:bg-red-100"
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4.2 Compliance Requirements */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className={LABEL_CLS + " mb-0"}>4.2 Compliance Requirements</label>
                      <button
                        type="button"
                        onClick={() => addSafetyItem(setComplianceRequirements)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        + Add Step
                      </button>
                    </div>
                    <div className="space-y-2">
                      {complianceRequirements.map((s) => (
                        <div key={s.id} className="flex gap-2">
                          <input
                            value={s.text}
                            onChange={(e) =>
                              updateSafetyItem(s.id, e.target.value, setComplianceRequirements)
                            }
                            className={INPUT_CLS}
                            placeholder="Compliance requirement"
                          />
                          {complianceRequirements.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeSafetyItem(s.id, setComplianceRequirements)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 text-red-600 hover:bg-red-100"
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4.3 Audit and Monitoring */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className={LABEL_CLS + " mb-0"}>4.3 Audit and Monitoring</label>
                      <button
                        type="button"
                        onClick={() => addSafetyItem(setAuditAndMonitoring)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        + Add Step
                      </button>
                    </div>
                    <div className="space-y-2">
                      {auditAndMonitoring.map((s) => (
                        <div key={s.id} className="flex gap-2">
                          <input
                            value={s.text}
                            onChange={(e) =>
                              updateSafetyItem(s.id, e.target.value, setAuditAndMonitoring)
                            }
                            className={INPUT_CLS}
                            placeholder="Audit/monitoring detail"
                          />
                          {auditAndMonitoring.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeSafetyItem(s.id, setAuditAndMonitoring)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 text-red-600 hover:bg-red-100"
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* ── 5. Revision History ── */}
              <section className="px-6 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    5. Revision History
                  </h3>
                  <button
                    type="button"
                    onClick={addRevision}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    + Add Row
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Version</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Changes</th>
                        <th className="px-3 py-2 text-left">Author</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {revisionHistory.map((row) => (
                        <tr key={row.id}>
                          <td className="px-2 py-1.5">
                            <input
                              value={row.version}
                              onChange={(e) => updateRevision(row.id, "version", e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              placeholder="1.0"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => updateRevision(row.id, "date", e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={row.changes}
                              onChange={(e) => updateRevision(row.id, "changes", e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              placeholder="Changes description"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={row.author}
                              onChange={(e) => updateRevision(row.id, "author", e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              placeholder="Author"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            {revisionHistory.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeRevision(row.id)}
                                className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                              >
                                ✕
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Error + Actions */}
              <div className="px-6 py-5">
                {formError ? (
                  <div
                    className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    role="alert"
                  >
                    {formError}
                  </div>
                ) : null}
                <div className="flex justify-end gap-2">
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
                    className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {submitting ? "Creating…" : "Create SOP"}
                  </button>
                </div>
              </div>
            </form>

            {/* ── Live HTML Preview ── */}
            {showPreview ? (
              <aside className="hidden lg:block border-l border-slate-200">
                <div className="sticky top-0 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Document Preview
                  </p>
                </div>
                <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(100vh - 180px)" }}>
                  <SopFormPreview
                    data={{
                      title,
                      version,
                      effectiveDate,
                      contentDepartmentName: contentDepartmentName || selectedDept?.name || "",
                      preparedBy,
                      approvedBy,
                      purpose,
                      scope,
                      procedure: procedures,
                      dataSecurity: dataSecurity.map((s) => s.text),
                      complianceRequirements: complianceRequirements.map((s) => s.text),
                      auditAndMonitoring: auditAndMonitoring.map((s) => s.text),
                      revisionHistory,
                    }}
                  />
                </div>
              </aside>
            ) : null}
          </div>
        )}
      </div>
    </div>
  </>
  );
}


