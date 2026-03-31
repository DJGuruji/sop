"use client";

import { useState, useEffect } from "react";

type VersionHistoryItem = {
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
};

type Props = {
  sopId: string | null;
  sopTitle: string;
  onClose: () => void;
  onViewVersion?: (versionId: string, versionLabel: string) => void;
};

export function SopVersionHistoryModal({ sopId, sopTitle, onClose, onViewVersion }: Props) {
  const [versions, setVersions] = useState<VersionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sopId) return;

    async function fetchVersions() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/sop/library-items/${sopId}/versions`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to fetch version history");
        }
        
        setVersions(data.data.versions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch version history");
      } finally {
        setLoading(false);
      }
    }

    fetchVersions();
  }, [sopId]);

  if (!sopId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-4xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Version History</h2>
            <p className="text-sm text-slate-600">{sopTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="text-lg">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-slate-500">Loading version history...</div>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-2xl text-slate-400">📄</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">No version history available</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    version.isLatest
                      ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => onViewVersion?.(version.id, version.versionLabel)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900">
                          Version {version.versionLabel}
                        </h3>
                        {version.isLatest && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            Current
                          </span>
                        )}
                      </div>
                      
                      {version.changeSummary && (
                        <p className="mt-1 text-sm text-slate-600">{version.changeSummary}</p>
                      )}
                      
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div className="flex items-center gap-1">
                          <span>🕒</span>
                          <span>
                            {new Date(version.createdAt).toLocaleDateString()} at{" "}
                            {new Date(version.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>👤</span>
                          <span>{version.createdBy.name}</span>
                        </div>
                      </div>
                      
                      {version.effectiveDate && (
                        <div className="mt-1 text-xs text-slate-500">
                          Effective Date: {version.effectiveDate}
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4 text-right">
                      <div className="text-xs text-slate-400">
                        v{version.versionNumber}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
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