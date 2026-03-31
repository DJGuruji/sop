import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(fail("UNAUTHORIZED", "Not authenticated"), { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      departmentId: true,
      subDepartmentId: true,
    },
  });

  if (!user?.isActive) {
    return NextResponse.json(fail("UNAUTHORIZED", "Not authenticated"), { status: 401 });
  }

  return NextResponse.json(ok({ user }), { status: 200 });
}

