"use client";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` = destructive (red); `primary` = main action (indigo). */
  variant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  /** Shown under the message (e.g. API error while modal stays open). */
  inlineError?: string | null;
};

export function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
  loading = false,
  inlineError,
}: Props) {
  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-indigo-600 hover:bg-indigo-700 text-white";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="confirm-action-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-line">{message}</p>
        {inlineError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {inlineError}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
