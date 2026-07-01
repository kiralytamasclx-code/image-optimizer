# PDF Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a client-side PDF file-size reducer (Ghostscript WASM) to the existing image/SVG/GIF optimizer, following the same per-file-type pattern.

**Architecture:** Ghostscript compiled to WASM, lazy-loaded inside a Web Worker on the first PDF. `optimizePdf()` mirrors `optimizeImage()`; a `PdfResultCard` mirrors `ImageResultCard`; settings gain a 3-way preset. No backend. Repo becomes public (AGPL).

**Tech Stack:** Vite 6, React 18, TypeScript, a Ghostscript-WASM npm package (run in a Worker), plus existing helpers (`downloadUrl`, `formatBytes`, `SavingsBadge`, `ResultCardWrapper`).

## Global Constraints

- **Client-side only.** Files never leave the browser. Node 18+.
- **GS WASM must be lazy-loaded** (only fetched when the first PDF is processed) and run in a **Web Worker** — it must NOT appear in the initial JS bundle (verify in build output, like the AVIF chunks).
- **No unit-test harness** in this project → verify each task with `npm run build` (compile/bundle check) plus the browser preview (`preview_start` + `preview_eval`/screenshot). This replaces the TDD cycle.
- Reuse `downloadUrl` (appends anchor to DOM) for the download; output filename `*.compressed.pdf`.
- **Never return a file larger than the original** — fall back to the original blob (savings 0, "No change").
- Copy/prose: **no em dashes** (portfolio voice).
- **Licensing:** repo becomes public with a top-level `LICENSE` (AGPL-3.0) + `NOTICE`/README attribution crediting Ghostscript.

---

### Task 1: Ghostscript-WASM spike — worker + `optimizePdf` (de-risk FIRST)

Prove GS-WASM compresses a real PDF in the browser before any UI is built. This resolves the one true unknown (which package + Vite/worker wiring works).

**Files:**
- Create: `src/app/components/pdf-worker.ts`
- Create: `src/app/components/pdf-optimizer.ts`
- Modify: `vite.config.ts`
- Modify: `package.json` (GS-WASM dependency)

**Interfaces (Produces):**
- `optimizePdf(file: File, preset: PdfPreset): Promise<PdfOptimizeResult>`
- `type PdfPreset = 'screen' | 'ebook' | 'printer'`
- `interface PdfOptimizeResult { optimizedBlob: Blob; originalSize: number; optimizedSize: number; savings: number; savingsPercent: number }`

- [ ] **Step 1 — Choose + install the package.** Try `@jspawn/ghostscript-wasm` first (`npm i @jspawn/ghostscript-wasm`). Inspect its exports/README for: how to instantiate the Emscripten module, how to write the input file into its virtual FS, how to pass args, and how to read the output file. If it doesn't cleanly load under Vite in a worker, evaluate alternatives (`ghostscript-wasm`, the `@ochachacha` build used by `laurentmmeyer/ghostscript-pdf-compress.wasm`). Record the chosen package + API in this task before proceeding.

