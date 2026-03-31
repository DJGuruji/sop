import "dotenv/config";
import { DocumentStatus, DocumentType, PrismaClient, Role } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const companyBrandedSopTemplate = {
  templateType: "SOP",
  documentTitle: "SOP Template",
  effectiveDate: "[Enter here]",
  version: "1.0",
  department: "[Enter here]",
  preparedBy: "[Enter here]",
  approvedBy: "[Enter here]",
  sourceFileName: "Sop-Template.docx",
  sourceFileUrl: "/sop-templates/Sop-Template.docx",
  sections: [
    {
      heading: "1. Purpose",
      paragraphs: ["Describe the purpose of this SOP."],
    },
    {
      heading: "2. Scope",
      paragraphs: ["Define who and what this SOP applies to."],
    },
    {
      heading: "3. Procedure",
      paragraphs: [],
      subsections: [
        {
          title: "Step 1",
          bullets: ["-"],
        },
        {
          title: "Step 2",
          bullets: ["-"],
        },
        {
          title: "Step 3",
          bullets: ["-"],
        },
      ],
    },
    {
      heading: "4. Safety and Compliance",
      subsections: [
        {
          title: "4.1 Data Security",
          bullets: ["-"],
        },
        {
          title: "4.2 Compliance Requirements",
          bullets: ["-"],
        },
        {
          title: "4.3 Audit and Monitoring",
          bullets: ["-"],
        },
      ],
    },
    {
      heading: "Revision History",
      table: {
        columns: ["Version", "Date", "Changes", "Author"],
        rows: [["1.0", "[Enter here]", "Initial draft", "[Enter here]"]],
      },
    },
  ],
} as const;

const companyBrandedPolicyTemplate = {
  templateType: "POLICY",
  documentTitle: "Policy Template",
  effectiveDate: "[Enter here]",
  version: "1.0",
  department: "[Enter here]",
  preparedBy: "[Enter here]",
  approvedBy: "[Enter here]",
  sourceFileName: "Policy-Template.docx",
  sourceFileUrl: "/policy-templates/Policy-Template.docx",
  sections: [
    {
      heading: "1. Purpose",
      paragraphs: ["Describe the purpose of this policy."],
    },
    {
      heading: "2. Scope",
      paragraphs: ["Define organizational scope and applicability."],
    },
    {
      heading: "3. Policy statements",
      paragraphs: ["State the governing rules and requirements."],
    },
    {
      heading: "4. Roles and responsibilities",
      paragraphs: ["Define who is accountable for compliance."],
    },
    {
      heading: "Revision History",
      table: {
        columns: ["Version", "Date", "Changes", "Author"],
        rows: [["1.0", "[Enter here]", "Initial draft", "[Enter here]"]],
      },
    },
  ],
} as const;

