import { mkdir, cp } from "node:fs/promises";
await mkdir("public/vendor", { recursive: true });
for (const [source, target] of [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core", "tesseract-core"],
  ["@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", "eng.traineddata.gz"],
  ["pdfjs-dist/cmaps", "cmaps"],
  ["pdfjs-dist/standard_fonts", "standard_fonts"],
  ["pdfjs-dist/wasm", "wasm"],
])
  await cp(`node_modules/${source}`, `public/vendor/${target}`, {
    recursive: true,
  });
