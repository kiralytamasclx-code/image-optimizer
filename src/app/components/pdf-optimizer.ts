// Main-thread API in front of the PDF compression worker.
//
// Spins up a fresh module worker per job (the Emscripten Ghostscript module is
// effectively single-run) and terminates it after, so the ~16 MB WASM instance
// is freed. Falls back to the ORIGINAL blob whenever the "optimized" output is
// not a valid, smaller PDF — callers always get the smallest valid PDF and
// savings is never negative.

import type { PdfPreset } from './types';

export type { PdfPreset };

export interface PdfOptimizeResult {
  optimizedBlob: Blob;
  originalSize: number;
  optimizedSize: number;
  /** Bytes saved (never negative). */
  savings: number;
  /** Percentage saved, 0..100. */
  savingsPercent: number;
}

interface WorkerResponse {
  ok: boolean;
  bytes?: ArrayBuffer;
  error?: string;
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

/**
 * Compress a PDF entirely client-side in a Web Worker (Ghostscript WASM).
 * Returns the original blob unchanged if compression fails or does not shrink it.
 */
export async function optimizePdf(
  file: File | Blob,
  preset: PdfPreset = 'ebook',
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

  // new URL(..., import.meta.url) is the pattern Vite statically analyses to
  // code-split the worker (and its lazily-imported engine + wasm) as separate
  // assets. Fresh worker per job; terminated in `finally`.
  const worker = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' });
  try {
    // Clone the buffer for transfer so `originalBuffer` stays intact for fallback.
    const transfer = originalBuffer.slice(0);
    const out = await new Promise<ArrayBuffer>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.ok && e.data.bytes) resolve(e.data.bytes);
        else reject(new Error(e.data.error ?? 'PDF compression failed'));
      };
      worker.onerror = (ev) => reject(new Error(ev.message || 'PDF worker crashed'));
      worker.postMessage({ bytes: transfer, preset }, [transfer]);
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
  } catch {
    return noChange();
  } finally {
    worker.terminate();
  }
}
