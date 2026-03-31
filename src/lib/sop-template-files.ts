/** Canonical SOP template files under `public/sop-templates/`. */
export const SOP_TEMPLATE_DOCX_PATH = "/sop-templates/Sop-Template.docx";
export const SOP_TEMPLATE_PDF_PATH = "/sop-templates/Sop-Template.pdf";

export const SOP_TEMPLATE_DOCX_FILENAME = "Sop-Template.docx";
export const SOP_TEMPLATE_PDF_FILENAME = "Sop-Template.pdf";

export const ALLOWED_SOP_TEMPLATE_UPLOAD_NAMES = [SOP_TEMPLATE_DOCX_FILENAME, SOP_TEMPLATE_PDF_FILENAME] as const;

export function isCanonicalSopTemplateUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const u = url.split("?")[0] ?? url;
  return (
    u === SOP_TEMPLATE_DOCX_PATH ||
    u.endsWith(`/${SOP_TEMPLATE_DOCX_FILENAME}`) ||
    u.endsWith("/SOP-Template.docx")
  );
}
