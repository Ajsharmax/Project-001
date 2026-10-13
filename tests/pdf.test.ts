import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { parsePages, processPdf, type Options } from "../src/pdf";
const opts: Options = {
  pages: "2",
  angle: 90,
  margin: 18,
  password: "",
  page: 1,
  x: 0,
  y: 0,
  width: 100,
  height: 50,
};
async function fixture() {
  const d = await PDFDocument.create();
  d.addPage([300, 400]);
  d.addPage([300, 400]);
  return new File([new Uint8Array(await d.save())], "sample.pdf");
}
describe("safe PDF operations", () => {
  it("validates ranges and removes duplicate pages", () => {
    expect(parsePages("3, 1-2, 2", 3)).toEqual([2, 0, 1]);
    for (const v of ["", "0", "4", "2-1", "1.2", "1-999999"])
      expect(() => parsePages(v, 3)).toThrow();
  });
  it("merges real documents", async () => {
    const f = await fixture();
    const r = await processPdf("merge", [f, f], opts, () => {});
    expect(
      (await PDFDocument.load(await r.blob.arrayBuffer())).getPageCount(),
    ).toBe(4);
  });
  it("extracts and rotates pages", async () => {
    const f = await fixture();
    const split = await processPdf("split", [f], opts, () => {});
    expect(
      (await PDFDocument.load(await split.blob.arrayBuffer())).getPageCount(),
    ).toBe(1);
    const rotate = await processPdf("rotate", [f], opts, () => {});
    expect(
      (await PDFDocument.load(await rotate.blob.arrayBuffer()))
        .getPage(0)
        .getRotation().angle,
    ).toBe(90);
  });
  it("crops with bounded margins", async () => {
    const f = await fixture();
    const r = await processPdf("crop", [f], opts, () => {});
    expect(
      (await PDFDocument.load(await r.blob.arrayBuffer()))
        .getPage(0)
        .getCropBox(),
    ).toEqual({ x: 18, y: 18, width: 264, height: 364 });
    await expect(
      processPdf("crop", [f], { ...opts, margin: 160 }, () => {}),
    ).rejects.toThrow();
  });
  it("rejects empty, fake, and oversized inputs", async () => {
    await expect(processPdf("merge", [], opts, () => {})).rejects.toThrow();
    await expect(
      processPdf("rotate", [new File(["fake"], "fake.pdf")], opts, () => {}),
    ).rejects.toThrow();
    await expect(
      processPdf("merge", Array(21).fill(await fixture()), opts, () => {}),
    ).rejects.toThrow();
  });
});
