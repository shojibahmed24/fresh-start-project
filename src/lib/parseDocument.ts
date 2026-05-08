// Client-side parsing for PDF / DOCX so the agent can receive plain text
// instead of binary blobs. Uses dynamic imports to avoid bloating the main
// bundle — these are only loaded when the user actually attaches such a file.

export type ParsedDoc = { text: string; pages?: number };

export async function parsePdf(file: File): Promise<ParsedDoc> {
  const pdfjs: any = await import("pdfjs-dist");
  // Use the bundled worker via Vite's ?url loader.
  // Falls back to CDN if the worker import fails.
  try {
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  const max = Math.min(doc.numPages, 50);
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    out.push(`--- Page ${i} ---\n${text}`);
  }
  return { text: out.join("\n\n"), pages: doc.numPages };
}

export async function parseDocx(file: File): Promise<ParsedDoc> {
  const mammoth: any = await import("mammoth/mammoth.browser.js" as any).catch(
    () => import("mammoth" as any),
  );
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return { text: result.value || "" };
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isDocx(file: File) {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  );
}
