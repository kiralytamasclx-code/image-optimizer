/// <reference lib="webworker" />
//
// Text-safe PDF compression Web Worker — MuPDF compiled to WASM (`mupdf`).
//
// This is the DEFAULT PDF path. It does two things, neither of which touches the
// text/font layer, so selectable text (including Type3 /ToUnicode) is always
// preserved:
//   1. Re-encodes embedded raster images to JPEG at a chosen quality. MuPDF
//      decodes any source image (any colorspace/filter) to a pixmap, so a bloated
//      raw/Flate image becomes a compact JPEG — big wins on scans/photos.
//   2. saveToBuffer with `sanitize` (re-tokenize content streams, drop redundant
//      operators), `garbage=4` (dedupe + prune objects) and `compress` — big wins
//      on bloated vector/design-tool exports (e.g. Type3 resumes).
//
// Verified on a real design-tool export: page renders stay pixel-identical,
// extracted text byte-identical, all ToUnicode maps intact.
//
// The ~10 MB wasm is pulled in lazily; MuPDF locates it via
// `new URL('mupdf-wasm.wasm', import.meta.url)`, which Vite rewrites to the
// emitted hashed asset — so nothing lands in the main bundle.
//
// IMPORTANT: mupdf is loaded with a DYNAMIC import, not a static top-level one.
// mupdf's module initialises its wasm with top-level await; a static
// `import * as mupdf from 'mupdf'` makes THIS worker module await too, so
// `self.onmessage` isn't registered until after init — and the request message
// posted meanwhile is dropped, leaving the worker hung forever (observed in the
// production build). Registering onmessage synchronously and buffering the
// request until the dynamic import resolves avoids that. Types come from a
// type-only import, which is erased and carries no runtime await.

import type * as MuPDF from 'mupdf';

interface CompressRequest {
  bytes: ArrayBuffer;
  /** JPEG quality for image re-encoding, 0..100. */
  quality: number;
}
interface CompressResponse {
  ok: boolean;
  bytes?: ArrayBuffer;
  error?: string;
}

// sanitize   — re-tokenize content streams, remove redundant operators
// garbage=4  — dedupe identical objects + prune unreferenced ones (max level)
// compress / compress-fonts — flate-compress streams and font files
// (Images are handled explicitly in recompressImages, before saving.)
const SAVE_OPTIONS = 'sanitize,garbage=4,compress,compress-fonts';

let mod: typeof MuPDF | undefined;
let pending: CompressRequest | null = null;

self.onmessage = (e: MessageEvent<CompressRequest>) => {
  if (mod) compress(e.data);
  else pending = e.data; // buffer until the engine finishes loading
};

import('mupdf')
  .then((m) => {
    mod = m;
    if (pending) {
      const req = pending;
      pending = null;
      compress(req);
    }
  })
  .catch((err) => fail('Failed to load the PDF engine: ' + message(err)));

function compress(req: CompressRequest): void {
  let doc: MuPDF.PDFDocument | undefined;
  let buffer: MuPDF.Buffer | undefined;
  try {
    doc = mod!.PDFDocument.openDocument(new Uint8Array(req.bytes), 'application/pdf') as MuPDF.PDFDocument;
    // Best-effort image pass: a failure here must not sink the whole compression,
    // and any images already re-encoded before a throw stay valid.
    try {
      recompressImages(doc, req.quality);
    } catch {
      /* fall through to a plain sanitize/save */
    }
    buffer = doc.saveToBuffer(SAVE_OPTIONS);
    // Copy out of wasm memory into a standalone, transferable ArrayBuffer.
    const copy = buffer.asUint8Array().slice();
    const buf = copy.buffer;
    (self as unknown as Worker).postMessage({ ok: true, bytes: buf } as CompressResponse, [buf]);
  } catch (err) {
    fail(message(err));
  } finally {
    try { buffer?.destroy(); } catch { /* noop */ }
    try { doc?.destroy(); } catch { /* noop */ }
  }
}

// Re-encode embedded raster images to JPEG at `quality`, in place. Only touches
// image XObjects — never fonts/text/content — so selectable text is preserved.
// Conservative: skips image masks, non-Gray/RGB colorspaces, tiny images, and any
// image whose JPEG would not be smaller than the current raw stream.
//
// NB: isStream()/get()/put()/writeRawStream() are called on the INDIRECT
// reference (doc.newIndirect(num)); MuPDF tracks stream data on the xref entry, so
// a resolved dict reports isStream() === false.
function recompressImages(doc: MuPDF.PDFDocument, quality: number): void {
  const count = doc.countObjects();
  for (let num = 1; num < count; num++) {
    let ref: MuPDF.PDFObject;
    try { ref = doc.newIndirect(num); } catch { continue; }
    if (!ref.isStream()) continue;

    let subtype: MuPDF.PDFObject;
    try { subtype = ref.get('Subtype'); } catch { continue; }
    if (!subtype || !subtype.isName() || subtype.asName() !== 'Image') continue;

    const imageMask = ref.get('ImageMask');
    if (imageMask && imageMask.isBoolean() && imageMask.asBoolean()) continue;

    let image: MuPDF.Image | undefined;
    let pix: MuPDF.Pixmap | undefined;
    try {
      image = doc.loadImage(ref);
      if (image.getWidth() * image.getHeight() < 32 * 32) continue; // not worth it
      pix = image.toPixmap();
      const colorComponents = pix.getNumberOfComponents() - pix.getAlpha();
      if (colorComponents !== 1 && colorComponents !== 3) continue; // gray/rgb only

      const jpeg = pix.asJPEG(quality, false);
      let origLen = Number.MAX_SAFE_INTEGER;
      try {
        const len = ref.get('Length');
        if (len && len.isInteger()) origLen = len.asNumber();
      } catch { /* keep sentinel */ }
      if (jpeg.length >= origLen) continue; // never grow an image

      const gray = colorComponents === 1;
      const smask = ref.get('SMask');
      const mask = ref.get('Mask');
      ref.put('Width', doc.newInteger(pix.getWidth()));
      ref.put('Height', doc.newInteger(pix.getHeight()));
      ref.put('BitsPerComponent', doc.newInteger(8));
      ref.put('ColorSpace', doc.newName(gray ? 'DeviceGray' : 'DeviceRGB'));
      ref.put('Filter', doc.newName('DCTDecode'));
      ref.delete('DecodeParms');
      ref.delete('Decode');
      // Preserve transparency/masking references (their own XObjects are handled
      // separately by this same loop).
      if (smask && !smask.isNull()) ref.put('SMask', smask);
      if (mask && !mask.isNull()) ref.put('Mask', mask);
      ref.writeRawStream(jpeg); // raw = already DCT (JPEG) encoded
    } catch {
      /* leave this image untouched */
    } finally {
      try { pix?.destroy(); } catch { /* noop */ }
      try { image?.destroy(); } catch { /* noop */ }
    }
  }
}

function fail(error: string): void {
  (self as unknown as Worker).postMessage({ ok: false, error } as CompressResponse);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
