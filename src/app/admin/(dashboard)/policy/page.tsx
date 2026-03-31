import { prisma } from "@/lib/prisma";
import { DocumentType } from "@/generated/prisma/enums";
import { getSession } from "@/lib/auth";
import { isCanonicalPolicyTemplateUrl } from "@/lib/policy-template-files";
import {
  mapDocumentToLibraryRow,
  resolveVersionContent,
  type LibraryDocSelect,
} from "@/lib/document-library-display";
import { PolicyLibrary, type PolicyTemplateRow } from "./policy-library";

export default async function AdminPolicyPage() {
  const session = await getSession();
  const isSuperAdmin = session?.role === "SUPER_ADMIN";

  const templates = await prisma.document.findMany({
    where: { type: DocumentType.POLICY, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      serialNo: true,
      title: true,
      currentVersion: true,
      department: { select: { name: true } },
      latestVersion: {
        select: {
          content: true,
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  /** Seeded IT sample duplicates the static policy template card — hide from this list. */
  const rows: PolicyTemplateRow[] = templates
    .filter((template) => {
      if (template.serialNo === "POL-IT-001") return false;
      const content = resolveVersionContent(template as LibraryDocSelect);
      return !isCanonicalPolicyTemplateUrl(content.sourceFileUrl);
    })
    .map((template) => mapDocumentToLibraryRow(template as LibraryDocSelect));

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="border-b border-slate-300 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Documents</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Policy library</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Standard Word and PDF templates, plus additional policy documents in your library.
        </p>
      </header>

      <PolicyLibrary templates={rows} isSuperAdmin={isSuperAdmin} />


    </div>
  );
}
