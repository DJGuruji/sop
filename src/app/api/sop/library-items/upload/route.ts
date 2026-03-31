import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { canManageDepartmentScoped, requireActor, SOP_LIBRARY_UPLOAD_ROLES, type Actor } from "@/lib/authz";
import { convertSopFileToEditableContent, sanitizeEditableHtml } from "@/lib/sop-editable-content";
import { prisma } from "@/lib/prisma";
import { SOP_LIBRARY_UPLOAD_SERIAL_PREFIX } from "@/lib/sop-library-upload";
import { getS3SopEnv, uploadSopFileToS3 } from "@/lib/s3-sop-upload";
import { DocumentStatus, DocumentType, Role } from "@/generated/prisma/enums";

function slugifyFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);
  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safeBase || "sop-upload"}-${randomUUID().slice(0, 8)}${ext}`;
}

async function validateSopUploadScope(
  actor: Actor,
  departmentId: string,
  subDepartmentId: string | null,
): Promise<
  { ok: true; subDepartmentName: string | null; departmentName: string } | { ok: false; message: string }
> {
  const dept = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null },
    select: { id: true, name: true, createdById: true },
  });
  if (!dept) return { ok: false, message: "Selected department does not exist" };

  if (actor.role === Role.SUPERVISOR) {
    if (actor.departmentId !== departmentId) {
      return { ok: false, message: "You can only upload for your department" };
    }
    if (!actor.subDepartmentId || !subDepartmentId) {
      return { ok: false, message: "Sub-department is required" };
    }
    if (subDepartmentId !== actor.subDepartmentId) {
      return { ok: false, message: "Invalid sub-department" };
    }
  }

  if (actor.role === Role.DEPARTMENT_ADMIN) {
    if (!canManageDepartmentScoped(actor, dept.id, dept.createdById)) {
      return { ok: false, message: "You can only upload for your department" };
    }
  }

  let subDepartmentName: string | null = null;
  if (subDepartmentId) {
    const sub = await prisma.subDepartment.findFirst({
      where: { id: subDepartmentId, departmentId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!sub) return { ok: false, message: "Sub-department does not belong to the selected department" };
    subDepartmentName = sub.name;
  } else if (actor.role === Role.SUPERVISOR) {
    return { ok: false, message: "Sub-department is required" };
  }

  return { ok: true, subDepartmentName, departmentName: dept.name };
}

export async function POST(req: Request) {
  const auth = await requireActor(SOP_LIBRARY_UPLOAD_ROLES);
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
  const effectiveDate = String(formData.get("effectiveDate") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "").trim();
  const subRaw = formData.get("subDepartmentId");
  const subDepartmentId = typeof subRaw === "string" && subRaw.trim() ? subRaw.trim() : null;
  const file = formData.get("file");

  if (!title || !effectiveDate || !departmentId || !(file instanceof File)) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Title, effective date, department, and file are required"),
      { status: 400 },
    );
  }

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".doc") && !lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Only .doc, .docx, and .pdf files are supported"), {
      status: 400,
    });
  }

  const scope = await validateSopUploadScope(auth.actor, departmentId, subDepartmentId);
  if (!scope.ok) {
    return NextResponse.json(fail("VALIDATION_ERROR", scope.message), { status: 400 });
  }

  if (!getS3SopEnv()) {
    return NextResponse.json(
      fail(
        "SERVICE_UNAVAILABLE",
        "File storage is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET.",
      ),
      { status: 503 },
    );
  }

  const storedFileName = slugifyFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = lower.endsWith(".pdf")
    ? "application/pdf"
    : lower.endsWith(".doc")
      ? "application/msword"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  let converted;
  try {
    converted = await convertSopFileToEditableContent({ fileName: file.name, buffer });
  } catch (err) {
    console.error("[sop/library-items/upload] conversion failed:", err);
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Could not convert this file into editable SOP content."),
      { status: 400 },
    );
  }

  let sourceFileUrl: string;
  try {
    const uploaded = await uploadSopFileToS3({
      buffer,
      fileName: storedFileName,
      contentType,
    });
    sourceFileUrl = uploaded.publicUrl;
  } catch (err) {
    console.error("[sop/library-items/upload] S3 upload failed:", err);
    return NextResponse.json(
      fail("UPLOAD_FAILED", "Could not upload file to storage. Check S3 credentials and bucket configuration."),
      { status: 502 },
    );
  }

  const fileKind = lower.endsWith(".pdf") ? "PDF" : lower.endsWith(".doc") ? "DOC" : "DOCX";
  const content = {
    templateType: "SOP",
    documentTitle: title,
    version: "1.0", // Always start new SOPs at version 1.0
    effectiveDate,
    department: scope.departmentName,
    ...(scope.subDepartmentName ? { subDepartment: scope.subDepartmentName } : {}),
    sourceFileName: file.name,
    sourceFileUrl,
    fileKind,
    sourceFormat: converted.sourceFormat,
    editableHtml: sanitizeEditableHtml(converted.editableHtml),
    extractedText: converted.extractedText,
    uploadedAt: new Date().toISOString(),
  };

  const serialNo = `${SOP_LIBRARY_UPLOAD_SERIAL_PREFIX}${Date.now()}`;

  const document = await prisma.document.create({
    data: {
      serialNo,
      type: DocumentType.SOP,
      title,
      departmentId,
      subDepartmentId: subDepartmentId || null,
      createdById: auth.actor.id,
      currentVersion: 1,
      status: DocumentStatus.DRAFT,
      isPublished: false,
      publishedAt: null,
      publishedById: null,
      versions: {
        create: {
          versionNumber: 1,
          content,
          changeSummary: "Uploaded SOP document",
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
