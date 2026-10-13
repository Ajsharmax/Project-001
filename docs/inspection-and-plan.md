# Repository inspection and prioritized plan

## Starting state

Inspected commit `043e914466a56ef5ce37af141470ba11c7a8b60f` on 2026-10-13. The entire tracked repository contained a 72-byte README. No application architecture, pages, PDF tools, package manifest, test suite, deployment configuration, instructions, or knowledge-base files existed. No legacy functionality or branding was present to preserve. All code is new and confined to Project-001 on the assigned task branch.

## Highest-priority problems and implementation

1. **No website or architecture:** added a static Vite/TypeScript app with Project001 branding, responsive homepage, filterable Applications hub, and locally drawn decorative artwork.
2. **No PDF operations:** implemented 12 real processing paths using maintained packages and a local qpdf WASM engine. Capability limits are visible before file selection. See README for exact supported scope.
3. **No privacy model:** documents stay in browser memory; dependencies and OCR assets are same-origin; no accounts, analytics, uploads or external font calls. Passwords are cleared after processing. Output blob URLs are revoked when replaced.
4. **No verification:** added unit checks plus browser automation that clicks downloads and inspects generated files, not just UI success states. Synthetic fixtures include an encrypted PDF, raster scan and broken cross-reference table.
5. **No security/accessibility baseline:** strict TypeScript, file limits, native modal focus management, keyboard navigation, escaped text for filenames, CSP for local servers, lazy tool dependencies, and dependency audit.
6. **Undecided domain:** optional `VITE_SITE_URL`; all internal routes and assets are relative to the hosting origin. No production deployment.

## Next priorities

### P1 — deepen editing and compatibility

- Visual page preview and drag-to-select crop/redaction rectangles; current coordinates are explicit and functional but less approachable.
- Real shipping-label presets after confirming target carriers and sample dimensions.
- Test complex real-world fixtures: rotated crop boxes, fillable forms, signatures, multilingual fonts, image-heavy reports, accessibility tags, and corrupted object streams. Current synthetic tests do not prove compatibility with every PDF.
- Validate Safari, Firefox and constrained mobile devices. Current runtime verification is Chromium.
- Add cancellation and move remaining PDF manipulation into workers if larger-file responsiveness warrants it.

### P2 — richer conversion

- Table-layout inference for Excel, selectable text layouts in PowerPoint, additional OCR languages, per-page rotation, and multiple split outputs.
- Opt-in lossy image compression with explicit quality tradeoffs and previews.
- Preserve or rebuild accessibility tagging where practical; flattened outputs lose source document structure.

### P3 — release preparation (requires hosting choice/authorization)

- Choose domain, static host, cache policy and production security headers. Self-host all packaged vendor assets.
- Add CI using a managed browser and fixtures; the current integration harness attaches to an existing browser.
- Confirm applicable third-party license/notice obligations before distribution; keep bundled license files when serving OCR assets.
- Production deployment only with authorization.
