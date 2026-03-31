"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Department = {
  id: string;
  name: string;
};

export function SopUploadForm({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !version.trim() || !effectiveDate || !departmentId || !file) {
      setError("All fields are required.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("version", version.trim());
    formData.set("effectiveDate", effectiveDate);
    formData.set("departmentId", departmentId);
    formData.set("file", file);

    startTransition(async () => {
      const res = await fetch("/api/sop/templates", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as
        | { success: true }
        | { success: false; error: { message: string } };

      if (!res.ok || ("success" in data && data.success === false)) {
        setError("success" in data && data.success === false ? data.error.message : "Unable to upload SOP template.");
        return;
      }

      setTitle("");
      setVersion("1.0");
      setEffectiveDate("");
      setFile(null);
      const fileInput = document.getElementById("sop-file-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Upload SOP</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Add SOP Template</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload a `.docx` SOP file to add it to the SOP library.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="SOP title"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Version</span>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="1.0"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Effective Date</span>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Department</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            required
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">DOCX File</span>
        <input
          id="sop-file-input"
          type="file"
          accept=".docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
          required
        />
      </label>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "Uploading..." : "Upload SOP"}
        </button>
      </div>
    </form>
  );
}
