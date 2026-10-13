# Project001

An independent, privacy-focused technology and productivity website. Responsive homepage, searchable Applications hub, and 12 local PDF utilities. No backend, accounts, document uploads, analytics, or fixed domain.

## Develop

Requires Node 24 LTS (or Node 26+) and npm. Tested with Node 24.14.1 / npm 11.11.0.

```sh
npm ci
npm run dev -- --port 5173
```

`predev` and `prebuild` copy OCR and PDF assets from installed packages into the ignored `public/vendor/` folder. These assets are served locally; do not delete them from the deployed build.

```sh
npm test
npm run build
npm audit
npm run preview -- --port 4173
```

Production bundle checks: after the development suite and `npm run build`, start preview on port 4173 and run `node tests/production.mjs`. This covers built worker URLs, Office imports, local OCR assets, CSP, and actual downloads.

Browser integration checks: `npm run test:e2e`. By default the test attaches to the shared browser via `coderabbit-agent-browser get cdp-url`. Else set `CDP_URL` to a running Chromium debugging endpoint. `TEST_URL` defaults to `http://localhost:5173`. Tests currently use Vite development module URLs and therefore require the development server. They generate synthetic documents in `/tmp/project001-tests`, click every download, and inspect PDF/Office output, encryption, OCR, mobile overflow, accessibility, and network traffic.

## Architecture

- Vite + strict TypeScript, semantic HTML, CSS, native accessible dialogs.
- `src/main.ts`: navigation, search/filter, file ordering, progress and downloads.
- `src/catalog.ts`: tool descriptions and honest limits.
- `src/pdf.ts`: lazy-loaded PDF operations and conversions.
- `src/qpdf.worker.ts`: isolated qpdf WebAssembly worker for encryption, compression, unlocking and initial repair.
- pdf-lib for PDF manipulation; PDF.js for rendering/text; Tesseract for English OCR; write-excel-file for XLSX; PptxGenJS for PPTX.
- OCR, PDF.js and qpdf use local assets. No document API or external provider is required.

## Tools and limits

| Tool              | Operation                                               | Limits                                                                      |
| ----------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Label Cropper     | Apply an equal margin on all sides of all pages         | Points, not marketplace presets; hidden content remains in PDF              |
| Merge PDF         | Copy pages in selected file order                       | Reorder/remove files in the dialog; interactive forms may change            |
| Split PDF         | Extract specified pages into one PDF                    | Ranges such as `1, 3-5`; not one download per page                          |
| Rotate PDF        | Rotate every page by 90/180/270 degrees                 | No per-page selector yet                                                    |
| Compress PDF      | Lossless stream and object compression                  | No guaranteed reduction; original returned if smaller                       |
| PDF to Excel      | Export text fragments, page and coordinates to XLSX     | No table inference or scanned-text recognition                              |
| PDF to PowerPoint | One rendered page image per slide                       | Text is not editable; maximum 50 pages                                      |
| OCR PDF           | English recognition with an invisible text layer        | English ASCII text; no accuracy guarantee; maximum 50 pages                 |
| Protect PDF       | AES-256 password encryption                             | Minimum eight characters; no password recovery                              |
| Unlock PDF        | Remove encryption using supplied password               | Only authorized files; wrong passwords fail                                 |
| Redact PDF        | Blacken a rectangle, then rebuild all pages from images | Points from displayed top-left; one target page; text/forms/links discarded |
| Repair PDF        | qpdf rewrite, then strict PDF parser recovery fallback  | Tested damaged cross-reference recovery; cannot recover missing content     |

At most 20 files / 50 MB total. Basic page operations accept up to 200 pages per input; raster conversions accept 50. Rendering is limited to 2500 pixels on the longest edge. qpdf workers stop after two minutes. Keep original files: signatures, annotations, forms, metadata, accessibility tags, and fonts may change. Review redactions and OCR results before sharing. These are utilities, not document sanitizers; qpdf operations may preserve active content and attachments already in the input.

## Domain and hosting

Copy `.env.example` to `.env.local` and set `VITE_SITE_URL` only when a domain is chosen. It adds an origin canonical URL; no provider or domain is hard-coded. Hash navigation works on ordinary static hosts without route rewrites. Build output is `dist/`. No production deployment has been performed.

Use HTTPS in production. Configure the static host with the CSP in `vite.config.ts`, plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. Vite headers apply only to development/preview, not automatically to your hosting provider. Permit same-origin WebAssembly, workers, blob downloads and images. Do not enable cross-origin document upload endpoints or add analytics without updating the privacy notice.

The image-size dependency override selects its patched 2.0.3 release; verify compatibility and audit when updating PptxGenJS. Packages and versions are pinned reproducibly in `package-lock.json`.

See [inspection and roadmap](docs/inspection-and-plan.md) for the original repository findings and next priorities.

## Verification on 2026-10-13

- Five unit tests passed for page ranges, merge, split, rotate, crop, invalid input and file limits.
- All 12 tools produced actual browser downloads. Outputs were inspected for expected PDF page geometry/counts, encryption and decryption, spreadsheet text, slide images, redacted text removal, and OCR text recognition.
- A rendered redaction had black pixels inside the selected rectangle and white pixels outside it.
- Production bundle downloads passed for Protect, Excel, PowerPoint, and OCR, with no third-party requests or uncaught page errors in that check.
- Automated WCAG A/AA homepage and dialog checks passed after correcting contrast. Mobile overflow, search, Escape dismissal and internal anchor targets passed. Automated checks do not establish full accessibility conformance.
- TypeScript/production build and formatting passed. Dependency audit reported zero known vulnerabilities. Build warnings for qpdf's Node-only imports were checked against successful production browser execution.

Verification used generated fixtures in Chromium, not a broad customer-document corpus or every browser. No production site was deployed.
