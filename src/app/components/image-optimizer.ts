import imageCompression from 'browser-image-compression';
import type { ImageCompressionOptions } from './types';

export interface ImageOptimizationResult {
  optimizedBlob: Blob;
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
  originalDimensions: { width: number; height: number };
  optimizedDimensions: { width: number; height: number };
  animatedGif?: boolean;
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Convert a data URL to a Blob without any URL loading step.
 * Used after canvas.toDataURL() to get a Blob for size comparison / download.
 */
function dataURLtoBlob(dataURL: string): Blob | null {
  try {
    const sep = dataURL.indexOf(',');
    if (sep === -1) return null;
    const header = dataURL.slice(0, sep);
    const b64   = dataURL.slice(sep + 1);
    const mime  = (header.match(/:(.*?);/) ?? [])[1] ?? 'application/octet-stream';
    const bytes = atob(b64);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

function readAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function getImageDimensions(
  file: File | Blob
): Promise<{ width: number; height: number }> {
  // createImageBitmap: no URL, not affected by CSP img-src
  try {
    const bmp  = await createImageBitmap(file);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close();
    return dims;
  } catch { /* fall through */ }

  // Fallback: FileReader → data URL → <img>
  try {
    const dataURL = await readAsDataURL(file);
    return new Promise((res) => {
      const img    = new Image();
      img.onload   = () => res({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror  = () => res({ width: 0, height: 0 });
      img.src = dataURL;
    });
  } catch {
    return { width: 0, height: 0 };
  }
}

// ---------------------------------------------------------------------------
// Canvas encoder
//
// Encodes a canvas to a Blob using two strategies in order:
//
//   1. canvas.toDataURL() + manual base64 → Blob conversion.
//      toDataURL has much better JPEG quality-parameter support in Safari
//      (toBlob's quality parameter was unreliable/ignored in Safari < 17).
//
//   2. canvas.toBlob() — standard async API, used as a fallback.
// ---------------------------------------------------------------------------

function canvasToBlob(
  canvas: HTMLCanvasElement,
  outputType: string,
  quality: number | undefined,
  fallbackFile: File
): Promise<Blob> {
  // Strategy 1 — toDataURL (synchronous, reliable quality in Safari)
  try {
    const dataURL = canvas.toDataURL(outputType, quality);
    if (dataURL && dataURL.length > 6) {           // "data:," is empty
      const blob = dataURLtoBlob(dataURL);
      if (blob && blob.size > 0) return Promise.resolve(blob);
    }
  } catch { /* fall through to toBlob */ }

  // Strategy 2 — toBlob (async, standard)
  return new Promise<Blob>((resolve) => {
    try {
      canvas.toBlob(
        (blob) => resolve(blob ?? fallbackFile),
        outputType,
        quality
      );
    } catch {
      resolve(fallbackFile);
    }
  });
}

// ---------------------------------------------------------------------------
// AVIF encoder (lazy-loaded WASM, @jsquash/avif)
//
// The browser's canvas can't reliably encode AVIF outside Chromium, so we use
// the same libavif-via-WASM encoder Squoosh uses. The module (and its WASM
// binary) is imported dynamically, so it only downloads when a user actually
// asks for AVIF output — the initial bundle stays free of it.
// ---------------------------------------------------------------------------

async function encodeAvif(imageData: ImageData, quality01: number): Promise<Blob> {
  // Import the encode-only entry so the AVIF *decoder* WASM isn't bundled too.
  const { default: encode } = await import('@jsquash/avif/encode');
  const quality = Math.round(Math.min(1, Math.max(0, quality01)) * 100);
  const buffer = await encode(imageData, { quality });
  return new Blob([buffer], { type: 'image/avif' });
}

// ---------------------------------------------------------------------------
// Canvas-based compressor
//
// Image loading chain (most → least reliable in published CDN / Safari):
//
//   A. createImageBitmap(file)
//      Reads bytes directly — no URL loading, bypasses CSP img-src entirely.
//
//   B. FileReader → data URL → <img>
//      For browsers that don't support createImageBitmap (Safari < 15).
//
// Once a canvas is ready, finalize() encodes it: AVIF goes through the WASM
// encoder, everything else through the canvas toDataURL/toBlob path.
// ---------------------------------------------------------------------------

async function canvasCompress(
  file: File,
  options: ImageCompressionOptions
): Promise<Blob> {
  const isJpeg  = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  const fmt = options.outputFormat;
  const outputType = fmt === 'webp' ? 'image/webp'
                   : isJpeg         ? 'image/jpeg'
                                    : 'image/png';
  const quality = (outputType === 'image/jpeg' || outputType === 'image/webp')
    ? options.quality
    : undefined;

  const applyResize = (w: number, h: number) => {
    if (options.maxWidthOrHeight > 0) {
      const max = options.maxWidthOrHeight;
      if (w > max || h > max) {
        const r = Math.min(max / w, max / h);
        return { width: Math.round(w * r), height: Math.round(h * r) };
      }
    }
    return { width: w, height: h };
  };

  const finalize = async (canvas: HTMLCanvasElement): Promise<Blob> => {
    if (fmt === 'avif') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        return await encodeAvif(imageData, options.quality);
      } catch {
        return file;
      }
    }
    return canvasToBlob(canvas, outputType, quality, file);
  };

  // ── Path A: createImageBitmap ──────────────────────────────────────────
  try {
    const bmp = await createImageBitmap(file);
    const { width, height } = applyResize(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close(); throw new Error('no ctx'); }
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();
    return finalize(canvas);
  } catch { /* fall through */ }

  // ── Path B: FileReader → data URL → <img> ────────────────────────────
  try {
    const dataURL = await readAsDataURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload  = () => res(i);
      i.onerror = () => rej(new Error('img load'));
      i.src = dataURL;
    });
    const { width, height } = applyResize(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    return finalize(canvas);
  } catch {
    return file;
  }
}

// ---------------------------------------------------------------------------
// Animated GIF detection
// ---------------------------------------------------------------------------

async function isAnimatedGif(file: File | Blob): Promise<boolean> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let frames = 0, i = 6;
  if (i + 7 > bytes.length) return false;
  const gct = (bytes[i + 4] >> 7) & 1, gcs = bytes[i + 4] & 0x07;
  i += 7;
  if (gct) i += 3 * (1 << (gcs + 1));

  while (i < bytes.length) {
    const b = bytes[i];
    if (b === 0x3b) break;
    if (b === 0x2c) {
      if (++frames > 1) return true;
      i += 9; if (i >= bytes.length) break;
      const lf = (bytes[i] >> 7) & 1, ls = bytes[i] & 0x07; i++;
      if (lf) i += 3 * (1 << (ls + 1));
      i++;
      while (i < bytes.length) { const s = bytes[i++]; if (!s) break; i += s; }
    } else if (b === 0x21) {
      i += 2;
      while (i < bytes.length) { const s = bytes[i++]; if (!s) break; i += s; }
    } else { i++; }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function optimizeImage(
  file: File,
  options: ImageCompressionOptions
): Promise<ImageOptimizationResult> {
  const originalSize    = file.size;
  const originalDimensions = await getImageDimensions(file);

  const isGif  = file.type === 'image/gif'  || file.name.toLowerCase().endsWith('.gif');
  const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);

  // ── Animated GIF (kept animated only when not converting format) ─────────
  if (isGif && options.outputFormat === 'original') {
    const animated = await isAnimatedGif(file);
    if (animated) {
      try {
        // Lazy-load the GIF re-encoder (gifenc + gifuct-js) — only pulled in
        // when an animated GIF is actually processed.
        const { optimizeAnimatedGif } = await import('./gif-optimizer');
        const g = await optimizeAnimatedGif(file, {
          quality: options.quality, maxWidthOrHeight: options.maxWidthOrHeight,
        });
        const ob   = g.blob;
        const blob = ob.size < originalSize ? ob : file;
        const dims = ob.size < originalSize ? { width: g.width, height: g.height } : originalDimensions;
        const sz   = blob.size;
        const sav  = originalSize - sz;
        return { optimizedBlob: blob, originalSize, optimizedSize: sz,
                 savings: sav, savingsPercent: sav > 0 ? (sav / originalSize) * 100 : 0,
                 originalDimensions, optimizedDimensions: dims, animatedGif: true };
      } catch {
        return { optimizedBlob: file, originalSize, optimizedSize: originalSize,
                 savings: 0, savingsPercent: 0, originalDimensions,
                 optimizedDimensions: originalDimensions, animatedGif: true };
      }
    }
  }

  let optimizedBlob: Blob | null = null;

  // ── Step 1: browser-image-compression (best compression where it works) ─
  //
  // Skipped for AVIF — BIC can't emit AVIF, so those go straight to the
  // canvas + WASM path below. useWebWorker: false prevents worker blob-URL
  // failures in CDN builds. Accept the BIC result if it beats the original.

  if (options.outputFormat !== 'avif') {
    try {
      const bicOpts: Parameters<typeof imageCompression>[1] = {
        maxSizeMB:           Math.max(0.05, (originalSize / (1024 * 1024)) * options.quality),
        useWebWorker:        false,
        initialQuality:      options.quality,
        preserveExif:        options.preserveExif,
        alwaysKeepResolution: options.maxWidthOrHeight === 0,
        ...(options.maxWidthOrHeight > 0 && { maxWidthOrHeight: options.maxWidthOrHeight }),
        ...(options.outputFormat === 'webp' && { fileType: 'image/webp' as const }),
        ...(options.outputFormat === 'original' && isJpeg && { fileType: 'image/jpeg' as const }),
        ...(options.outputFormat === 'original' && isGif  && { fileType: 'image/png'  as const }),
      };
      const compressed = await imageCompression(file, bicOpts);
      // Accept any genuine improvement — even 1 byte saved is real compression.
      if (compressed.size < originalSize) {
        optimizedBlob = compressed;
      }
    } catch { /* BIC failed — fall through */ }
  }

  // ── Step 2: canvas fallback (also the AVIF path) ────────────────────────
  //
  // createImageBitmap reads bytes directly — no URL, no img-src CSP issues —
  // so this path works in every published CDN environment. AVIF is encoded
  // here via the lazy WASM module.

  if (!optimizedBlob) {
    optimizedBlob = await canvasCompress(file, options);

    // If a canvas JPEG at the requested quality didn't beat the original,
    // cascade through progressively lower quality levels. Needed in Safari
    // when the source's encoding efficiency rivals the browser's encoder.
    if (
      isJpeg &&
      options.outputFormat === 'original' &&
      options.maxWidthOrHeight === 0 &&
      optimizedBlob.size >= originalSize
    ) {
      const fallbackQualities = [
        Math.max(0.55, options.quality - 0.15),
        Math.max(0.45, options.quality - 0.25),
        0.4,
      ].filter((q, i, a) => i === 0 || q < a[i - 1]);

      for (const q of fallbackQualities) {
        const candidate = await canvasCompress(file, { ...options, quality: q });
        if (candidate.size < originalSize) {
          optimizedBlob = candidate;
          break;
        }
        if (candidate.size < optimizedBlob.size) {
          optimizedBlob = candidate; // at least an improvement over prev attempt
        }
      }
    }
  }

  // Never return a larger file when we're keeping the original format and size.
  // (Format conversions to WebP/AVIF and explicit resizes are allowed to differ.)
  if (
    optimizedBlob.size >= originalSize &&
    options.outputFormat === 'original' &&
    options.maxWidthOrHeight === 0
  ) {
    optimizedBlob = file;
  }

  const optimizedDimensions = await getImageDimensions(optimizedBlob);
  const optimizedSize  = optimizedBlob.size;
  const savings        = originalSize - optimizedSize;
  const savingsPercent = originalSize > 0 ? Math.max(0, (savings / originalSize) * 100) : 0;

  return {
    optimizedBlob, originalSize, optimizedSize,
    savings, savingsPercent, originalDimensions, optimizedDimensions,
  };
}
