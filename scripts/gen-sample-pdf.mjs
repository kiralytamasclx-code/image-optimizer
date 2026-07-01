// Generates public/samples/sample-document.pdf — a small image-heavy PDF built
// from the existing sample-photo.png — used by the "Try a sample" demo and for
// verifying PDF compression. Run from the project root: `node scripts/gen-sample-pdf.mjs`.
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'node:fs';

const png = readFileSync('public/samples/sample-photo.png');
const doc = await PDFDocument.create();
const img = await doc.embedPng(png);
const w = img.width / 2;
const h = img.height / 2;

// A few pages, each showing the (large, photographic) image — the kind of
// image-heavy PDF where Ghostscript's downsampling shines.
for (let i = 0; i < 5; i++) {
  const page = doc.addPage([w, h]);
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
}

const bytes = await doc.save();
writeFileSync('public/samples/sample-document.pdf', bytes);
console.log(`sample-document.pdf written: ${bytes.length} bytes, ${doc.getPageCount()} pages`);
