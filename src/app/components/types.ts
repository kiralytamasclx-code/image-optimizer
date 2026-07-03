export type FileType = 'svg' | 'png' | 'gif' | 'jpg' | 'pdf';

export type OutputFormat = 'original' | 'webp' | 'avif';

// Ghostscript -dPDFSETTINGS presets: screen (~72dpi), ebook (~150dpi), printer (~300dpi).
// Only used by the opt-in 'max' PDF mode (Ghostscript).
export type PdfPreset = 'screen' | 'ebook' | 'printer';

// 'text-safe' (default): MuPDF sanitize/garbage-collect — keeps selectable text
// and vectors intact, recompresses images. 'max': Ghostscript re-distill — smaller
// on some files but can drop selectable text (e.g. Type3 design-tool exports).
export type PdfMode = 'text-safe' | 'max';

export interface ImageCompressionOptions {
  quality: number;       // 0-1 for PNG/GIF
  maxWidthOrHeight: number; // max dimension in px, 0 = no resize
  preserveExif: boolean;
  outputFormat: OutputFormat;
  pdfMode: PdfMode;      // how PDFs are compressed (text-safe by default)
  pdfPreset: PdfPreset;  // image fidelity for the 'max' (Ghostscript) mode
}

export const DEFAULT_OPTIONS: ImageCompressionOptions = {
  quality: 0.8,
  maxWidthOrHeight: 0,
  preserveExif: false,
  outputFormat: 'original',
  pdfMode: 'text-safe',
  pdfPreset: 'ebook',
};

export interface ProcessedFile {
  id: string;
  name: string;
  type: FileType;
  status: 'processing' | 'done' | 'error';
  error?: string;
  // SVG specific
  svgResult?: import('./svg-optimizer').OptimizationResult;
  // Image specific
  originalFile?: File;
  optimizedBlob?: Blob;
  originalSize?: number;
  optimizedSize?: number;
  savings?: number;
  savingsPercent?: number;
  originalUrl?: string;
  optimizedUrl?: string;
  originalDimensions?: { width: number; height: number };
  optimizedDimensions?: { width: number; height: number };
  animatedGif?: boolean;
}

export function getFileType(file: File): FileType | null {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'svg' || file.type === 'image/svg+xml') return 'svg';
  if (ext === 'png' || file.type === 'image/png') return 'png';
  if (ext === 'gif' || file.type === 'image/gif') return 'gif';
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return 'jpg';
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  return null;
}

export function getFileTypeLabel(type: FileType): string {
  return type.toUpperCase();
}

export function getFileTypeBadgeColor(type: FileType): string {
  switch (type) {
    case 'svg': return 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300';
    case 'png': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
    case 'gif': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
    case 'jpg': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300';
    case 'pdf': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
  }
}

// Download extension based on the optimized blob's actual MIME type.
// Handles format conversions (WebP/AVIF) and the static-GIF -> PNG case,
// falling back to the original file type when the MIME is unknown.
export function outputExtension(blob: Blob | undefined, fallback: FileType): string {
  switch (blob?.type) {
    case 'image/avif': return 'avif';
    case 'image/webp': return 'webp';
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/gif': return 'gif';
    case 'application/pdf': return 'pdf';
    default: return fallback;
  }
}
