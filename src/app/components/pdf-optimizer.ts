// Main-thread API in front of the PDF compression workers.
//
// Two engines, picked by `mode`:
//   'text-safe' (default) -> MuPDF (pdf-worker-mupdf.ts): keeps selectable text
//                            and vectors intact; recompresses images.
//   'max'                 -> Ghostscript (pdf-worker.ts): smaller on some files
//                            but can drop selectable text (e.g. Type3 exports).
//
// Spins up a fresh module worker per job (both Emscripten modules are effectively
// single-run) and terminates it after, so the multi-MB WASM instance is freed.
// Falls back to the ORIGINAL blob whenever the "optimized" output is not a valid,
// smaller PDF — callers always get the smallest valid PDF and savings is never
// negative.

import type { PdfPreset, PdfMode } from './types';

export type { PdfPreset, PdfMode };

export interface PdfOptimizeResult {
  optimizedBlob: Blob;
  originalSize: number;
  optimizedSize: number;
  /** Bytes saved (never negative). */
  savings: number;
  /** Percentage saved, 0..100. */
  savingsPercent: number;
}

export interface PdfOptimizeOptions {
  /** 'text-safe' (MuPDF, default) or 'max' (Ghostscript). */
  mode?: PdfMode;
  /** Image fidelity for the 'max' (Ghostscript) mode. */
  preset?: PdfPreset;
}

interface WorkerResponse {
  ok: boolean;
  bytes?: ArrayBuffer;
  error?: string;
}

// Image-recompression JPEG quality for the text-safe (MuPDF) mode, per preset.
// 'screen' = Smaller, 'ebook' = Balanced, 'printer' = Higher quality.
function presetToJpegQuality(preset: PdfPreset): number {
  switch (preset) {
    case 'screen': return 60;
    case 'printer': return 88;
    case 'ebook':
    default: return 75;
  }
}

function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 //   F
  );
}

// Two literal `new Worker(new URL('./literal', import.meta.url))` sites so Vite
// statically code-splits each worker (and its lazily-loaded engine + wasm) as
// separate assets. Neither is fetched until a PDF is actually compressed.
function spawnWorker(mode: PdfMode): Worker {
  return mode === 'max'
    ? new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' })
    : new Worker(new URL('./pdf-worker-mupdf.ts', import.meta.url), { type: 'module' });
}

/**
 * Compress a PDF entirely client-side in a Web Worker.
 * Default 'text-safe' mode (MuPDF) preserves selectable text; 'max' (Ghostscript)
 * trades selectable text for smaller output. Returns the original blob unchanged
 * if compression fails or does not shrink it.
 */
export async function optimizePdf(
  file: File | Blob,
  { mode = 'text-safe', preset = 'ebook' }: PdfOptimizeOptions = {},
): Promise<PdfOptimizeResult> {
  const originalBuffer = await file.arrayBuffer();
  const originalSize = originalBuffer.byteLength;

  const noChange = (): PdfOptimizeResult => ({
    optimizedBlob: file instanceof Blob ? file : new Blob([originalBuffer], { type: 'application/pdf' }),
    originalSize,
    optimizedSize: originalSize,
    savings: 0,
    savingsPercent: 0,
  });

  const worker = spawnWorker(mode);
  try {
    // Clone the buffer for transfer so `originalBuffer` stays intact for fallback.
    const transfer = originalBuffer.slice(0);
    const out = await new Promise<ArrayBuffer>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.ok && e.data.bytes) resolve(e.data.bytes);
        else reject(new Error(e.data.error ?? 'PDF compression failed'));
      };
      worker.onerror = (ev) => reject(new Error(ev.message || 'PDF worker crashed'));
      // Ghostscript takes the DPI preset; MuPDF takes an image JPEG quality.
      const payload =
        mode === 'max'
          ? { bytes: transfer, preset }
          : { bytes: transfer, quality: presetToJpegQuality(preset) };
      worker.postMessage(payload, [transfer]);
    });

    const bytes = new Uint8Array(out);
    if (!isPdf(bytes) || bytes.byteLength >= originalSize) return noChange();

    const optimizedSize = bytes.byteLength;
    const savings = originalSize - optimizedSize;
    return {
      optimizedBlob: new Blob([out], { type: 'application/pdf' }),
      originalSize,
      optimizedSize,
      savings,
      savingsPercent: originalSize > 0 ? (savings / originalSize) * 100 : 0,
    };
  } finally {
    worker.terminate();
  }
  // Note: a hard worker/engine failure (e.g. an encrypted or corrupt PDF)
  // rejects the promise above and propagates to the caller, which surfaces an
  // error card. "Valid but not smaller" is handled by noChange() (a done card).
}
