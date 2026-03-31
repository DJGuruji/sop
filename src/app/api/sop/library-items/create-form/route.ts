import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, SOP_LIBRARY_UPLOAD_ROLES } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { SOP_LIBRARY_UPLOAD_SERIAL_PREFIX } from "@/lib/sop-library-upload";
import { DocumentStatus, DocumentType } from "@/generated/prisma/enums";
import { sanitizeEditableHtml, htmlToPlainText } from "@/lib/sop-editable-content";

export type SopFormBody = {
  departmentId: string;
  subDepartmentId?: string | null;
  title: string;
  version: string;
  effectiveDate: string;
  preparedBy: string;
  approvedBy: string;
  contentDepartmentName: string;
  purpose: string;
  scope: string;
  procedure: { step: number; text: string }[];
  dataSecurity: string[];
  complianceRequirements: string[];
  auditAndMonitoring: string[];
  revisionHistory: { version: string; date: string; changes: string; author: string }[];
};

function buildSopHtml(body: SopFormBody, deptName: string): string {
  const procedureRows = body.procedure
    .map(
      (p) =>
        `<p><strong>Step ${p.step}:</strong></p><ul>${p.text
          .split("\n")
          .filter(Boolean)
          .map((l) => `<li>${l}</li>`)
          .join("")}</ul>`,
    )
    .join("");

  const revisionRows = body.revisionHistory
    .map(
      (r) =>
        `<tr><td>${r.version}</td><td>${r.date}</td><td>${r.changes}</td><td>${r.author}</td></tr>`,
    )
    .join("");

  const html = `
<div data-source-format="form">
  <section data-sop-section="true">
    <h2>Document Details</h2>
    <table>
      <tbody>
        <tr><th>Document Title</th><td>${body.title}</td></tr>
        <tr><th>Effective Date</th><td>${body.effectiveDate}</td></tr>
        <tr><th>Version</th><td>${body.version}</td></tr>
        <tr><th>Department</th><td>${body.contentDepartmentName || deptName}</td></tr>
        <tr><th>Prepared By</th><td>${body.preparedBy}</td></tr>
        <tr><th>Approved By</th><td>${body.approvedBy}</td></tr>
      </tbody>
    </table>
  </section>

  <section data-sop-section="true">
    <h2>1. Purpose</h2>
    <p>${body.purpose}</p>
  </section>

  <section data-sop-section="true">
    <h2>2. Scope</h2>
    <p>${body.scope}</p>
  </section>

  <section data-sop-section="true">
    <h2>3. Procedure</h2>
    ${procedureRows}
  </section>

  <section data-sop-section="true">
    <h2>4. Safety and Compliance</h2>
    <h3>4.1 Data Security:</h3>
    <ul>
      ${body.dataSecurity.map((l) => `<li>${l}</li>`).join("")}
    </ul>
    <h3>4.2 Compliance Requirements:</h3>
    <ul>
      ${body.complianceRequirements.map((l) => `<li>${l}</li>`).join("")}
    </ul>
    <h3>4.3 Audit and Monitoring:</h3>
    <ul>
      ${body.auditAndMonitoring.map((l) => `<li>${l}</li>`).join("")}
    </ul>
  </section>

  <section data-sop-section="true">
    <h2>5. Revision History</h2>
    <table>
      <thead><tr><th>Version</th><th>Date</th><th>Changes</th><th>Author</th></tr></thead>
      <tbody>${revisionRows}</tbody>
    </table>
  </section>
</div>
`;
  return sanitizeEditableHtml(html);
}

export async function POST(req: Request) {
  const auth = await requireActor(SOP_LIBRARY_UPLOAD_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"),
      { status: auth.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as SopFormBody | null;
  if (!body) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request body"), { status: 400 });
  }

  const { departmentId, subDepartmentId, title, effectiveDate, preparedBy, approvedBy } =
    body;

  if (!departmentId || !title?.trim() || !effectiveDate) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Title, effective date, and department are required"),
      { status: 400 },
    );
  }

  // Validate department access
  const dept = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!dept) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Department not found"), { status: 400 });
  }

  // Validate sub-department if provided
  let subDepartmentName: string | null = null;
  const subId = subDepartmentId?.trim() || null;
  if (subId) {
    const sub = await prisma.subDepartment.findFirst({
      where: { id: subId, departmentId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!sub) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Sub-department not found"),
        { status: 400 },
      );
    }
    subDepartmentName = sub.name;
  }

  const editableHtml = buildSopHtml(body, dept.name);
  const extractedText = htmlToPlainText(editableHtml);

  const content = {
    templateType: "SOP_FORM",
    documentTitle: title.trim(),
    version: "1.0", // Always start new SOPs at version 1.0
    effectiveDate,
    department: (body.contentDepartmentName || dept.name).trim(),
    ...(subDepartmentName ? { subDepartment: subDepartmentName } : {}),
    preparedBy: preparedBy?.trim() || "",
    approvedBy: approvedBy?.trim() || "",
    editableHtml,
    extractedText,
    sourceFormat: "FORM",
    fileKind: "FORM",
    sourceFileName: `${title.trim()}.form`,
    // Structured form data stored for future re-editing
    formData: body,
    createdAt: new Date().toISOString(),
  };

  const serialNo = `${SOP_LIBRARY_UPLOAD_SERIAL_PREFIX}${Date.now()}`;

  const document = await prisma.document.create({
    data: {
      serialNo,
      type: DocumentType.SOP,
      title: title.trim(),
      departmentId,
      subDepartmentId: subId || null,
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
          changeSummary: "Created via SOP form",
          isLatest: true,
          createdById: auth.actor.id,
        },
      },
    },
    select: {
      id: true,
      serialNo: true,
      versions: { where: { versionNumber: 1 }, select: { id: true }, take: 1 },
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
