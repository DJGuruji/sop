import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin • SOP",
};

/** Root admin layout: no auth redirect. Auth + sidebar live in (dashboard)/layout.tsx so /admin/login is not wrapped and does not redirect in a loop. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

