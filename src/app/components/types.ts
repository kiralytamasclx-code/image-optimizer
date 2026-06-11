export type FileType = 'svg' | 'png' | 'gif' | 'jpg';

export interface ImageCompressionOptions {
  quality: number;       // 0-1 for PNG/GIF
  maxWidthOrHeight: number; // max dimension in px, 0 = no resize
  preserveExif: boolean;
  convertToWebP: boolean;
}

export const DEFAULT_OPTIONS: ImageCompressionOptions = {
  quality: 0.8,
  maxWidthOrHeight: 0,
  preserveExif: false,
  convertToWebP: false,
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
  }
}