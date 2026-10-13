import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = "/tmp/project001-tests";
await mkdir(root, { recursive: true });
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (const text of ["SECRET 12345", "HELLO PROJECT001"]) {
  const p = doc.addPage([400, 300]);
  p.drawText(text, { x: 30, y: 220, size: 24, font, color: rgb(0, 0, 0) });
}
await writeFile(
  `${root}/sample.pdf`,
  await doc.save({ useObjectStreams: false }),
);
const original = await readFile(`${root}/sample.pdf`);
await writeFile(
  `${root}/damaged.pdf`,
  original.toString("latin1").replace(/startxref\s+\d+/, "startxref\n0"),
  "latin1",
);
const cdp =
  process.env.CDP_URL ??
  execFileSync("coderabbit-agent-browser", ["get", "cdp-url"], {
    encoding: "utf8",
  }).trim();
const browser = await chromium.connectOverCDP(cdp);
const context = browser.contexts()[0];
const page = await context.newPage();
const base = process.env.TEST_URL ?? "http://localhost:5173";
const errors = [];
const requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    !r.url().startsWith(base) &&
    !r.url().startsWith("blob:") &&
    !r.url().startsWith("data:")
  )
    requests.push(r.url());
});
await page.goto(base);
await page.locator(".tool-card").first().waitFor();
async function run(id, source = "sample.pdf", options = {}) {
  await page.goto(`${base}/#tool/${id}`);
  await page.locator("#tool-dialog").waitFor();
  await page
    .locator("#files")
    .setInputFiles(
      id === "merge"
        ? [`${root}/${source}`, `${root}/${source}`]
        : `${root}/${source}`,
    );
  for (const [key, value] of Object.entries(options)) {
    const control = page.locator(`[name="${key}"]`);
    if ((await control.evaluate((el) => el.tagName)) === "SELECT")
      await control.selectOption(String(value));
    else await control.fill(String(value));
  }
  if (id === "redact") await page.locator("[type=checkbox]").check();
  await page.locator(".run-button").click();
  try {
    await page.waitForFunction(
      () =>
        !document.querySelector("#download").hidden ||
        (!document.querySelector("fieldset").disabled &&
          !!document.querySelector("#status").textContent),
      {},
      { timeout: 120000 },
    );
    assert(await page.locator("#download").isVisible());
  } catch (e) {
    throw Error(`${id}: ${await page.locator("#status").textContent()}`, {
      cause: e,
    });
  }
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#download").click(),
  ]);
  const path = `${root}/${id}-${download.suggestedFilename()}`;
  await download.saveAs(path);
  const bytes = await readFile(path);
  assert(bytes.length > 100);
  console.log(`DOWNLOADED ${id}: ${bytes.length} bytes`);
  return { bytes, path };
}
try {
  if (process.env.CHECK !== "ui") {
    const merge = await run("merge");
    assert.equal((await PDFDocument.load(merge.bytes)).getPageCount(), 4);
    const split = await run("split", "sample.pdf", { pages: "2" });
    assert.equal((await PDFDocument.load(split.bytes)).getPageCount(), 1);
    const rotate = await run("rotate");
    assert.equal(
      (await PDFDocument.load(rotate.bytes)).getPage(0).getRotation().angle,
      90,
    );
    const crop = await run("crop");
    assert.equal(
      (await PDFDocument.load(crop.bytes)).getPage(0).getCropBox().width,
      364,
    );
    const compress = await run("compress");
    assert.equal((await PDFDocument.load(compress.bytes)).getPageCount(), 2);
    assert(compress.bytes.length <= original.length);
    const repair = await run("repair", "damaged.pdf");
    assert.equal((await PDFDocument.load(repair.bytes)).getPageCount(), 2);
    const protect = await run("protect", "sample.pdf", {
      password: "test-only-password",
    });
    await writeFile(`${root}/protected.pdf`, protect.bytes);
    await assert.rejects(() => PDFDocument.load(protect.bytes));
    const unlock = await run("unlock", "protected.pdf", {
      password: "test-only-password",
    });
    assert.equal((await PDFDocument.load(unlock.bytes)).getPageCount(), 2);
    const excel = await run("excel");
    const xlsx = await JSZip.loadAsync(excel.bytes);
    assert(xlsx.file("xl/workbook.xml"));
    const sheet = await xlsx.file("xl/worksheets/sheet1.xml").async("string");
    const strings = xlsx.file("xl/sharedStrings.xml")
      ? await xlsx.file("xl/sharedStrings.xml").async("string")
      : "";
    assert((sheet + strings).includes("SECRET 12345"));
    const ppt = await run("powerpoint");
    const pptx = await JSZip.loadAsync(ppt.bytes);
    assert.equal(
      Object.keys(pptx.files).filter((n) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(n),
      ).length,
      2,
    );
    assert(Object.keys(pptx.files).some((n) => n.startsWith("ppt/media/")));
    const redact = await run("redact", "sample.pdf", {
      x: 20,
      y: 45,
      width: 260,
      height: 50,
    });
    const inspect = async (bytes, password) =>
      page.evaluate(
        async ({ bytes, password }) => {
          const pdf =
            await import("/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
          pdf.GlobalWorkerOptions.workerSrc =
            "/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs";
          const task = pdf.getDocument({
            data: new Uint8Array(bytes),
            password,
          });
          try {
            const d = await task.promise;
            const text = [];
            for (let i = 1; i <= d.numPages; i++)
              text.push(
                (await (await d.getPage(i)).getTextContent()).items
                  .filter((x) => "str" in x)
                  .map((x) => x.str)
                  .join(" "),
              );
            return { pages: d.numPages, text };
          } finally {
            await task.destroy();
          }
        },
        { bytes: [...bytes], password },
      );
    assert.equal((await inspect(redact.bytes)).text.join(""), "");
    await assert.rejects(() => inspect(protect.bytes, "wrong"));
    assert.equal((await inspect(protect.bytes, "test-only-password")).pages, 2);
    // Rasterize the sample so OCR cannot succeed by retaining existing text.
    const scan = await page.evaluate(async () => {
      const { PDFDocument } =
        await import("/node_modules/.vite/deps/pdf-lib.js");
      const d = await PDFDocument.create();
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 400;
      const c = canvas.getContext("2d");
      c.fillStyle = "white";
      c.fillRect(0, 0, 1000, 400);
      c.fillStyle = "black";
      c.font = "48px Arial";
      c.fillText("HELLO PROJECT001", 50, 180);
      const image = await d.embedPng(canvas.toDataURL());
      const p = d.addPage([500, 200]);
      p.drawImage(image, { x: 0, y: 0, width: 500, height: 200 });
      return Array.from(await d.save());
    });
    await writeFile(`${root}/scan.pdf`, Buffer.from(scan));
    const ocr = await run("ocr", "scan.pdf");
    assert((await inspect(ocr.bytes)).text.join(" ").includes("HELLO"));
  }
  await page.goto(base);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    `${root}/accessibility.json`,
    JSON.stringify(accessibility.violations, null, 2),
  );
  assert.equal(
    accessibility.violations.length,
    0,
    accessibility.violations
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)
      .join("\n"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${root}/mobile.png`, fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.locator("#search").fill("merge");
  assert.equal(await page.locator(".tool-card:visible").count(), 1);
  assert.deepEqual(requests, [], "No third-party requests");
  assert.deepEqual(errors, [], "No page errors");
  console.log(
    process.env.CHECK === "ui"
      ? "PASS: mobile, accessibility, search, privacy"
      : "PASS: 12 actual downloads, PDF structure/encryption/OCR, Office archives, mobile, accessibility, privacy",
  );
} finally {
  await page.close();
  await browser.close();
}
