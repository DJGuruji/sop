import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, ADMIN_ROLES } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DocumentStatus, DocumentType } from "@/generated/prisma/enums";

function slugifyFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);
  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safeBase || "policy-template"}-${randomUUID().slice(0, 8)}${ext}`;
}

export async function POST(req: Request) {
  const auth = await requireActor(ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid form data"), { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const effectiveDate = String(formData.get("effectiveDate") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "").trim();
  const file = formData.get("file");

  if (!title || !version || !effectiveDate || !departmentId || !(file instanceof File)) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Title, version, effective date, department, and DOCX file are required"),
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Only .docx files are supported"), { status: 400 });
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, deletedAt: true },
  });

  if (!department || department.deletedAt) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Selected department does not exist"), { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "policy-templates");
  await mkdir(uploadsDir, { recursive: true });

  const storedFileName = slugifyFileName(file.name);
  const storedPath = path.join(uploadsDir, storedFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(storedPath, buffer);

  const content = {
    templateType: "POLICY",
    documentTitle: title,
    version,
    effectiveDate,
    department: department.name,
    sourceFileName: file.name,
    sourceFileUrl: `/policy-templates/${storedFileName}`,
    uploadedAt: new Date().toISOString(),
  };

  const serialNo = `POL-UPL-${Date.now()}`;

  const document = await prisma.document.create({
    data: {
      serialNo,
      type: DocumentType.POLICY,
      title,
      departmentId: department.id,
      createdById: auth.actor.id,
      currentVersion: 1,
      status: DocumentStatus.APPROVED,
      isPublished: true,
      publishedAt: new Date(),
      publishedById: auth.actor.id,
      versions: {
        create: {
          versionNumber: 1,
          content,
          changeSummary: "Uploaded policy template",
          isLatest: true,
          createdById: auth.actor.id,
        },
      },
    },
    select: {
      id: true,
      serialNo: true,
      versions: {
        where: { versionNumber: 1 },
        select: { id: true },
        take: 1,
      },
    },
  });

  const latestVersionId = document.versions[0]?.id;
  if (latestVersionId) {
    await prisma.document.update({
      where: { id: document.id },
      data: { latestVersionId },
    });
  }

  return NextResponse.json(ok({ id: document.id, serialNo: document.serialNo }), { status: 201 });
}
