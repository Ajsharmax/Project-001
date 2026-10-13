import { PDFDocument, degrees, StandardFonts, rgb } from "pdf-lib";
import type { ToolId } from "./catalog";
export type Options = {
  pages: string;
  angle: number;
  margin: number;
  password: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Result = { blob: Blob; name: string; message?: string };
export function parsePages(value: string, count: number) {
  const result: number[] = [];
  if (!value.trim()) throw new Error("Enter at least one page or range.");
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match)
      throw new Error("Use page numbers or ranges, for example 1, 3-5.");
    const start = Number(match[1]),
      end = Number(match[2] ?? start);
    if (start < 1 || end > count || start > end)
      throw new Error(
        `Choose pages between 1 and ${count}, in ascending ranges.`,
      );
    for (let n = start; n <= end; n++)
      if (!result.includes(n - 1)) result.push(n - 1);
  }
  return result;
}
export function pdfBlob(bytes: Uint8Array) {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
async function renderer(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
  ).default;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: "/vendor/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/vendor/standard_fonts/",
    wasmUrl: "/vendor/wasm/",
  });
  try {
    const doc = await task.promise;
    return { doc, destroy: () => task.destroy() };
  } catch (error) {
    await task.destroy();
    throw error;
  }
}
async function renderPage(
  doc: Awaited<ReturnType<typeof renderer>>["doc"],
  number: number,
) {
  const page = await doc.getPage(number);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, 2500 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    background: "white",
  }).promise;
  return { canvas, ctx, base, scale };
}
async function qpdf(
  bytes: Uint8Array,
  id: ToolId,
  password: string,
): Promise<Uint8Array> {
  const worker = new Worker(new URL("./qpdf.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error("Processing exceeded two minutes. Try a smaller PDF."),
          ),
        120000,
      );
      worker.onmessage = ({ data }) => {
        clearTimeout(timer);
        data.error ? reject(new Error(data.error)) : resolve(data.bytes);
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(new Error("The local PDF engine could not start."));
      };
      worker.postMessage({ bytes, id, password });
    });
  } finally {
    worker.terminate();
  }
}
export async function processPdf(
  id: ToolId,
  files: File[],
  opts: Options,
  progress: (s: string) => void,
): Promise<Result> {
  if (!files.length || (id === "merge" && files.length < 2))
    throw new Error(
      id === "merge" ? "Choose at least two PDFs." : "Choose a PDF.",
    );
  if (
    files.length > 20 ||
    files.reduce((sum, f) => sum + f.size, 0) > 50 * 1024 * 1024
  )
    throw new Error("Use at most 20 files and 50 MB in total.");
  const inputs = await Promise.all(
    files.map(async (f) => {
      const b = new Uint8Array(await f.arrayBuffer());
      if (!new TextDecoder().decode(b.slice(0, 1024)).includes("%PDF-"))
        throw new Error(`${f.name} is not a PDF.`);
      return b;
    }),
  );
  progress("Processing on your device…");
  if (["protect", "unlock", "compress", "repair"].includes(id)) {
    if (id === "protect" && opts.password.length < 8)
      throw new Error("Use a password of at least 8 characters.");
    let output: Uint8Array;
    try {
      output = await qpdf(inputs[0], id, opts.password);
    } catch (error) {
      if (id !== "repair") throw error;
      const recovered = await PDFDocument.load(inputs[0], {
        throwOnInvalidObject: true,
      });
      if (!recovered.getPageCount())
        throw new Error("No pages could be recovered.");
      output = await recovered.save();
    }
    if (id === "compress" && output.length >= inputs[0].length)
      return {
        blob: pdfBlob(inputs[0]),
        name: "project001-compressed.pdf",
        message:
          "This file is already compact. The original is provided without increasing its size.",
      };
    return { blob: pdfBlob(output), name: `project001-${id}.pdf` };
  }
  const out = await PDFDocument.create();
  if (["merge", "split", "rotate", "crop"].includes(id)) {
    for (const input of inputs) {
      const source = await PDFDocument.load(input);
      if (source.getPageCount() > 200)
        throw new Error("Please use documents with at most 200 pages.");
      const indices =
        id === "split"
          ? parsePages(opts.pages, source.getPageCount())
          : source.getPageIndices();
      const pages = await out.copyPages(source, indices);
      for (const page of pages) {
        if (id === "rotate") {
          if (![90, 180, 270].includes(opts.angle))
            throw new Error("Choose a valid rotation.");
          page.setRotation(
            degrees((page.getRotation().angle + opts.angle) % 360),
          );
        }
        if (id === "crop") {
          const { x, y, width, height } = page.getCropBox(),
            m = opts.margin;
          if (!Number.isFinite(m) || m < 0 || 2 * m >= Math.min(width, height))
            throw new Error("Margins must leave a visible area on every page.");
          page.setCropBox(x + m, y + m, width - 2 * m, height - 2 * m);
        }
        out.addPage(page);
      }
    }
  } else {
    const { doc, destroy } = await renderer(inputs[0]);
    try {
      if (doc.numPages > 50)
        throw new Error(
          "Conversions and redaction support up to 50 pages per file.",
        );
      if (id === "excel") {
        const rows: {
          value: string | number;
          type: StringConstructor | NumberConstructor;
        }[][] = [
          [
            ...["Page", "Text", "X", "Y"].map((value) => ({
              value,
              type: String,
            })),
          ],
        ];
        for (let i = 1; i <= doc.numPages; i++) {
          const content = await (await doc.getPage(i)).getTextContent();
          for (const item of content.items)
            if ("str" in item && item.str.trim())
              rows.push([
                { value: i, type: Number },
                { value: item.str, type: String },
                { value: item.transform[4], type: Number },
                { value: item.transform[5], type: Number },
              ]);
        }
        if (rows.length === 1)
          throw new Error("No text found. Run OCR on this scanned PDF first.");
        const { default: writeXlsx } = await import("write-excel-file/browser");
        const blob = await writeXlsx(rows, {
          columns: [{ width: 10 }, { width: 80 }, { width: 15 }, { width: 15 }],
        }).toBlob();
        return { blob, name: "project001-text.xlsx" };
      }
      const pptx =
        id === "powerpoint" ? new (await import("pptxgenjs")).default() : null;
      if (
        id === "redact" &&
        (!Number.isInteger(opts.page) ||
          opts.page < 1 ||
          opts.page > doc.numPages)
      )
        throw new Error("Choose a page that exists in this document.");
      const ocr =
        id === "ocr"
          ? await (
              await import("tesseract.js")
            ).createWorker("eng", 1, {
              workerPath: "/vendor/worker.min.js",
              corePath: "/vendor/tesseract-core",
              langPath: "/vendor",
              cacheMethod: "none",
              workerBlobURL: false,
            })
          : null;
      const font = ocr ? await out.embedFont(StandardFonts.Helvetica) : null;
      try {
        for (let i = 1; i <= doc.numPages; i++) {
          progress(`Processing page ${i} of ${doc.numPages}…`);
          const { canvas, ctx, base, scale } = await renderPage(doc, i);
          try {
            if (id === "redact" && i === opts.page) {
              const { x, y, width, height } = opts;
              if (
                ![x, y, width, height].every(Number.isFinite) ||
                x < 0 ||
                y < 0 ||
                width <= 0 ||
                height <= 0 ||
                x + width > base.width ||
                y + height > base.height
              )
                throw new Error(
                  "The redaction rectangle must fit inside the page. Coordinates use PDF points from the top-left of the displayed page.",
                );
              ctx.fillStyle = "#000";
              ctx.fillRect(
                Math.floor(x * scale),
                Math.floor(y * scale),
                Math.ceil(width * scale) + 1,
                Math.ceil(height * scale) + 1,
              );
            }
            if (pptx) {
              if (i === 1) {
                pptx.defineLayout({
                  name: "PDF",
                  width: base.width / 72,
                  height: base.height / 72,
                });
                pptx.layout = "PDF";
              }
              const slide = pptx.addSlide();
              const first = (await doc.getPage(1)).getViewport({ scale: 1 });
              const fit = Math.min(
                first.width / base.width,
                first.height / base.height,
              );
              slide.addImage({
                data: canvas.toDataURL("image/png"),
                x: (first.width - base.width * fit) / 144,
                y: (first.height - base.height * fit) / 144,
                w: (base.width * fit) / 72,
                h: (base.height * fit) / 72,
              });
            } else {
              const page = out.addPage([base.width, base.height]);
              const img = await out.embedPng(canvas.toDataURL("image/png"));
              page.drawImage(img, {
                x: 0,
                y: 0,
                width: base.width,
                height: base.height,
              });
              if (ocr && font) {
                const { data } = await ocr.recognize(
                  canvas,
                  {},
                  { blocks: true },
                );
                for (const block of data.blocks ?? [])
                  for (const paragraph of block.paragraphs)
                    for (const line of paragraph.lines)
                      for (const word of line.words) {
                        const text = word.text.replace(/[^\x20-\x7e]/g, "");
                        if (text)
                          page.drawText(text, {
                            x: word.bbox.x0 / scale,
                            y: base.height - word.bbox.y1 / scale,
                            size: Math.max(
                              1,
                              (word.bbox.y1 - word.bbox.y0) / scale,
                            ),
                            font,
                            opacity: 0,
                            color: rgb(0, 0, 0),
                          });
                      }
              }
            }
          } finally {
            canvas.width = canvas.height = 0;
          }
        }
      } finally {
        await ocr?.terminate();
      }
      if (pptx)
        return {
          blob: (await pptx.write({ outputType: "blob" })) as Blob,
          name: "project001-slides.pptx",
        };
    } finally {
      await destroy();
    }
  }
  return { blob: pdfBlob(await out.save()), name: `project001-${id}.pdf` };
}
