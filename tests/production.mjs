// Run after the development suite has generated its synthetic fixtures.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import assert from "node:assert/strict";
const browser = await chromium.connectOverCDP(
  process.env.CDP_URL ??
    execFileSync("coderabbit-agent-browser", ["get", "cdp-url"], {
      encoding: "utf8",
    }).trim(),
);
const page = await browser.contexts()[0].newPage();
const base = process.env.TEST_URL ?? "http://localhost:4173";
const errors = [],
  remote = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    !r.url().startsWith(base) &&
    !r.url().startsWith("blob:") &&
    !r.url().startsWith("data:")
  )
    remote.push(r.url());
});
try {
  for (const id of ["protect", "excel", "powerpoint", "ocr"]) {
    await page.goto(`${base}/#tool/${id}`);
    await page
      .locator("#files")
      .setInputFiles(
        `/tmp/project001-tests/${id === "ocr" ? "scan" : "sample"}.pdf`,
      );
    if (id === "protect")
      await page.locator("[name=password]").fill("local-test-password");
    await page.locator(".run-button").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#download").hidden ||
        (!document.querySelector("fieldset").disabled &&
          !!document.querySelector("#status").textContent),
      {},
      { timeout: 120000 },
    );
    assert(
      await page.locator("#download").isVisible(),
      await page.locator("#status").textContent(),
    );
    const [d] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#download").click(),
    ]);
    const path = `/tmp/project001-tests/production-${d.suggestedFilename()}`;
    await d.saveAs(path);
    const bytes = await readFile(path);
    if (id === "protect" || id === "ocr") {
      if (id === "protect") await assert.rejects(() => PDFDocument.load(bytes));
      const task = getDocument({
        data: new Uint8Array(bytes),
        password: id === "protect" ? "local-test-password" : undefined,
      });
      try {
        const doc = await task.promise;
        assert.equal(doc.numPages, id === "ocr" ? 1 : 2);
        if (id === "ocr") {
          const text = (await (await doc.getPage(1)).getTextContent()).items
            .map((i) => i.str ?? "")
            .join(" ");
          assert(text.includes("HELLO"));
        }
      } finally {
        await task.destroy();
      }
    } else {
      const zip = await JSZip.loadAsync(bytes);
      assert(
        zip.file(id === "excel" ? "xl/workbook.xml" : "ppt/slides/slide2.xml"),
      );
    }
    console.log(
      `PASS production ${id}: downloaded and parsed ${bytes.length} bytes`,
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS production workers, lazy imports, local OCR assets, CSP and download paths",
  );
} finally {
  await page.close();
  await browser.close();
}
