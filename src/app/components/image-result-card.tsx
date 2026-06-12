import React, { useState, Suspense, lazy } from 'react';
import {
  Download,
  Trash as Trash2,
  ArrowRight,
  Expand as Maximize2,
  ControlSlider as SlidersHorizontal,
} from 'iconoir-react';
import { formatBytes } from './svg-optimizer';
import type { ProcessedFile, ImageCompressionOptions, FileType } from './types';
import { getFileTypeLabel, getFileTypeBadgeColor, outputExtension } from './types';
import { SavingsBadge, PressableButton } from './animated';
import { downloadUrl } from './download';

// Compare modal is heavy (image diff slider); load it only when first opened.
const CompareModal = lazy(() => import('./compare-modal').then((m) => ({ default: m.CompareModal })));

interface ImageResultCardProps {
  file: ProcessedFile;
  onRemove: () => void;
  onUpdate?: (updates: Partial<ProcessedFile>) => void;
}

export function ImageResultCard({ file, onRemove, onUpdate }: ImageResultCardProps) {
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoaded, setCompareLoaded] = useState(false);
  const openCompare = () => {
    setCompareLoaded(true);
    setCompareOpen(true);
  };

  const handleDownload = () => {
    if (!file.optimizedUrl) return;
    const ext = outputExtension(file.optimizedBlob, file.type);
    downloadUrl(file.optimizedUrl, file.name.replace(/\.[^.]+$/, '') + `.optimized.${ext}`);
  };

  // Show the output format when it differs from the source (WebP/AVIF conversion, or static GIF -> PNG).
  const outExt = outputExtension(file.optimizedBlob, file.type);
  const converted = outExt !== file.type;
  const outBadgeColor =
    outExt === 'avif'
      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
      : outExt === 'webp'
        ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300'
        : getFileTypeBadgeColor(outExt as FileType);

  const savingsColor =
    (file.savingsPercent || 0) > 20
      ? 'text-green-600'
      : (file.savingsPercent || 0) > 5
        ? 'text-amber-600'
        : 'text-muted-foreground';

  const checkerBg = {
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3C/svg%3E")',
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 ${getFileTypeBadgeColor(file.type)}`}
                style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.03em' }}
              >
                {getFileTypeLabel(file.type)}
              </span>
              {converted && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 ${outBadgeColor}`}
                    style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.03em' }}
                  >
                    {outExt.toUpperCase()}
                  </span>
                </>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: '0.9375rem' }}>
                {file.name}
              </p>
              <div
                className="flex items-center gap-2 text-muted-foreground"
                style={{ fontSize: '0.8125rem' }}
              >
                <span>{formatBytes(file.originalSize || 0)}</span>
                <ArrowRight className="h-3 w-3" />
                <span className={savingsColor}>
                  {formatBytes(file.optimizedSize || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <PressableButton
              onClick={openCompare}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              style={{ fontSize: '0.8125rem' }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Compare
            </PressableButton>
            <PressableButton
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              style={{ fontSize: '0.8125rem' }}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </PressableButton>
            <PressableButton
              onClick={onRemove}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </PressableButton>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 px-5 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: '0.8125rem' }}>
            <SavingsBadge className={savingsColor} style={{ fontWeight: 600 }}>
              {(file.savingsPercent || 0) > 0
                ? `-${file.savingsPercent!.toFixed(1)}%`
                : 'No change'}
            </SavingsBadge>
            {file.animatedGif && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5"
                style={{ fontSize: '0.6875rem', fontWeight: 500 }}
              >
                Animated GIF
              </span>
            )}
            <span className="text-border">|</span>
            {file.originalDimensions && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Maximize2 className="h-3.5 w-3.5" />
                {file.originalDimensions.width}×{file.originalDimensions.height}
                {file.optimizedDimensions &&
                  (file.optimizedDimensions.width !== file.originalDimensions.width ||
                    file.optimizedDimensions.height !== file.originalDimensions.height) && (
                    <>
                      {' → '}
                      {file.optimizedDimensions.width}×{file.optimizedDimensions.height}
                    </>
                  )}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Download className="h-3.5 w-3.5" />
              {formatBytes(file.savings || 0)} saved
            </span>
          </div>
        </div>

        {/* Preview */}
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                className="text-muted-foreground mb-2"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Original
              </p>
              <div
                onClick={openCompare}
                className="group/preview relative flex items-center justify-center rounded-lg border border-border bg-white dark:bg-neutral-900 p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                style={{ minHeight: 160, ...checkerBg }}
              >
                {file.originalUrl && (
                  <img
                    src={file.originalUrl}
                    alt="Original"
                    className="max-w-full object-contain"
                    style={{ maxHeight: 192 }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover/preview:bg-black/40 transition-all pointer-events-none">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-neutral-800/90 dark:text-neutral-100 px-3 py-1.5 opacity-0 group-hover/preview:opacity-100 translate-y-1 group-hover/preview:translate-y-0 transition-all shadow-sm"
                    style={{ fontSize: '0.8125rem', fontWeight: 500 }}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Click to compare
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p
                className="text-muted-foreground mb-2"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Optimized
              </p>
              <div
                onClick={openCompare}
                className="group/preview relative flex items-center justify-center rounded-lg border border-border bg-white dark:bg-neutral-900 p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                style={{ minHeight: 160, ...checkerBg }}
              >
                {file.optimizedUrl && (
                  <img
                    src={file.optimizedUrl}
                    alt="Optimized"
                    className="max-w-full object-contain"
                    style={{ maxHeight: 192 }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover/preview:bg-black/40 transition-all pointer-events-none">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-neutral-800/90 dark:text-neutral-100 px-3 py-1.5 opacity-0 group-hover/preview:opacity-100 translate-y-1 group-hover/preview:translate-y-0 transition-all shadow-sm"
                    style={{ fontSize: '0.8125rem', fontWeight: 500 }}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Click to compare
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compare Modal — lazy-loaded on first open */}
      {compareLoaded && file.originalUrl && file.optimizedUrl && (
        <Suspense fallback={null}>
          <CompareModal
            open={compareOpen}
            onClose={() => setCompareOpen(false)}
            name={file.name}
            fileType={file.type}
            originalUrl={file.originalUrl}
            optimizedUrl={file.optimizedUrl}
            originalSize={file.originalSize || 0}
            optimizedSize={file.optimizedSize || 0}
            savingsPercent={file.savingsPercent || 0}
            originalDimensions={file.originalDimensions}
            optimizedDimensions={file.optimizedDimensions}
            originalFile={file.originalFile}
            onApply={(result) => {
              if (onUpdate) {
                // Revoke old optimized URL if it differs
                if (file.optimizedUrl && file.optimizedUrl !== result.optimizedUrl) {
                  URL.revokeObjectURL(file.optimizedUrl);
                }
                onUpdate({
                  optimizedBlob: result.optimizedBlob,
                  optimizedUrl: result.optimizedUrl,
                  optimizedSize: result.optimizedSize,
                  savings: result.savings,
                  savingsPercent: result.savingsPercent,
                  optimizedDimensions: result.optimizedDimensions,
                });
              }
            }}
          />
        </Suspense>
      )}
    </>
  );
}