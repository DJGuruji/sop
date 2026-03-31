import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import {
  ALLOWED_SOP_TEMPLATE_UPLOAD_NAMES,
  SOP_TEMPLATE_DOCX_FILENAME,
  SOP_TEMPLATE_PDF_FILENAME,
} from "@/lib/sop-template-files";

const SUPER_ADMIN_ONLY: Role[] = [Role.SUPER_ADMIN];

export async function POST(req: Request) {
  const auth = await requireActor(SUPER_ADMIN_ONLY);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid form data"), { status: 400 });
  }

  const entries = formData.getAll("files");
  const files = entries.filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Select at least one file"), { status: 400 });
  }

  const allowed = new Set<string>(ALLOWED_SOP_TEMPLATE_UPLOAD_NAMES);
  const uploadsDir = path.join(process.cwd(), "public", "sop-templates");
  await mkdir(uploadsDir, { recursive: true });

  const replaced: string[] = [];

  for (const file of files) {
    const name = path.basename(file.name.trim());
    if (!allowed.has(name)) {
      return NextResponse.json(
        fail(
          "VALIDATION_ERROR",
          `Invalid file name "${name}". Only ${SOP_TEMPLATE_DOCX_FILENAME} and ${SOP_TEMPLATE_PDF_FILENAME} are allowed.`,
        ),
        { status: 400 },
      );
    }

    if (name === SOP_TEMPLATE_DOCX_FILENAME && !name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Sop-Template must be a .docx file"), { status: 400 });
    }
    if (name === SOP_TEMPLATE_PDF_FILENAME && !name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Sop-Template must be a .pdf file"), { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dest = path.join(uploadsDir, name);
    await writeFile(dest, buffer);
    replaced.push(name);
  }

  return NextResponse.json(ok({ replaced }), { status: 200 });
}
