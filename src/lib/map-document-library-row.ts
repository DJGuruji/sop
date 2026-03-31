/**
 * Maps Prisma document + JSON version content to library card fields.
 * Prefers user-facing fields from content; department always from DB relation (content may hold placeholders).
 */
export type TemplateContentShape = {
  documentTitle?: string;
  version?: string;
  department?: string;
  effectiveDate?: string;
  sourceFileName?: string;
  sourceFileUrl?: string;
};

export function parseTemplateContent(content: unknown): TemplateContentShape {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as TemplateContentShape;
  }
  return {};
}

function fileNameFromUrl(url: string): string | null {
  const part = url.split("?")[0]?.split("/").filter(Boolean).pop();
  return part || null;
}

export function libraryDisplayFileName(content: TemplateContentShape, recordTitle: string): string {
  const fromMeta = content.sourceFileName?.trim();
  if (fromMeta) return fromMeta;
  const fromUrl = content.sourceFileUrl ? fileNameFromUrl(content.sourceFileUrl) : null;
  if (fromUrl) return fromUrl;
  return `${recordTitle}.docx`;
}

/** Main heading on the card: title entered for the document / stored in JSON. */
export function libraryDisplayTitle(content: TemplateContentShape, recordTitle: string): string {
  return content.documentTitle?.trim() || recordTitle;
}

/** Secondary line under heading (internal record name) when it differs from display title. */
export function libraryRecordTitleIfDifferent(content: TemplateContentShape, recordTitle: string): string | null {
  const display = libraryDisplayTitle(content, recordTitle);
  const record = recordTitle.trim();
  if (!record || display === record) return null;
  return record;
}

export type LibraryRow = {
  id: string;
  serialNo: string;
  title: string;
  displayTitle: string;
  recordTitleSubtitle: string | null;
  currentVersion: number;
  departmentName: string;
  fileName: string;
  fileUrl: string | null;
  documentTitle: string;
  version: string;
  effectiveDate: string;
  departmentLabel: string;
};

export function mapDocumentToLibraryRow(template: {
  id: string;
  serialNo: string;
  title: string;
  currentVersion: number;
  department: { name: string };
  latestVersion: { content: unknown } | null;
}): LibraryRow {
  const content = parseTemplateContent(template.latestVersion?.content);
  const departmentName = template.department.name;
  const displayTitle = libraryDisplayTitle(content, template.title);
  return {
    id: template.id,
    serialNo: template.serialNo,
    title: template.title,
    displayTitle,
    recordTitleSubtitle: libraryRecordTitleIfDifferent(content, template.title),
    currentVersion: template.currentVersion,
    departmentName,
    fileName: libraryDisplayFileName(content, template.title),
    fileUrl: content.sourceFileUrl ?? null,
    documentTitle: content.documentTitle?.trim() || template.title,
    version: content.version?.trim() || String(template.currentVersion),
    effectiveDate: content.effectiveDate?.trim() || "—",
    departmentLabel: departmentName,
  };
}
