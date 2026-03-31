"use client";

import React from "react";

export type ProcedureStep = { id: string; step: number; text: string };
export type RevisionRow = { id: string; version: string; date: string; changes: string; author: string };

export type SopFormData = {
  title: string;
  version: string;
  effectiveDate: string;
  contentDepartmentName: string;
  preparedBy: string;
  approvedBy: string;
  purpose: string;
  scope: string;
  procedure: { step: number; text: string }[];
  dataSecurity: string[];
  complianceRequirements: string[];
  auditAndMonitoring: string[];
  revisionHistory: { version: string; date: string; changes: string; author: string }[];
};

function textToItems(text: string) {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function SopFormPreview({ data }: { data: SopFormData }) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white font-sans text-sm text-slate-800 shadow-sm"
      style={{ fontFamily: 'Georgia, serif' }}
    >
      {/* Header bar */}
      <div className="rounded-t-xl bg-slate-800 px-6 py-4 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Standard Operating Procedure
        </p>
        <h1 className="mt-1 text-lg font-bold leading-tight">
          {data.title || <span className="italic text-slate-400">Document Title</span>}
        </h1>
      </div>

      {/* Details table */}
      <table className="w-full border-b border-slate-200 text-xs">
        <tbody>
          {[
            ["Effective Date", data.effectiveDate],
            ["Version", data.version],
            ["Department", data.contentDepartmentName],
            ["Prepared By", data.preparedBy],
            ["Approved By", data.approvedBy],
          ].map(([label, val]) => (
            <tr key={label} className="border-b border-slate-100">
              <td className="w-36 bg-slate-50 px-4 py-2 font-semibold text-slate-600">{label}</td>
              <td className="px-4 py-2 text-slate-800">
                {val || <span className="italic text-slate-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sections */}
      <div className="space-y-0 divide-y divide-slate-100 px-6 py-4">
        {/* Purpose */}
        <PreviewSection num="1" heading="Purpose">
          <p className="text-slate-700 whitespace-pre-wrap">
            {data.purpose || <span className="italic text-slate-400">Describe the purpose…</span>}
          </p>
        </PreviewSection>

        {/* Scope */}
        <PreviewSection num="2" heading="Scope">
          <p className="text-slate-700 whitespace-pre-wrap">
            {data.scope || <span className="italic text-slate-400">Define who and what applies…</span>}
          </p>
        </PreviewSection>

        {/* Procedure */}
        <PreviewSection num="3" heading="Procedure">
          {data.procedure.map((p, idx) => (
            <div key={`proc-${idx}`} className="mb-3">
              <p className="font-semibold text-slate-700">Step {p.step}:</p>
              <ul className="ml-4 mt-1 list-disc space-y-0.5 text-slate-700">
                {textToItems(p.text).length > 0 ? (
                  textToItems(p.text).map((item, i) => <li key={i}>{item}</li>)
                ) : (
                  <li className="italic text-slate-400">—</li>
                )}
              </ul>
            </div>
          ))}
        </PreviewSection>

        {/* Safety */}
        <PreviewSection num="4" heading="Safety and Compliance">
          <p className="mb-1 font-medium text-slate-600">4.1 Data Security:</p>
          <ul className="ml-4 list-disc text-slate-700">
            {data.dataSecurity.length > 0 ? (
              data.dataSecurity.map((i, k) => <li key={k}>{i}</li>)
            ) : (
              <li className="italic text-slate-400">—</li>
            )}
          </ul>
          <p className="mb-1 mt-3 font-medium text-slate-600">4.2 Compliance Requirements:</p>
          <ul className="ml-4 list-disc text-slate-700">
            {data.complianceRequirements.length > 0 ? (
              data.complianceRequirements.map((i, k) => <li key={k}>{i}</li>)
            ) : (
              <li className="italic text-slate-400">—</li>
            )}
          </ul>
          <p className="mb-1 mt-3 font-medium text-slate-600">4.3 Audit and Monitoring:</p>
          <ul className="ml-4 list-disc text-slate-700">
            {data.auditAndMonitoring.length > 0 ? (
              data.auditAndMonitoring.map((i, k) => <li key={k}>{i}</li>)
            ) : (
              <li className="italic text-slate-400">—</li>
            )}
          </ul>
        </PreviewSection>

        {/* Revision History */}
        <PreviewSection num="5" heading="Revision History">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {["Version", "Date", "Changes", "Author"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.revisionHistory.map((r, idx) => (
                <tr key={`rev-${idx}`}>
                  <td className="px-2 py-1.5">{r.version || "—"}</td>
                  <td className="px-2 py-1.5">{r.date || "—"}</td>
                  <td className="px-2 py-1.5">{r.changes || "—"}</td>
                  <td className="px-2 py-1.5">{r.author || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PreviewSection>
      </div>
    </div>
  );
}

function PreviewSection({
  num,
  heading,
  children,
}: {
  num: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4">
      <h2 className="mb-2 text-sm font-bold text-slate-800">
        {num}. {heading}
      </h2>
      <div className="text-sm leading-6">{children}</div>
    </div>
  );
}
