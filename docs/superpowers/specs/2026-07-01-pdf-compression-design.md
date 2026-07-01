# PDF Compression — Design Spec

**Date:** 2026-07-01
**Project:** image-optimizer
**Status:** Design (awaiting spec review)

## Goal

Add a PDF file-size reducer alongside the existing in-browser image / SVG / GIF optimizer. Best available compression, running 100% client-side (no backend, files never leave the browser).

## Key decisions

- **Engine: Ghostscript compiled to WebAssembly.** Best-in-class PDF compression — downsamples embedded images to a target DPI, recompresses them, and subsets fonts (70–85% on scan/image-heavy PDFs).
- **Runs client-side, in a Web Worker, lazy-loaded.** The ~10 MB WASM downloads only when the first PDF is added (same on-demand model as the AVIF encoder), so it never affects initial page load and the UI stays responsive during compression.
- **Why not server-side (Vercel):** compression is identical either way (same Ghostscript), so server-side would only trade away privacy, impose Vercel's ~4.5 MB serverless upload cap, and add server cost — for no quality gain. Client-side keeps the privacy promise, handles any PDF size, and costs nothing to run.
- **Package:** a Ghostscript-WASM npm build (candidate `@jspawn/ghostscript-wasm`); the exact package + Vite/worker integration is finalized and verified in the implementation plan.
- **License:** Ghostscript is AGPL-3.0. Because the deployed app ships the AGPL WASM to users, the repo becomes **public** with a top-level `LICENSE` (AGPL-3.0) + a `NOTICE`/README attribution and a corresponding-source link.

## Architecture (follows the existing per-file-type pattern)

- `types.ts` — add `'pdf'` to `FileType`; `getFileType()` detects `.pdf` / `application/pdf`; add a PDF badge color; add a `pdfPreset` field to the settings model.
- `pdf-optimizer.ts` *(new)* — `optimizePdf(file, preset)`: lazily starts the Ghostscript worker, runs the compress command, returns `{ optimizedBlob, originalSize, optimizedSize, savings, savingsPercent }`. Never returns a file larger than the original (falls back to the original → "No change").
- `pdf-worker.ts` *(new)* — the Web Worker: loads the GS WASM, writes input bytes to the GS virtual filesystem, runs `-sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/<preset> -dNOPAUSE -dQUIET -dBATCH`, reads output bytes, posts them back.
- `pdf-result-card.tsx` *(new)* — filename, before → after size, savings badge, Download (`downloadUrl`, `.compressed.pdf`). No image preview and no Compare modal (image-specific).
- `App.tsx` — `processFile()` gains a `pdf` branch → `optimizePdf`; PDFs join the "Download All" ZIP and "Try a sample"; header/accepted-formats copy updated; empty-state gains a 5th "PDF Compression" card.
- `drop-zone.tsx` — accept `application/pdf` + `.pdf`.
- `compression-settings.tsx` — add a **PDF quality** preset control.
- `vite.config.ts` — ensure the GS worker + WASM bundle correctly (reuse `worker.format: 'es'`; add `optimizeDeps` exclude / asset handling as needed).

## Settings — presets

| UI label | Ghostscript `PDFSETTINGS` | ~DPI |
|---|---|---|
| Smaller | `/screen` | 72 |
| **Balanced** (default) | `/ebook` | 150 |
| Higher quality | `/printer` | 300 |

Applied when PDFs are added (consistent with the existing "default settings" model).

## Data flow

Drop/select PDF → placeholder "processing" card → `optimizePdf` posts bytes + preset to the GS worker (worker + WASM lazy-loaded on first use) → GS compresses → result card shows before/after + savings + Download. PDFs are also included in the "Download All" ZIP.

## Error handling

- Encrypted / corrupt / unsupported PDF → GS errors → caught → error card ("Couldn't compress — the PDF may be encrypted or unsupported").
- GS output ≥ original → keep the original, show "No change" (already optimized).
- Worker / WASM load failure → error card.

## Demo

Add an image-heavy `public/samples/sample-document.pdf` (generated from existing sample imagery) and include it in "Try it with a sample".

## Verification

No unit-test harness in this project. Verify in the browser preview: drop the sample PDF and a real PDF, confirm compression + savings + a valid downloadable output; confirm the WASM is lazy (absent from the initial bundle); confirm no network upload of the file (privacy); confirm error cases are handled.

## Out of scope (v1)

- First-page thumbnail / page count (would pull in pdf.js).
- Server-side processing.
- PDF merge / split / preview.
- Per-page or per-image granular control.
