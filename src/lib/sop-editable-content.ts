import sanitizeHtml from "sanitize-html";

export type EditableSopContent = {
  editableHtml: string;
  extractedText: string;
  sourceFormat: "DOC" | "DOCX" | "PDF";
};

export type EditableSopSection = {
  id: string;
  title: string;
  bodyHtml: string;
};

export type EditableSopHeaderFields = {
  departmentName: string;
  preparedBy: string;
  approvedBy: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function paragraphsToHtml(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return "<p></p>";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph.trim()).replace(/\n/g, "<br />");
      return `<p>${html}</p>`;
    })
    .join("");
}

function markdownLinksToHtml(text: string): string {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  });
}

function pdfTextToHtml(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return "<p></p>";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = markdownLinksToHtml(escapeHtml(paragraph.trim())).replace(/\n/g, "<br />");
      return `<p>${html}</p>`;
    })
    .join("");
}

function buildPdfEditableHtml(params: { screenshots: { dataUrl: string; pageNumber: number }[]; text: string }): string {
  const pageImages = params.screenshots
    .map(
      (page) =>
        `<figure data-pdf-page="${page.pageNumber}" style="margin:0 0 24px;"><img src="${page.dataUrl}" alt="PDF page ${page.pageNumber}" style="display:block;width:100%;height:auto;border:1px solid #cbd5e1;border-radius:12px;" /></figure>`,
    )
    .join("");

  const editableText = pdfTextToHtml(params.text);

  return `
    <div data-source-format="pdf">
      <section data-pdf-preview="true">${pageImages}</section>
      <section data-pdf-text="true">${editableText}</section>
    </div>
  `;
}

export function sanitizeEditableHtml(html: string): string {
  const cleaned = sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "ol",
      "ul",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "img",
      "figure",
      "figcaption",
      "section",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      figure: ["data-pdf-page"],
      section: ["data-pdf-preview", "data-pdf-text"],
      div: ["data-source-format"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "font-weight": [/^\d+$/, /^bold$/, /^normal$/],
        "font-style": [/^italic$/, /^normal$/],
        "text-decoration": [/^underline$/, /^line-through$/, /^none$/],
        width: [/^[\d.]+%$/, /^[\d.]+px$/, /^auto$/],
        height: [/^[\d.]+%$/, /^[\d.]+px$/, /^auto$/],
        margin: [/^[\d.\sA-Za-z%-]+$/],
        border: [/^[\d.\sA-Za-z#(),%-]+$/],
        "border-radius": [/^[\d.]+px$/],
        display: [/^block$/, /^inline$/, /^inline-block$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();

  return cleaned || "<p></p>";
}

export function htmlToPlainText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+\n/g, "\n")
    .trim();
}

function stripTags(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}

export function extractSopHeaderFields(html: string): EditableSopHeaderFields {
  const text = stripTags(html);
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const readValue = (prefixes: string[]) => {
    const line = lines.find((entry) =>
      prefixes.some((prefix) => entry.toLowerCase().startsWith(prefix.toLowerCase())),
    );
    if (!line) return "";
    return line.split(":").slice(1).join(":").trim();
  };

  return {
    departmentName: readValue(["Department"]),
    preparedBy: readValue(["Prepared By", "Prepared by"]),
    approvedBy: readValue(["Approved By", "Approved by"]),
  };
}

export function extractSectionsFromHtml(html: string): EditableSopSection[] {
  const cleaned = sanitizeEditableHtml(html);
  const headingRegex = /<(h1|h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = [...cleaned.matchAll(headingRegex)];

  if (matches.length === 0) {
    return [
      {
        id: "section-1",
        title: "Content",
        bodyHtml: cleaned,
      },
    ];
  }

  const sections: EditableSopSection[] = [];
  const firstHeadingIndex = matches[0]?.index ?? 0;
  const prefaceHtml = cleaned.slice(0, firstHeadingIndex).trim();
  if (prefaceHtml) {
    sections.push({
      id: "section-0",
      title: "Document Header",
      bodyHtml: sanitizeEditableHtml(prefaceHtml),
    });
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (!match || match.index == null) continue;

    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? cleaned.length;
    const title = stripTags(match[2] ?? "") || `Section ${index + 1}`;
    const bodyHtml = cleaned.slice(start, end).trim() || "<p></p>";
    sections.push({
        id: `section-${sections.length + 1}`,
        title,
        bodyHtml: sanitizeEditableHtml(bodyHtml),
      });
  }

  return sections.length > 0
    ? sections
    : [
        {
          id: "section-1",
          title: "Content",
          bodyHtml: cleaned,
        },
      ];
}

export function buildHtmlFromSections(sections: EditableSopSection[]): string {
  const normalized = sections
    .map((section, index) => {
      const title = section.title.trim() || `Section ${index + 1}`;
      const bodyHtml = sanitizeEditableHtml(section.bodyHtml || "<p></p>");
      return `<section data-sop-section="true"><h2>${escapeHtml(title)}</h2>${bodyHtml}</section>`;
    })
    .join("");

  return sanitizeEditableHtml(normalized || "<p></p>");
}

export async function convertSopFileToEditableContent(params: {
  fileName: string;
  buffer: Buffer;
}): Promise<EditableSopContent> {
  const lower = params.fileName.toLowerCase();

  if (lower.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const [htmlResult, rawResult] = await Promise.all([
      mammoth.convertToHtml(
        { buffer: params.buffer },
        { convertImage: mammoth.images.dataUri },
      ),
      mammoth.extractRawText({ buffer: params.buffer }),
    ]);

    const editableHtml = sanitizeEditableHtml(htmlResult.value);
    const extractedText = normalizeText(rawResult.value || htmlToPlainText(editableHtml));

    return { editableHtml, extractedText, sourceFormat: "DOCX" };
  }

  if (lower.endsWith(".doc")) {
    const { default: WordExtractor } = await import("word-extractor");
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(params.buffer);
    const text = normalizeText(extracted.getBody());
    return {
      editableHtml: sanitizeEditableHtml(paragraphsToHtml(text)),
      extractedText: text,
      sourceFormat: "DOC",
    };
  }

  if (lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(params.buffer) });
    try {
      const [result, screenshots] = await Promise.all([
        parser.getText({ parseHyperlinks: true }),
        parser.getScreenshot({ scale: 1.2, imageDataUrl: true, imageBuffer: false }),
      ]);
      const text = normalizeText(result.text);
      return {
        editableHtml: sanitizeEditableHtml(
          buildPdfEditableHtml({
            screenshots: screenshots.pages.map((page) => ({ dataUrl: page.dataUrl, pageNumber: page.pageNumber })),
            text,
          }),
        ),
        extractedText: text,
        sourceFormat: "PDF",
      };
    } finally {
      await parser.destroy();
    }
  }

  throw new Error("Unsupported file format");
}
