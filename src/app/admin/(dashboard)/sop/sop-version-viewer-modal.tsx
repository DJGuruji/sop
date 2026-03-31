"use client";

import { useState, useEffect } from "react";

type VersionData = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  changeSummary: string | null;
  isLatest: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  title: string;
  effectiveDate: string;
  department: string;
  subDepartment: string;
  preparedBy: string;
  approvedBy: string;
  editableHtml: string;
  sections: Array<{
    id: string;
    title: string;
    bodyHtml: string;
  }>;
};

type Props = {
  sopId: string | null;
  versionId: string | null;
  versionLabel: string;
  onClose: () => void;
  onBack: () => void;
};

export function SopVersionViewerModal({ sopId, versionId, versionLabel, onClose, onBack }: Props) {
  const [version, setVersion] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sopId || !versionId) return;

    async function fetchVersion() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/sop/library-items/${sopId}/versions/${versionId}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to fetch version");
        }
        
        setVersion(data.data.version);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch version");
      } finally {
        setLoading(false);
      }
    }

    fetchVersion();
  }, [sopId, versionId]);

  if (!sopId || !versionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-6xl rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              SOP Version {versionLabel}
            </h2>
            <p className="text-sm text-slate-600">{version?.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              ← Back to History
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <span className="text-lg">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-slate-500">Loading version...</div>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : version ? (
            <div className="space-y-6">
              {/* Version Info */}
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Version
                    </label>
                    <p className="mt-1 font-medium text-slate-700">{version.versionLabel}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Effective Date
                    </label>
                    <p className="mt-1 font-medium text-slate-700">{version.effectiveDate || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Department
                    </label>
                    <p className="mt-1 font-medium text-slate-700">{version.department || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Created
                    </label>
                    <p className="mt-1 font-medium text-slate-700">
                      {new Date(version.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {version.changeSummary && (
                  <div className="mt-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Change Summary
                    </label>
                    <p className="mt-1 text-sm text-slate-600">{version.changeSummary}</p>
                  </div>
                )}
              </div>

              {/* SOP Content */}
              <div className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="font-medium text-slate-900">SOP Content</h3>
                </div>
                <div className="p-4">
                  {version.editableHtml ? (
                    <div 
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: version.editableHtml }}
                    />
                  ) : version.sections && version.sections.length > 0 ? (
                    <div className="space-y-6">
                      {version.sections.map((section, index) => (
                        <div key={section.id || index}>
                          <h4 className="mb-2 font-medium text-slate-900">{section.title}</h4>
                          <div 
                            className="prose max-w-none text-sm text-slate-700"
                            dangerouslySetInnerHTML={{ __html: section.bodyHtml }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">No content available</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-200 px-6 py-4">
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to History
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}