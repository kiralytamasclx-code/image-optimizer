import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Code as FileCode2Icon,
  MediaImage,
  Sparks,
  Trash,
  Archive,
  RefreshDouble,
  SunLight,
  HalfMoon,
  Lock,
} from 'iconoir-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { DropZone } from './components/drop-zone';
import { SVGResultCard } from './components/svg-result-card';
import { ImageResultCard } from './components/image-result-card';
import { CompressionSettings } from './components/compression-settings';
import { optimizeSVG, formatBytes } from './components/svg-optimizer';
import { optimizeImage } from './components/image-optimizer';
import type { ProcessedFile, ImageCompressionOptions } from './components/types';
import { getFileType, DEFAULT_OPTIONS, outputExtension } from './components/types';
import { CountUp, StaggeredStatCard, ResultCardWrapper, SavingsBadge, PressableButton } from './components/animated';
import { Footer } from './components/footer';
import { downloadUrl } from './components/download';

export default function App() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [zipping, setZipping] = useState(false);
  const [compressionOptions, setCompressionOptions] =
    useState<ImageCompressionOptions>(DEFAULT_OPTIONS);
  const [processing, setProcessing] = useState(0);
  const optionsRef = useRef(compressionOptions);
  optionsRef.current = compressionOptions;

  // Track whether summary stats have already appeared (skip stagger delays on updates)
  const statsShownRef = useRef(false);
  useEffect(() => {
    if (files.some((f) => f.status === 'done')) {
      // Mark as shown after the initial stagger finishes (~1.5s)
      const timer = setTimeout(() => { statsShownRef.current = true; }, 1500);
      return () => clearTimeout(timer);
    } else {
      statsShownRef.current = false;
    }
  }, [files.length]);

  // Dark mode
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const processFile = useCallback(async (rawFile: File): Promise<ProcessedFile> => {
    const id = crypto.randomUUID();
    const fileType = getFileType(rawFile);

    if (!fileType) {
      return {
        id,
        name: rawFile.name,
        type: 'png',
        status: 'error',
        error: 'Unsupported file type',
      };
    }

    if (fileType === 'svg') {
      const content = await rawFile.text();
      const result = optimizeSVG(content);
      return {
        id,
        name: rawFile.name,
        type: 'svg',
        status: 'done',
        svgResult: result,
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        savings: result.savings,
        savingsPercent: result.savingsPercent,
      };
    }

    // PNG or GIF
    try {
      const opts = optionsRef.current;
      const result = await optimizeImage(rawFile, opts);
      const originalUrl = URL.createObjectURL(rawFile);
      const optimizedUrl = URL.createObjectURL(result.optimizedBlob);

      return {
        id,
        name: rawFile.name,
        type: fileType,
        status: 'done',
        originalFile: rawFile,
        optimizedBlob: result.optimizedBlob,
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        savings: result.savings,
        savingsPercent: result.savingsPercent,
        originalUrl,
        optimizedUrl,
        originalDimensions: result.originalDimensions,
        optimizedDimensions: result.optimizedDimensions,
        animatedGif: result.animatedGif,
      };
    } catch (err: any) {
      return {
        id,
        name: rawFile.name,
        type: fileType,
        status: 'error',
        error: err?.message || 'Compression failed',
        originalSize: rawFile.size,
      };
    }
  }, []);

  const handleFilesDropped = useCallback(
    async (rawFiles: File[]) => {
      setProcessing((p) => p + rawFiles.length);

      // Add placeholder entries
      const placeholders: ProcessedFile[] = rawFiles.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        type: getFileType(f) || 'png',
        status: 'processing' as const,
        originalSize: f.size,
      }));
      setFiles((prev) => [...placeholders, ...prev]);

      // Process all files concurrently
      const results = await Promise.all(rawFiles.map((f) => processFile(f)));

      setFiles((prev) => {
        // Remove placeholders and prepend results
        const placeholderIds = new Set(placeholders.map((p) => p.id));
        const withoutPlaceholders = prev.filter((f) => !placeholderIds.has(f.id));
        return [...results, ...withoutPlaceholders];
      });

      setProcessing((p) => p - rawFiles.length);
    },
    [processFile]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.originalUrl) URL.revokeObjectURL(file.originalUrl);
      if (file?.optimizedUrl) URL.revokeObjectURL(file.optimizedUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<ProcessedFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const clearAll = useCallback(() => {
    files.forEach((f) => {
      if (f.originalUrl) URL.revokeObjectURL(f.originalUrl);
      if (f.optimizedUrl) URL.revokeObjectURL(f.optimizedUrl);
    });
    setFiles([]);
  }, [files]);

  const handleBulkDownload = useCallback(async () => {
    const doneFiles = files.filter((f) => f.status === 'done');
    if (doneFiles.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const file of doneFiles) {
        if (file.type === 'svg' && file.svgResult) {
          const optimizedName = file.name.replace(/\.svg$/i, '.optimized.svg');
          zip.file(optimizedName, file.svgResult.optimized);
        } else if (file.optimizedBlob) {
          const ext = outputExtension(file.optimizedBlob, file.type);
          const optimizedName = file.name.replace(/\.[^.]+$/, '') + `.optimized.${ext}`;
          zip.file(optimizedName, file.optimizedBlob);
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, 'optimized-images.zip');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setZipping(false);
    }
  }, [files]);

  const loadSamples = useCallback(async () => {
    const specs = [
      { url: 'samples/sample-illustration.svg', name: 'sample-illustration.svg', type: 'image/svg+xml' },
      { url: 'samples/sample-photo.png', name: 'sample-photo.png', type: 'image/png' },
    ];
    try {
      const sampleFiles = await Promise.all(
        specs.map(async (s) => {
          const res = await fetch(`${import.meta.env.BASE_URL}${s.url}`);
          if (!res.ok) throw new Error(`Failed to load ${s.url}`);
          const blob = await res.blob();
          return new File([blob], s.name, { type: s.type });
        })
      );
      handleFilesDropped(sampleFiles);
    } catch {
      /* sample assets unavailable — ignore */
    }
  }, [handleFilesDropped]);

  const doneFiles = files.filter((f) => f.status === 'done');
  const totalOriginal = doneFiles.reduce((sum, f) => sum + (f.originalSize || 0), 0);
  const totalOptimized = doneFiles.reduce((sum, f) => sum + (f.optimizedSize || 0), 0);
  const totalSavings = totalOriginal - totalOptimized;
  const totalSavingsPercent =
    totalOriginal > 0 ? (totalSavings / totalOriginal) * 100 : 0;

  const svgCount = doneFiles.filter((f) => f.type === 'svg').length;
  const pngCount = doneFiles.filter((f) => f.type === 'png').length;
  const gifCount = doneFiles.filter((f) => f.type === 'gif').length;
  const jpgCount = doneFiles.filter((f) => f.type === 'jpg').length;

  const hasImageFiles = files.some((f) => f.type === 'png' || f.type === 'gif' || f.type === 'jpg');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg
                width="22"
                height="22"
                viewBox="0 0 36 36"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                role="img"
              >
                <circle fill="currentColor" opacity="0.5" cx="13" cy="33" r="3" />
                <circle fill="currentColor" opacity="0.5" cx="32" cy="33" r="3" />
                <path fill="currentColor" opacity="0.5" d="M13 32h19v2H13z" />
                <path fill="currentColor" opacity="0.7" d="M20 15.502c0-1.381 1.119-1.5 2.5-1.5s2.5.119 2.5 1.5V33.5a2.5 2.5 0 1 1-5 0V15.502z" />
                <path fill="currentColor" opacity="0.5" d="M27 15.002a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2c0-1.105.896-1 2-1h5c1.104 0 2-.104 2 1z" />
                <path fill="currentColor" opacity="0.85" d="M28 27a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5zm0-22a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1z" />
                <path fill="currentColor" opacity="0.85" d="M13 22a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h15V4a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v19a4 4 0 0 0 4 4h14a4 4 0 0 0 4-4v-1H13z" />
                <path fill="currentColor" d="M9 20a2 2 0 0 1-4 0V7a2 2 0 0 1 4 0v13z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>Image Optimizer</h1>
              <p
                className="text-muted-foreground"
                style={{ fontSize: '0.8125rem' }}
              >
                Optimize SVGs, compress JPGs, PNGs & GIFs — all in-browser
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <>
                {processing > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 text-muted-foreground"
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <RefreshDouble className="h-3.5 w-3.5 animate-spin" />
                    Processing {processing}…
                  </span>
                )}
                <PressableButton
                  onClick={handleBulkDownload}
                  disabled={zipping || doneFiles.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  style={{ fontSize: '0.875rem' }}
                >
                  <Archive className="h-4 w-4" />
                  {zipping ? 'Zipping…' : `Download All (${doneFiles.length})`}
                </PressableButton>
                <PressableButton
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  style={{ fontSize: '0.875rem' }}
                >
                  <Trash className="h-4 w-4" />
                  Clear All
                </PressableButton>
              </>
            )}
            <button
              onClick={() => setDark(!dark)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={dark ? 'sun' : 'moon'}
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex"
                >
                  {dark ? <SunLight className="h-5 w-5" /> : <HalfMoon className="h-5 w-5" />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Privacy reassurance */}
        <div className="flex justify-center mb-6">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground"
            style={{ fontSize: '0.75rem' }}
          >
            <Lock className="h-3 w-3" />
            100% private. Your files never leave your browser.
          </span>
        </div>

        {/* Drop Zone */}
        <DropZone onFilesDropped={handleFilesDropped} hasFiles={files.length > 0} />

        {/* First-run nudge: try the tool instantly with bundled samples */}
        {files.length === 0 && (
          <div className="mt-4 flex justify-center">
            <PressableButton
              onClick={loadSamples}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-foreground hover:bg-muted transition-colors"
              style={{ fontSize: '0.875rem' }}
            >
              <Sparks className="h-4 w-4 text-primary" />
              Try it with a sample
            </PressableButton>
          </div>
        )}

        {/* Compression Settings — show when there are image files or always for discoverability */}
        <div className="mt-6">
          <CompressionSettings
            options={compressionOptions}
            onChange={setCompressionOptions}
          />
        </div>

        {/* Summary Stats */}
        {doneFiles.length > 0 && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Card 1: Files — appears immediately */}
            <StaggeredStatCard delay={statsShownRef.current ? 0 : 0} className="rounded-xl border border-border bg-card p-4">
              <p
                className="text-muted-foreground"
                style={{ fontSize: '0.8125rem' }}
              >
                Files
              </p>
              <p className="mt-1" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                <CountUp value={doneFiles.length} formatter={(n) => String(n)} />
              </p>
              <div
                className="flex gap-2 mt-1 text-muted-foreground"
                style={{ fontSize: '0.6875rem' }}
              >
                {svgCount > 0 && (
                  <span className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 px-1.5 py-0.5 rounded">
                    {svgCount} SVG
                  </span>
                )}
                {pngCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 px-1.5 py-0.5 rounded">
                    {pngCount} PNG
                  </span>
                )}
                {gifCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                    {gifCount} GIF
                  </span>
                )}
                {jpgCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 px-1.5 py-0.5 rounded">
                    {jpgCount} JPG
                  </span>
                )}
              </div>
            </StaggeredStatCard>

            {/* Card 2: Original Size — appears at 0.05s, counts immediately */}
            <StaggeredStatCard delay={statsShownRef.current ? 0 : 0.05} className="rounded-xl border border-border bg-card p-4">
              <p
                className="text-muted-foreground"
                style={{ fontSize: '0.8125rem' }}
              >
                Original Size
              </p>
              <p className="mt-1" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                <CountUp value={totalOriginal} formatter={formatBytes} />
              </p>
            </StaggeredStatCard>

            {/* Card 3: Optimized Size — appears at 0.55s, counts with 550ms delay */}
            <StaggeredStatCard delay={statsShownRef.current ? 0 : 0.55} className="rounded-xl border border-border bg-card p-4">
              <p
                className="text-muted-foreground"
                style={{ fontSize: '0.8125rem' }}
              >
                Optimized Size
              </p>
              <p className="mt-1" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                <CountUp value={totalOptimized} formatter={formatBytes} delay={statsShownRef.current ? 0 : 550} />
              </p>
            </StaggeredStatCard>

            {/* Card 4: Total Savings — appears at 1.1s, badge pops with delay */}
            <StaggeredStatCard delay={statsShownRef.current ? 0 : 1.1} className="rounded-xl border border-border bg-card p-4">
              <p
                className="text-muted-foreground"
                style={{ fontSize: '0.8125rem' }}
              >
                Total Savings
              </p>
              <p className="mt-1" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                <SavingsBadge
                  key={totalSavingsPercent.toFixed(1)}
                  className="text-green-600"
                  delay={statsShownRef.current ? 0 : 1.1}
                >
                  {totalSavingsPercent > 0
                    ? `-${totalSavingsPercent.toFixed(1)}%`
                    : '—'}
                </SavingsBadge>
              </p>
              {totalSavings > 0 && (
                <motion.p
                  key={`saved-${totalSavings}`}
                  className="text-green-600"
                  style={{ fontSize: '0.75rem' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: statsShownRef.current ? 0 : 1.35, duration: 0.2 }}
                >
                  {formatBytes(totalSavings)} saved
                </motion.p>
              )}
            </StaggeredStatCard>
          </div>
        )}

        {/* Results */}
        {files.length > 0 && (
          <div className="mt-8 flex flex-col gap-6">
            {files.map((file, index) => {
              if (file.status === 'processing') {
                return (
                  <ResultCardWrapper key={file.id} index={index}>
                    <div
                      className="relative rounded-xl border border-border bg-card p-6 flex items-center gap-4 overflow-hidden"
                    >
                      {/* Shimmer overlay */}
                      <div className="shimmer absolute inset-0 pointer-events-none" />
                      <RefreshDouble className="h-5 w-5 animate-spin text-muted-foreground relative z-10" />
                      <div className="relative z-10">
                        <p style={{ fontSize: '0.9375rem' }}>{file.name}</p>
                        <p
                          className="text-muted-foreground"
                          style={{ fontSize: '0.8125rem' }}
                        >
                          Optimizing…
                        </p>
                      </div>
                    </div>
                  </ResultCardWrapper>
                );
              }

              if (file.status === 'error') {
                return (
                  <ResultCardWrapper key={file.id} index={index}>
                    <div
                      className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex items-center justify-between"
                    >
                      <div>
                        <p style={{ fontSize: '0.9375rem' }}>{file.name}</p>
                        <p
                          className="text-destructive"
                          style={{ fontSize: '0.8125rem' }}
                        >
                          {file.error || 'Processing failed'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </ResultCardWrapper>
                );
              }

              if (file.type === 'svg' && file.svgResult) {
                return (
                  <ResultCardWrapper key={file.id} index={index}>
                    <SVGResultCard
                      name={file.name}
                      result={file.svgResult}
                      onRemove={() => removeFile(file.id)}
                    />
                  </ResultCardWrapper>
                );
              }

              return (
                <ResultCardWrapper key={file.id} index={index}>
                  <ImageResultCard
                    file={file}
                    onRemove={() => removeFile(file.id)}
                    onUpdate={(updates) => updateFile(file.id, updates)}
                  />
                </ResultCardWrapper>
              );
            })}
          </div>
        )}

        {/* Empty state features */}
        {files.length === 0 && (
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-5">
            <div className="flex flex-col items-center text-center gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20">
                <FileCode2Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem' }}>SVG Optimizer</p>
                <p
                  className="mt-1 text-muted-foreground"
                  style={{ fontSize: '0.75rem' }}
                >
                  Strips metadata, simplifies paths, removes hidden layers
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-500/20">
                <MediaImage className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem' }}>JPG Compression</p>
                <p
                  className="mt-1 text-muted-foreground"
                  style={{ fontSize: '0.75rem' }}
                >
                  Quality-based lossy compression with EXIF preservation
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
                <MediaImage className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem' }}>PNG Compression</p>
                <p
                  className="mt-1 text-muted-foreground"
                  style={{ fontSize: '0.75rem' }}
                >
                  Lossy/lossless compression with quality control & resizing
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                <Sparks className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem' }}>GIF Compression</p>
                <p
                  className="mt-1 text-muted-foreground"
                  style={{ fontSize: '0.75rem' }}
                >
                  Reduces GIF file size via re-encoding and optional resizing
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}