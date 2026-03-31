import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** If user is already authenticated, redirect to admin dashboard (auth pages are for unauthenticated users). */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) redirect("/admin");
  return <>{children}</>;
}
