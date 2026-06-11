import React, { useState, useMemo, Suspense, lazy } from 'react';
import {
  Download,
  Copy,
  Check,
  Trash as Trash2,
  Eye as EyeIcon,
  Code,
  ArrowRight,
  MultiplePages as Layers,
  CurveArray as Route,
  Label as Tags,
  ControlSlider as SlidersHorizontal,
} from 'iconoir-react';
import { OptimizationResult, formatBytes } from './svg-optimizer';
import { getFileTypeLabel, getFileTypeBadgeColor } from './types';
import { SavingsBadge, PressableButton } from './animated';

// Compare modal is heavy (image diff slider); load it only when first opened.
const CompareModal = lazy(() => import('./compare-modal').then((m) => ({ default: m.CompareModal })));

interface SVGResultCardProps {
  name: string;
  result: OptimizationResult;
  onRemove: () => void;
}

export function SVGResultCard({ name, result, onRemove }: SVGResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [activeView, setActiveView] = useState<'preview' | 'original' | 'optimized'>('preview');
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoaded, setCompareLoaded] = useState(false);
  const openCompare = () => {
    setCompareLoaded(true);
    setCompareOpen(true);
  };

  const originalBlobUrl = useMemo(() => {
    const blob = new Blob([result.original], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }, [result.original]);

  const optimizedBlobUrl = useMemo(() => {
    const blob = new Blob([result.optimized], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }, [result.optimized]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.optimized);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result.optimized], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.replace('.svg', '') + '.optimized.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const savingsColor =
    result.savingsPercent > 20
      ? 'text-green-600'
      : result.savingsPercent > 5
        ? 'text-amber-600'
        : 'text-muted-foreground';

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 ${getFileTypeBadgeColor('svg')}`}
              style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.03em' }}
            >
              {getFileTypeLabel('svg')}
            </span>
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: '0.9375rem' }}>
                {name}
              </p>
              <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: '0.8125rem' }}>
                <span>{formatBytes(result.originalSize)}</span>
                <ArrowRight className="h-3 w-3" />
                <span className={savingsColor}>{formatBytes(result.optimizedSize)}</span>
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
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              style={{ fontSize: '0.8125rem' }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
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
          <div className="flex items-center gap-4" style={{ fontSize: '0.8125rem' }}>
            <SavingsBadge className={`${savingsColor}`} style={{ fontWeight: 600 }}>
              {result.savingsPercent > 0 ? `-${result.savingsPercent.toFixed(1)}%` : 'No change'}
            </SavingsBadge>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              {result.removedElements} elements removed
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tags className="h-3.5 w-3.5" />
              {result.removedAttributes} attrs stripped
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Route className="h-3.5 w-3.5" />
              {result.simplifiedPaths} paths simplified
            </span>
          </div>
        </div>

        {/* Preview */}
        <div className="p-5">
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={() => setActiveView('preview')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                activeView === 'preview'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              style={{ fontSize: '0.8125rem' }}
            >
              <EyeIcon className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              onClick={() => {
                setActiveView('original');
                setShowCode(true);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                activeView === 'original'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              style={{ fontSize: '0.8125rem' }}
            >
              Original Code
            </button>
            <button
              onClick={() => {
                setActiveView('optimized');
                setShowCode(true);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                activeView === 'optimized'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              style={{ fontSize: '0.8125rem' }}
            >
              Optimized Code
            </button>
          </div>

          {activeView === 'preview' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground mb-2" style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Original
                </p>
                <div
                  className="flex items-center justify-center rounded-lg border border-border bg-white dark:bg-neutral-900 p-6"
                  style={{ minHeight: 160, backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3C/svg%3E")' }}
                >
                  <img
                    src={originalBlobUrl}
                    alt="Original SVG"
                    className="max-w-full object-contain"
                    style={{ maxHeight: 192 }}
                  />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-2" style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Optimized
                </p>
                <div
                  className="flex items-center justify-center rounded-lg border border-border bg-white dark:bg-neutral-900 p-6"
                  style={{ minHeight: 160, backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3C/svg%3E")' }}
                >
                  <img
                    src={optimizedBlobUrl}
                    alt="Optimized SVG"
                    className="max-w-full object-contain"
                    style={{ maxHeight: 192 }}
                  />
                </div>
              </div>
            </div>
          )}

          {(activeView === 'original' || activeView === 'optimized') && (
            <div className="relative">
              <pre
                className="overflow-auto rounded-lg bg-[#1e1e2e] text-[#cdd6f4] p-4"
                style={{ fontSize: '0.8125rem', lineHeight: 1.6, maxHeight: 320 }}
              >
                <code>{activeView === 'original' ? result.original : result.optimized}</code>
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Compare Modal — lazy-loaded on first open */}
      {compareLoaded && (
        <Suspense fallback={null}>
          <CompareModal
            open={compareOpen}
            onClose={() => setCompareOpen(false)}
            name={name}
            fileType="svg"
            originalUrl={originalBlobUrl}
            optimizedUrl={optimizedBlobUrl}
            originalSize={result.originalSize}
            optimizedSize={result.optimizedSize}
            savingsPercent={result.savingsPercent}
          />
        </Suspense>
      )}
    </>
  );
}