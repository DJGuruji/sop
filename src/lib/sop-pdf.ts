import puppeteer from "puppeteer";
import { sanitizeEditableHtml } from "@/lib/sop-editable-content";

function renderPdfHtml(params: {
  title: string;
  version: string;
  effectiveDate: string;
  departmentLabel: string;
  editableHtml: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${params.title}</title>
    <style>
      @page { size: A4; margin: 18mm 14mm; }
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        color: #0f172a;
        margin: 0;
        font-size: 12px;
        line-height: 1.65;
      }
      header {
        border-bottom: 1px solid #cbd5e1;
        margin-bottom: 18px;
        padding-bottom: 12px;
      }
      h1 {
        margin: 0 0 6px 0;
        font-size: 24px;
      }
      .meta {
        color: #475569;
        font-size: 11px;
      }
      .content p { margin: 0 0 12px; }
      .content h1, .content h2, .content h3, .content h4 {
        margin: 18px 0 8px;
        line-height: 1.3;
      }
      .content table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0 14px;
      }
      .content th, .content td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        vertical-align: top;
      }
      .content ul, .content ol { padding-left: 20px; }
      .content blockquote {
        margin: 14px 0;
        padding-left: 12px;
        border-left: 3px solid #94a3b8;
        color: #334155;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${params.title}</h1>
      <div class="meta">
        Version: ${params.version} |
        Effective date: ${params.effectiveDate || "-"} |
        Department: ${params.departmentLabel}
      </div>
    </header>
    <main class="content">${sanitizeEditableHtml(params.editableHtml)}</main>
  </body>
</html>`;
}

export async function renderSopPdf(params: {
  title: string;
  version: string;
  effectiveDate: string;
  departmentLabel: string;
  editableHtml: string;
}): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(renderPdfHtml(params), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "18mm",
        right: "14mm",
        bottom: "18mm",
        left: "14mm",
      },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
