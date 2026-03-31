import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** If user is already authenticated, redirect to admin dashboard. */
export default async function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) redirect("/admin");
  return <>{children}</>;
}
