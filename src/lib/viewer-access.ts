import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requiredEmailDomain } from "@/lib/recaptcha";

export type ViewerUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function requireViewerUser(): Promise<ViewerUser> {
  const session = await getSession();
  if (!session?.sub) {
    redirect("/auth/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user?.isActive || !requiredEmailDomain(user.email)) {
    redirect("/auth/login");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