- [ ] **Step 2 — Write `pdf-worker.ts`.** A module worker that, on `postMessage({ bytes: ArrayBuffer, preset })`, lazily imports the GS module, writes `bytes` to `/input.pdf` in its virtual FS, runs the argument vector, reads `/output.pdf`, and posts back `{ ok: true, bytes }` (transferable) or `{ ok: false, error }`. Argument vector:
  ```
  ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', `-dPDFSETTINGS=/${preset}`,
   '-dNOPAUSE', '-dQUIET', '-dBATCH', '-sOutputFile=/output.pdf', '/input.pdf']
  ```
  (Exact instantiation/FS calls come from Step 1's package API.)

- [ ] **Step 3 — Write `pdf-optimizer.ts`.** `optimizePdf` lazily constructs the worker with `new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' })`, posts `{ bytes: await file.arrayBuffer(), preset }`, awaits the reply, and returns the result. If `output.size >= file.size`, return `{ optimizedBlob: file, savings: 0, savingsPercent: 0, ... }`. On worker error, reject so the caller shows an error card. Terminate the worker after each job (or pool one lazily — keep it simple: one-shot worker per job for v1).

- [ ] **Step 4 — Vite config.** `worker.format: 'es'` is already set. Add the GS package to `optimizeDeps.exclude` if pre-bundling breaks it; confirm the `.wasm` is emitted as an asset. 

- [ ] **Step 5 — Verify.** `npm run build` succeeds and shows a **separate** GS/worker/wasm chunk (not folded into `index-*.js`). Then create a throwaway image-heavy test PDF, `preview_start`, and `preview_eval` a call to `optimizePdf` (or wire a temporary button) to confirm the output is a **smaller, valid PDF** (fetch the blob, check `type === 'application/pdf'` and size < original). 

- [ ] **Step 6 — Commit.** `git commit -m "feat(pdf): Ghostscript WASM worker + optimizePdf (spike)"`

---

### Task 2: Types + settings model

**Files:** Modify `src/app/components/types.ts`

- [ ] **Step 1 —** Add `'pdf'` to `FileType`. In `getFileType()`, detect `ext === 'pdf' || file.type === 'application/pdf'` → `'pdf'`. Add a `pdf` case to `getFileTypeBadgeColor` (e.g. red: `bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300`). `outputExtension` already falls back to the file type, which is fine for PDFs.
- [ ] **Step 2 —** Add `pdfPreset: PdfPreset` to `ImageCompressionOptions` and `DEFAULT_OPTIONS` (`pdfPreset: 'ebook'`). Import `PdfPreset` type from `pdf-optimizer` (or define it in types and import into pdf-optimizer — keep the single source in `types.ts`).
- [ ] **Step 3 —** Verify with `npm run build`. Commit: `feat(pdf): file type + preset in settings model`.

---

### Task 3: `PdfResultCard`

**Files:** Create `src/app/components/pdf-result-card.tsx`

Mirror `image-result-card.tsx` but simplified: header with the `PDF` badge + filename + `before → after` sizes; a stats row with the `SavingsBadge` (`-X%` / `No change`) and `formatBytes(savings)` saved; a Download `PressableButton` calling `downloadUrl(url, name.replace(/\.pdf$/i,'') + '.compressed.pdf')` where `url` comes from `file.optimizedBlob`. No image preview, no Compare modal. Props: `{ file: ProcessedFile; onRemove: () => void }`.

- [ ] **Step 1 —** Write the component (reuse `formatBytes`, `getFileTypeBadgeColor('pdf')`, `SavingsBadge`, `PressableButton`, `downloadUrl`, iconoir icons `Download`, `Trash`).
- [ ] **Step 2 —** Verify `npm run build`. Commit: `feat(pdf): PdfResultCard`.

---

### Task 4: Wire into App, DropZone, settings, empty state

**Files:** Modify `src/app/App.tsx`, `src/app/components/drop-zone.tsx`, `src/app/components/compression-settings.tsx`

- [ ] **Step 1 — App.processFile:** add a `pdf` branch: `const r = await optimizePdf(rawFile, optionsRef.current.pdfPreset)`; build a `ProcessedFile` with `type:'pdf'`, sizes/savings, `optimizedBlob`, and an `optimizedUrl = URL.createObjectURL(r.optimizedBlob)` (for download). Wrap in try/catch → error card on failure. Render `PdfResultCard` for `file.type === 'pdf'` in the results map.
- [ ] **Step 2 — Download All:** `handleBulkDownload` already handles any `optimizedBlob` via `outputExtension`; confirm PDF blobs (`type application/pdf`) get `.pdf` — extend `outputExtension` in `types.ts` with `case 'application/pdf': return 'pdf'`.
- [ ] **Step 3 — DropZone:** add `'application/pdf'` to `ACCEPTED_TYPES`, `.pdf` to `ACCEPTED_EXTENSIONS` and the file input `accept`; update the "Supports … SVG, PNG, GIF, JPG" line to include PDF.
- [ ] **Step 4 — Settings:** in `compression-settings.tsx`, add a "PDF quality" preset control (three buttons Smaller/`screen`, Balanced/`ebook`, Higher quality/`printer`) bound to `options.pdfPreset`.
- [ ] **Step 5 — Empty state + header:** add a 5th feature card "PDF Compression" in `App.tsx`; update the header subtitle/copy to mention PDF.
- [ ] **Step 6 —** Verify: `npm run build`, then `preview_start` and drop/select a PDF end-to-end (savings shown, download works, Download All includes it). Commit: `feat(pdf): wire PDF through app, dropzone, settings, empty state`.

---

### Task 5: Sample PDF in "Try a sample"

**Files:** Create `public/samples/sample-document.pdf`; Modify `src/app/App.tsx` (`loadSamples`)

- [ ] **Step 1 —** Generate an image-heavy `sample-document.pdf` (e.g. embed the existing `sample-photo` a few times via a one-off `pdf-lib` script, or a local tool). Keep it a few MB so compression is visible.
- [ ] **Step 2 —** Add it to the `loadSamples` `specs` array (`{ url:'samples/sample-document.pdf', name:'sample-document.pdf', type:'application/pdf' }`).
- [ ] **Step 3 —** Verify in preview: "Try a sample" now also produces a compressed PDF card. Commit: `feat(pdf): sample PDF in Try-a-sample`.

---

### Task 6: Licensing + make repo public

**Files:** Create `LICENSE` (AGPL-3.0), `NOTICE`; Modify `README.md`

- [ ] **Step 1 —** Add the full AGPL-3.0 text as `LICENSE`. Add `NOTICE` crediting Ghostscript (AGPL, Artifex) + the WASM build used, with a corresponding-source link (this repo).
- [ ] **Step 2 —** README: add a "PDF compression" line under features + a short "Licensing" section noting the app bundles AGPL Ghostscript-WASM and is therefore AGPL-3.0.
- [ ] **Step 3 —** Make the GitHub repo public via the API (`PATCH /repos/kiralytamasclx-code/image-optimizer {private:false}` with the keychain token).
- [ ] **Step 4 —** Commit: `docs: AGPL license + Ghostscript attribution; make repo public`.

---

### Task 7: Final verification + ship

- [ ] **Step 1 —** `npm run build`; confirm 0 vulns (`npm audit`), GS chunk is lazy (separate from `index-*.js`), CSS/JS initial sizes unchanged.
- [ ] **Step 2 —** Preview full regression: images/SVG/GIF still work; PDF compresses; downloads (single + all) work; error card on a corrupt PDF; no console errors.
- [ ] **Step 3 —** Commit any final touches, push, `vercel deploy --prod`, verify live (site 200, sample PDF asset 200).

---

## Self-review

- **Spec coverage:** engine/worker/lazy (T1), types/settings (T2), result card (T3), integration+dropzone+settings+empty-state (T4), sample PDF (T5), licensing+public repo (T6), verify+ship (T7). All spec sections mapped.
- **Placeholders:** the only deferred detail is the exact GS package API, which Task 1 (the spike) exists to resolve — legitimate for an external-integration unknown, not a lazy gap.
- **Type consistency:** `PdfPreset`, `PdfOptimizeResult`, `optimizePdf` used consistently across T1–T4; `pdfPreset` field consistent T2/T4; `outputExtension` extended for `application/pdf` in T4.
