/// <reference lib="webworker" />
//
// PDF compression Web Worker — Ghostscript compiled to WASM (@jspawn/ghostscript-wasm).
//
// The ~16 MB engine glue + WASM are pulled in lazily: the engine JS via a dynamic
// import(), and gs.wasm via a `?url` asset import (Vite emits it as a separate
// hashed file and rewrites the URL at build time). Nothing here lands in the main
// bundle — it only downloads when a PDF is actually compressed. Ghostscript's
// pdfwrite device downsamples/recompresses embedded images and subsets fonts while
// keeping text and vectors intact (unlike a rasterize-to-image approach).

import gsWasmUrl from '@jspawn/ghostscript-wasm/gs.wasm?url';
import type { PdfPreset } from './types';

interface CompressRequest {
  bytes: ArrayBuffer;
  preset: PdfPreset;
}
interface CompressResponse {
  ok: boolean;
  bytes?: ArrayBuffer;
  error?: string;
}

function argsFor(preset: PdfPreset): string[] {
  return [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=/${preset}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-sOutputFile=/output.pdf',
    '/input.pdf',
  ];
}

self.onmessage = async (e: MessageEvent<CompressRequest>) => {
  const { bytes, preset } = e.data;
  const args = argsFor(preset);
  try {
    // Lazy: engine JS is a dynamic import; gs.wasm is a separate emitted asset.
    const { default: createGs } = await import('@jspawn/ghostscript-wasm');
    const Module: any = await createGs({
      noInitialRun: true,
      arguments: args,
      // Point Ghostscript at the Vite-emitted wasm asset (real URL, worker-safe).
      locateFile: (path: string) => (path.endsWith('.wasm') ? gsWasmUrl : path),
      print: () => {},
      printErr: () => {},
    });
    Module.FS.writeFile('/input.pdf', new Uint8Array(bytes));
    Module.callMain(args);
    const out: Uint8Array = Module.FS.readFile('/output.pdf');
    const buf = out.slice().buffer;
    (self as unknown as Worker).postMessage({ ok: true, bytes: buf } as CompressResponse, [buf]);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } as CompressResponse);
  }
};