async function main() {
  if (process.env.NODE_ENV !== "development") {
    console.log("Skipping seed: NODE_ENV is not development.");
    return;
  }

  const defaultPasswordHash = await bcrypt.hash("Password@123", 10);

  const department = await prisma.department.upsert({
    where: { name: "Operations" },
    update: {},
    create: { name: "Operations", code: "OPS" },
  });

  const itDepartment = await prisma.department.upsert({
    where: { name: "IT Department" },
    update: { code: "IT" },
    create: { name: "IT Department", code: "IT" },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "developers@iiclakshya.com" },
    update: { role: Role.SUPER_ADMIN, isActive: true },
    create: {
      name: "Super Admin",
      email: "developers@iiclakshya.com",
      passwordHash: defaultPasswordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      departmentId: department.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@iiclakshya.com" },
    update: { role: Role.ADMIN, isActive: true, createdById: superAdmin.id },
    create: {
      name: "Admin",
      email: "admin@iiclakshya.com",
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      createdById: superAdmin.id,
      departmentId: department.id,
    },
  });

  const deptAdmin = await prisma.user.upsert({
    where: { email: "deptadmin.ops@iiclakshya.com" },
    update: {
      role: Role.DEPARTMENT_ADMIN,
      isActive: true,
      createdById: superAdmin.id,
      departmentId: department.id,
    },
    create: {
      name: "Operations Dept Admin",
      email: "deptadmin.ops@iiclakshya.com",
      passwordHash: defaultPasswordHash,
      role: Role.DEPARTMENT_ADMIN,
      isActive: true,
      createdById: superAdmin.id,
      departmentId: department.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "supervisor.ops@iiclakshya.com" },
    update: {
      role: Role.SUPERVISOR,
      isActive: true,
      createdById: deptAdmin.id,
      reportingToId: deptAdmin.id,
      departmentId: department.id,
    },
    create: {
      name: "Operations Supervisor",
      email: "supervisor.ops@iiclakshya.com",
      passwordHash: defaultPasswordHash,
      role: Role.SUPERVISOR,
      isActive: true,
      createdById: deptAdmin.id,
      reportingToId: deptAdmin.id,
      departmentId: department.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "employee.ops@iiclakshya.com" },
    update: {
      role: Role.EMPLOYEE,
      isActive: true,
      createdById: deptAdmin.id,
      reportingToId: deptAdmin.id,
      departmentId: department.id,
    },
    create: {
      name: "Operations Employee",
      email: "employee.ops@iiclakshya.com",
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      isActive: true,
      createdById: deptAdmin.id,
      reportingToId: deptAdmin.id,
      departmentId: department.id,
    },
  });

  let sopTemplate = await prisma.document.findUnique({
    where: { serialNo: "SOP-IT-001" },
    select: { id: true, latestVersionId: true },
  });

  if (!sopTemplate) {
    sopTemplate = await prisma.document.create({
      data: {
        serialNo: "SOP-IT-001",
        type: DocumentType.SOP,
        title: companyBrandedSopTemplate.documentTitle,
        departmentId: itDepartment.id,
        createdById: superAdmin.id,
        currentVersion: 1,
        status: DocumentStatus.APPROVED,
        isPublished: true,
        publishedAt: new Date(),
        publishedById: superAdmin.id,
      },
      select: { id: true, latestVersionId: true },
    });
  } else {
    await prisma.document.update({
      where: { id: sopTemplate.id },
      data: {
        title: companyBrandedSopTemplate.documentTitle,
        departmentId: itDepartment.id,
        currentVersion: 1,
        status: DocumentStatus.APPROVED,
        isPublished: true,
        publishedAt: new Date(),
        publishedById: superAdmin.id,
        updatedById: superAdmin.id,
      },
    });
  }

  const existingVersion = await prisma.documentVersion.findFirst({
    where: { documentId: sopTemplate.id, versionNumber: 1 },
    select: { id: true },
  });

  const version =
    existingVersion
      ? await prisma.documentVersion.update({
          where: { id: existingVersion.id },
          data: {
            content: companyBrandedSopTemplate,
            changeSummary: "Seeded company branded SOP sample template",
            isLatest: true,
            updatedById: superAdmin.id,
            deletedAt: null,
          },
          select: { id: true },
        })
      : await prisma.documentVersion.create({
          data: {
            documentId: sopTemplate.id,
            versionNumber: 1,
            content: companyBrandedSopTemplate,
            changeSummary: "Seeded company branded SOP sample template",
            isLatest: true,
            createdById: superAdmin.id,
          },
          select: { id: true },
        });

  await prisma.document.update({
    where: { id: sopTemplate.id },
    data: {
      latestVersionId: version.id,
      updatedById: superAdmin.id,
    },
  });

  let policyTemplate = await prisma.document.findUnique({
    where: { serialNo: "POL-IT-001" },
    select: { id: true, latestVersionId: true },
  });

  if (!policyTemplate) {
    policyTemplate = await prisma.document.create({
      data: {
        serialNo: "POL-IT-001",
        type: DocumentType.POLICY,
        title: companyBrandedPolicyTemplate.documentTitle,
        departmentId: itDepartment.id,
        createdById: superAdmin.id,
        currentVersion: 1,
        status: DocumentStatus.APPROVED,
        isPublished: true,
        publishedAt: new Date(),
        publishedById: superAdmin.id,
      },
      select: { id: true, latestVersionId: true },
    });
  } else {
    await prisma.document.update({
      where: { id: policyTemplate.id },
      data: {
        title: companyBrandedPolicyTemplate.documentTitle,
        departmentId: itDepartment.id,
        currentVersion: 1,
        status: DocumentStatus.APPROVED,
        isPublished: true,
        publishedAt: new Date(),
        publishedById: superAdmin.id,
        updatedById: superAdmin.id,
      },
    });
  }

  const existingPolicyVersion = await prisma.documentVersion.findFirst({
    where: { documentId: policyTemplate.id, versionNumber: 1 },
    select: { id: true },
  });

  const policyVersion =
    existingPolicyVersion
      ? await prisma.documentVersion.update({
          where: { id: existingPolicyVersion.id },
          data: {
            content: companyBrandedPolicyTemplate,
            changeSummary: "Seeded company branded policy sample template",
            isLatest: true,
            updatedById: superAdmin.id,
            deletedAt: null,
          },
          select: { id: true },
        })
      : await prisma.documentVersion.create({
          data: {
            documentId: policyTemplate.id,
            versionNumber: 1,
            content: companyBrandedPolicyTemplate,
            changeSummary: "Seeded company branded policy sample template",
            isLatest: true,
            createdById: superAdmin.id,
          },
          select: { id: true },
        });

  await prisma.document.update({
    where: { id: policyTemplate.id },
    data: {
      latestVersionId: policyVersion.id,
      updatedById: superAdmin.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
