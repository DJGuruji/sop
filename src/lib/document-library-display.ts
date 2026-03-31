/** JSON `content` on DocumentVersion for template uploads / seed. */
export type TemplateVersionContent = {
  documentTitle?: string;
  version?: string;
  department?: string;
  subDepartment?: string;
  effectiveDate?: string;
  sourceFileName?: string;
  sourceFileUrl?: string;
  /** "DOCX" | "PDF" from library upload */
  fileKind?: string;
};

export type LibraryDocSelect = {
  id: string;
  serialNo: string;
  title: string;
  currentVersion: number;
  department: { name: string };
  latestVersion: { content: unknown } | null;
  versions: { content: unknown }[];
};

export type LibraryTemplateRow = {
  id: string;
  serialNo: string;
  /** Card heading: human document name from content or DB title */
  displayName: string;
  /** DB record title (shown when different from displayName) */
  recordTitle: string;
  currentVersion: number;
  departmentName: string;
  /** Original file name when uploaded; falls back to URL basename */
  fileLabel: string;
  /** `download` attribute on the link */
  downloadFileName: string;
  fileUrl: string | null;
  version: string;
  effectiveDate: string;
  departmentLabel: string;
};

function basenameFromUrl(url: string): string | undefined {
  const path = url.split("?")[0] ?? url;
  const seg = path.split("/").filter(Boolean).pop();
  return seg || undefined;
}

export function resolveVersionContent(template: LibraryDocSelect): TemplateVersionContent {
  const fromLatest = template.latestVersion?.content;
  if (fromLatest && typeof fromLatest === "object") return fromLatest as TemplateVersionContent;
  const v0 = template.versions[0]?.content;
  if (v0 && typeof v0 === "object") return v0 as TemplateVersionContent;
  return {};
}

/** Prefer canonical names when the stored URL points at standard template files. */
function normalizeStandardTemplateFileNames(
  sourceFileUrl: string | undefined,
  original: string,
  urlBase: string | undefined,
  fallbackTitle: string,
): { fileLabel: string; downloadFileName: string; cardHeading: string | null } {
  const u = (sourceFileUrl ?? "").toLowerCase();
  if (u.includes("/sop-templates/sop-template.docx") || urlBase?.toLowerCase() === "sop-template.docx") {
    return {
      fileLabel: "Sop-Template.docx",
      downloadFileName: "Sop-Template.docx",
      cardHeading: "Sop-Template.docx",
    };
  }
  if (u.includes("/policy-templates/policy-template.docx") || urlBase?.toLowerCase() === "policy-template.docx") {
    return {
      fileLabel: "Policy-Template.docx",
      downloadFileName: "Policy-Template.docx",
      cardHeading: "Policy-Template.docx",
    };
  }
  const fileLabel = original || urlBase || `${fallbackTitle}.docx`;
  return { fileLabel, downloadFileName: fileLabel, cardHeading: null };
}

export function mapDocumentToLibraryRow(template: LibraryDocSelect): LibraryTemplateRow {
  const content = resolveVersionContent(template);
  const docTitle = (content.documentTitle ?? "").trim();
  const recordTitle = template.title;

  const original = (content.sourceFileName ?? "").trim();
  const urlBase = content.sourceFileUrl ? basenameFromUrl(content.sourceFileUrl) : undefined;
  const { fileLabel, downloadFileName, cardHeading } = normalizeStandardTemplateFileNames(
    content.sourceFileUrl,
    original,
    urlBase,
    template.title,
  );

  const displayName = cardHeading ?? (docTitle || template.title);

  return {
    id: template.id,
    serialNo: template.serialNo,
    displayName,
    recordTitle,
    currentVersion: template.currentVersion,
    departmentName: template.department.name,
    fileLabel,
    downloadFileName,
    fileUrl: content.sourceFileUrl?.trim() || null,
    version: (content.version ?? "").trim() || String(template.currentVersion),
    effectiveDate: (content.effectiveDate ?? "").trim() || "—",
    departmentLabel: (() => {
      const deptPart = (content.department ?? "").trim() || template.department.name;
      const subPart = (content.subDepartment ?? "").trim();
      return subPart ? `${deptPart} · ${subPart}` : deptPart;
    })(),
  };
}
