import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import DepartmentsListClient from "./departments-list-client";

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session?.sub) redirect("/admin/login");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true, departmentId: true, subDepartmentId: true },
  });

  if (
    user?.role === Role.SUPERVISOR &&
    user.departmentId &&
    user.subDepartmentId
  ) {
    redirect(
      `/admin/departments/${user.departmentId}/subdepartments/${user.subDepartmentId}`,
    );
  }

  return <DepartmentsListClient />;
}
