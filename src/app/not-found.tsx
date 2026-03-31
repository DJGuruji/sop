import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">404</p>
          <h1 className="mt-3 text-4xl font-bold text-slate-900">Page not found</h1>
          <p className="mt-2 text-slate-600">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          >
            Go to Home
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
