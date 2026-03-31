import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import {
  ALLOWED_POLICY_TEMPLATE_UPLOAD_NAMES,
  POLICY_TEMPLATE_DOCX_FILENAME,
  POLICY_TEMPLATE_PDF_FILENAME,
} from "@/lib/policy-template-files";

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

  const allowed = new Set<string>(ALLOWED_POLICY_TEMPLATE_UPLOAD_NAMES);
  const uploadsDir = path.join(process.cwd(), "public", "policy-templates");
  await mkdir(uploadsDir, { recursive: true });

  const replaced: string[] = [];

  for (const file of files) {
    const name = path.basename(file.name.trim());
    if (!allowed.has(name)) {
      return NextResponse.json(
        fail(
          "VALIDATION_ERROR",
          `Invalid file name "${name}". Only ${POLICY_TEMPLATE_DOCX_FILENAME} and ${POLICY_TEMPLATE_PDF_FILENAME} are allowed.`,
        ),
        { status: 400 },
      );
    }

    if (name === POLICY_TEMPLATE_DOCX_FILENAME && !name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Policy-Template must be a .docx file"), { status: 400 });
    }
    if (name === POLICY_TEMPLATE_PDF_FILENAME && !name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Policy-Template must be a .pdf file"), { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dest = path.join(uploadsDir, name);
    await writeFile(dest, buffer);
    replaced.push(name);
  }

  return NextResponse.json(ok({ replaced }), { status: 200 });
}
