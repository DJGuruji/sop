import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ok } from "@/lib/apiResponse";

export async function GET(req: Request) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(ok({ ok: true }), { status: 200 });
  } catch (error) {
    return NextResponse.json(
      ok({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 },
    );
  }
}

