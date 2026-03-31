/** Canonical policy template files under `public/policy-templates/`. */
export const POLICY_TEMPLATE_DOCX_PATH = "/policy-templates/Policy-Template.docx";
export const POLICY_TEMPLATE_PDF_PATH = "/policy-templates/Policy-Template.pdf";

export const POLICY_TEMPLATE_DOCX_FILENAME = "Policy-Template.docx";
export const POLICY_TEMPLATE_PDF_FILENAME = "Policy-Template.pdf";

export const ALLOWED_POLICY_TEMPLATE_UPLOAD_NAMES = [
  POLICY_TEMPLATE_DOCX_FILENAME,
  POLICY_TEMPLATE_PDF_FILENAME,
] as const;

export function isCanonicalPolicyTemplateUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const u = url.split("?")[0] ?? url;
  return u === POLICY_TEMPLATE_DOCX_PATH || u.endsWith(`/${POLICY_TEMPLATE_DOCX_FILENAME}`);
}
