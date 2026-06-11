import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Xmark as X,
  ArrowRight,
  RefreshDouble as Loader2,
  Expand as Maximize2,
  Settings as Settings2,
  Undo as RotateCcw,
  Check,
  ZoomIn,
  ZoomOut,
} from 'iconoir-react';
import { formatBytes } from './svg-optimizer';
import { optimizeImage } from './image-optimizer';
import type { ImageCompressionOptions, FileType } from './types';
import { DEFAULT_OPTIONS, getFileTypeLabel, getFileTypeBadgeColor } from './types';
import { PressableButton } from './animated';

interface CompareModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  fileType: FileType;
  originalUrl: string;
  optimizedUrl: string;
  originalSize: number;
  optimizedSize: number;
  savingsPercent: number;
  originalDimensions?: { width: number; height: number };
  optimizedDimensions?: { width: number; height: number };
  originalFile?: File;
  initialOptions?: ImageCompressionOptions;
  onApply?: (result: {
    optimizedBlob: Blob;
    optimizedUrl: string;
    optimizedSize: number;
    savings: number;
    savingsPercent: number;
    optimizedDimensions: { width: number; height: number };
    options: ImageCompressionOptions;
  }) => void;
}

const CHECKER_BG =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect width=\'16\' height=\'16\' fill=\'white\'/%3E%3Crect width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23f0f0f0\'/%3E%3C/svg%3E")';

const ZOOM_MAX = 8;
const ZOOM_PRESETS = [1, 2, 4, 8]; // native-pixel multiples

export function CompareModal({
  open,
  onClose,
  name,
  fileType,
  originalUrl: initialOriginalUrl,
  optimizedUrl: initialOptimizedUrl,
  originalSize,
  optimizedSize: initialOptimizedSize,
  savingsPercent: initialSavingsPercent,
  originalDimensions,
  optimizedDimensions: initialOptimizedDimensions,
  originalFile,
  initialOptions,
  onApply,
}: CompareModalProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Image natural size & container size
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Zoom: 'fit' or a scale number (1 = native pixels, 2 = 2x native, etc.)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Settings state for PNG/GIF
  const canReprocess = fileType !== 'svg' && !!originalFile;
  const [options, setOptions] = useState<ImageCompressionOptions>(
    initialOptions || DEFAULT_OPTIONS
  );
  const [showSettings, setShowSettings] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // Current optimized state
  const [currentOptimizedUrl, setCurrentOptimizedUrl] = useState(initialOptimizedUrl);
  const [currentOptimizedSize, setCurrentOptimizedSize] = useState(initialOptimizedSize);
  const [currentSavingsPercent, setCurrentSavingsPercent] = useState(initialSavingsPercent);
  const [currentOptimizedDimensions, setCurrentOptimizedDimensions] = useState(
    initialOptimizedDimensions
  );
  const [currentOptimizedBlob, setCurrentOptimizedBlob] = useState<Blob | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const internalUrlsRef = useRef<string[]>([]);

  // ───── Derived zoom values ─────
  const fitScale = useMemo(() => {
    if (imgNatural.w === 0 || containerSize.w === 0) return 1;
    return Math.min(containerSize.w / imgNatural.w, containerSize.h / imgNatural.h);
  }, [imgNatural, containerSize]);

  const effectiveScale = zoomMode === 'fit' ? fitScale : zoomMode;

  const renderedW = imgNatural.w * effectiveScale;
  const renderedH = imgNatural.h * effectiveScale;

  // Pan limits: allow reaching every edge of the image
  const maxPanX = Math.max(0, (renderedW - containerSize.w) / 2);
  const maxPanY = Math.max(0, (renderedH - containerSize.h) / 2);

  const clampPan = useCallback(
    (px: number, py: number, scale?: number) => {
      const s = scale ?? effectiveScale;
      const rw = imgNatural.w * s;
      const rh = imgNatural.h * s;
      const mx = Math.max(0, (rw - containerSize.w) / 2);
      const my = Math.max(0, (rh - containerSize.h) / 2);
      return {
        x: Math.max(-mx, Math.min(mx, px)),
        y: Math.max(-my, Math.min(my, py)),
      };
    },
    [imgNatural, containerSize, effectiveScale]
  );

  // ───── Container resize observer ─────
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // ───── Load natural image dimensions ─────
  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0) {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  // ───── Reset state when modal opens ─────
  useEffect(() => {
    if (open) {
      setCurrentOptimizedUrl(initialOptimizedUrl);
      setCurrentOptimizedSize(initialOptimizedSize);
      setCurrentSavingsPercent(initialSavingsPercent);
      setCurrentOptimizedDimensions(initialOptimizedDimensions);
      setCurrentOptimizedBlob(null);
      setHasChanges(false);
      setSliderPos(50);
      setOptions(initialOptions || DEFAULT_OPTIONS);
      setShowSettings(false);
      setZoomMode('fit');
      setPan({ x: 0, y: 0 });
      setImgNatural({ w: 0, h: 0 });
    }
    return () => {
      internalUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      internalUrlsRef.current = [];
    };
  }, [open, initialOriginalUrl, initialOptimizedUrl, initialOptimizedSize, initialSavingsPercent, initialOptimizedDimensions, initialOptions]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ───── Zoom handlers ─────
  const setZoomAndClampPan = useCallback(
    (nextScale: number | 'fit') => {
      if (nextScale === 'fit') {
        setZoomMode('fit');
        setPan({ x: 0, y: 0 });
        return;
      }
      setZoomMode(nextScale);
      setPan((p) => {
        const rw = imgNatural.w * nextScale;
        const rh = imgNatural.h * nextScale;
        const mx = Math.max(0, (rw - containerSize.w) / 2);
        const my = Math.max(0, (rh - containerSize.h) / 2);
        return {
          x: Math.max(-mx, Math.min(mx, p.x)),
          y: Math.max(-my, Math.min(my, p.y)),
        };
      });
    },
    [imgNatural, containerSize]
  );

  const handleZoomIn = useCallback(() => {
    const current = zoomMode === 'fit' ? fitScale : zoomMode;
    const next = Math.min(ZOOM_MAX, current * 1.25);
    if (next <= fitScale * 1.01) {
      setZoomAndClampPan('fit');
    } else {
      setZoomAndClampPan(next);
    }
  }, [zoomMode, fitScale, setZoomAndClampPan]);

  const handleZoomOut = useCallback(() => {
    const current = zoomMode === 'fit' ? fitScale : zoomMode;
    const next = current / 1.25;
    if (next <= fitScale * 1.01) {
      setZoomAndClampPan('fit');
    } else {
      setZoomAndClampPan(next);
    }
  }, [zoomMode, fitScale, setZoomAndClampPan]);

  const handleZoomReset = useCallback(() => {
    setZoomAndClampPan('fit');
  }, [setZoomAndClampPan]);

  // Mouse wheel zoom (centered on cursor)
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15;

      setZoomMode((prev) => {
        const currentScale = prev === 'fit' ? fitScale : prev;
        const nextScale = Math.max(fitScale * 0.99, Math.min(ZOOM_MAX, currentScale * factor));

        if (nextScale <= fitScale * 1.01) {
          setPan({ x: 0, y: 0 });
          return 'fit';
        }

        // Zoom toward cursor
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const ratio = nextScale / currentScale;

        setPan((prevPan) => {
          const newX = cx - ratio * (cx - prevPan.x);
          const newY = cy - ratio * (cy - prevPan.y);
          const rw = imgNatural.w * nextScale;
          const rh = imgNatural.h * nextScale;
          const mx = Math.max(0, (rw - rect.width) / 2);
          const my = Math.max(0, (rh - rect.height) / 2);
          return {
            x: Math.max(-mx, Math.min(mx, newX)),
            y: Math.max(-my, Math.min(my, newY)),
          };
        });

        return nextScale;
      });
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [open, fitScale, imgNatural]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); handleZoomIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); handleZoomOut(); }
      else if (e.key === '0') { e.preventDefault(); handleZoomReset(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleZoomIn, handleZoomOut, handleZoomReset]);

  // ───── Slider drag logic ─────
  const updateSlider = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(pct);
    },
    []
  );

  // Container mouse down: pan when zoomed past fit, otherwise move slider
  const isZoomed = zoomMode !== 'fit' && effectiveScale > fitScale * 1.01;

  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isZoomed) {
        setPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      } else {
        setDragging(true);
        updateSlider(e.clientX);
      }
    },
    [isZoomed, pan, updateSlider]
  );

  // Slider handle: always controls the slider
  const handleSliderHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      updateSlider(e.clientX);
    },
    [updateSlider]
  );

  // Slider drag move/up
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => updateSlider(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, updateSlider]);

  // Pan move/up
  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan(clampPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy));
    };
    const onUp = () => setPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning, clampPan]);

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isZoomed) {
        setPanning(true);
        const t = e.touches[0];
        panStartRef.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y };
      } else {
        setDragging(true);
        updateSlider(e.touches[0].clientX);
      }
    },
    [isZoomed, pan, updateSlider]
  );

  useEffect(() => {
    if (!dragging) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updateSlider(e.touches[0].clientX);
    };
    const onTouchEnd = () => setDragging(false);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragging, updateSlider]);

  useEffect(() => {
    if (!panning) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - panStartRef.current.x;
      const dy = t.clientY - panStartRef.current.y;
      setPan(clampPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy));
    };
    const onTouchEnd = () => setPanning(false);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [panning, clampPan]);

  // ───── Re-process handler ─────
  const handleReprocess = useCallback(async () => {
    if (!originalFile) return;
    setReprocessing(true);
    try {
      const result = await optimizeImage(originalFile, options);
      const newUrl = URL.createObjectURL(result.optimizedBlob);
      internalUrlsRef.current.push(newUrl);
      setCurrentOptimizedUrl(newUrl);
      setCurrentOptimizedSize(result.optimizedSize);
      setCurrentSavingsPercent(result.savingsPercent);
      setCurrentOptimizedDimensions(result.optimizedDimensions);
      setCurrentOptimizedBlob(result.optimizedBlob);
      setHasChanges(true);
    } catch {
      // silently fail
    } finally {
      setReprocessing(false);
    }
  }, [originalFile, options]);

  // Apply handler
  const handleApply = useCallback(() => {
    if (!hasChanges || !currentOptimizedBlob || !onApply) return;
    onApply({
      optimizedBlob: currentOptimizedBlob,
      optimizedUrl: currentOptimizedUrl,
      optimizedSize: currentOptimizedSize,
      savings: originalSize - currentOptimizedSize,
      savingsPercent: currentSavingsPercent,
      optimizedDimensions: currentOptimizedDimensions || { width: 0, height: 0 },
      options,
    });
    setHasChanges(false);
    onClose();
  }, [
    hasChanges, currentOptimizedBlob, currentOptimizedUrl, currentOptimizedSize,
    currentSavingsPercent, currentOptimizedDimensions, originalSize, options, onApply, onClose,
  ]);

  const savingsColor =
    currentSavingsPercent > 20
      ? 'text-green-600'
      : currentSavingsPercent > 5
        ? 'text-amber-600'
        : 'text-muted-foreground';

  const qualityLabel =
    options.quality >= 0.9 ? 'Maximum'
      : options.quality >= 0.7 ? 'High'
        : options.quality >= 0.5 ? 'Medium'
          : 'Low';

  const maxDimPresets = [0, 512, 1024, 1920, 2560, 3840];

  // ───── Image positioning (no object-contain, manual size + translate) ─────
  const smoothTransition = panning || dragging ? 'none' : 'width 0.2s ease-out, height 0.2s ease-out, transform 0.2s ease-out';

  const imageStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: renderedW || '100%',
    height: renderedH || '100%',
    maxWidth: 'none',
    maxHeight: 'none',
    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
    transition: smoothTransition,
    ...(imgNatural.w === 0 && { objectFit: 'contain' as const, width: '100%', height: '100%' }),
  };

  const containerCursor = dragging
    ? 'col-resize'
    : panning
      ? 'grabbing'
      : isZoomed
        ? 'grab'
        : 'default';

  // Zoom percentage display
  const zoomPercent = Math.round(effectiveScale * 100);

  // Check if a preset is active
  const isPresetActive = (level: number) =>
    typeof zoomMode === 'number' && Math.abs(zoomMode - level) < 0.01;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 ${getFileTypeBadgeColor(fileType)}`}
            style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.03em' }}
          >
            {getFileTypeLabel(fileType)}
          </span>
          <p className="truncate" style={{ fontSize: '0.9375rem' }}>
            {name}
          </p>
          <div
            className="flex items-center gap-2 text-muted-foreground shrink-0"
            style={{ fontSize: '0.8125rem' }}
          >
            <span>{formatBytes(originalSize)}</span>
            <ArrowRight className="h-3 w-3" />
            <span className={savingsColor}>{formatBytes(currentOptimizedSize)}</span>
            <span className={savingsColor} style={{ fontWeight: 600 }}>
              {currentSavingsPercent > 0 ? `(-${currentSavingsPercent.toFixed(1)}%)` : ''}
            </span>
          </div>
          {originalDimensions && (
            <span
              className="flex items-center gap-1 text-muted-foreground shrink-0"
              style={{ fontSize: '0.75rem' }}
            >
              <Maximize2 className="h-3 w-3" />
              {originalDimensions.width}&times;{originalDimensions.height}
              {currentOptimizedDimensions &&
                (currentOptimizedDimensions.width !== originalDimensions.width ||
                  currentOptimizedDimensions.height !== originalDimensions.height) && (
                  <>
                    {' \u2192 '}
                    {currentOptimizedDimensions.width}&times;{currentOptimizedDimensions.height}
                  </>
                )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canReprocess && (
            <PressableButton
              onClick={() => setShowSettings((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                showSettings
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              style={{ fontSize: '0.8125rem' }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </PressableButton>
          )}
          {hasChanges && onApply && (
            <PressableButton
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-white hover:bg-green-700 transition-colors"
              style={{ fontSize: '0.8125rem' }}
            >
              <Check className="h-3.5 w-3.5" />
              Apply &amp; Close
            </PressableButton>
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel (collapsible) */}
      {canReprocess && showSettings && (
        <div className="bg-card border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-end gap-6 flex-wrap">
            <div className="min-w-[200px]">
              <div className="flex items-center justify-between mb-1.5">
                <label style={{ fontSize: '0.8125rem', fontWeight: 500 }} className="text-foreground">
                  Quality
                </label>
                <span className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                  {Math.round(options.quality * 100)}% &mdash; {qualityLabel}
                </span>
              </div>
              <input
                type="range" min={10} max={100} step={5}
                value={Math.round(options.quality * 100)}
                onChange={(e) => setOptions((o) => ({ ...o, quality: parseInt(e.target.value) / 100 }))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
            <div>
              <label className="text-foreground block mb-1.5" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                Max Dimension
              </label>
              <div className="flex flex-wrap gap-1">
                {maxDimPresets.map((dim) => (
                  <button
                    key={dim}
                    onClick={() => setOptions((o) => ({ ...o, maxWidthOrHeight: dim }))}
                    className={`rounded-md px-2 py-1 transition-colors ${
                      options.maxWidthOrHeight === dim
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {dim === 0 ? 'Original' : `${dim}px`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={options.convertToWebP}
                  onChange={(e) => setOptions((o) => ({ ...o, convertToWebP: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <span className="text-foreground" style={{ fontSize: '0.8125rem' }}>WebP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={options.preserveExif}
                  onChange={(e) => setOptions((o) => ({ ...o, preserveExif: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <span className="text-foreground" style={{ fontSize: '0.8125rem' }}>EXIF</span>
              </label>
            </div>
            <PressableButton
              onClick={handleReprocess} disabled={reprocessing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              style={{ fontSize: '0.8125rem' }}
            >
              {reprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {reprocessing ? 'Processing\u2026' : 'Re-optimize'}
            </PressableButton>
          </div>
        </div>
      )}

      {/* ═══════ Compare Viewport ═══════ */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div
          ref={containerRef}
          className="relative w-full h-full max-w-[1200px] max-h-[800px] rounded-xl overflow-hidden select-none bg-white dark:bg-neutral-900"
          style={{ backgroundImage: CHECKER_BG, cursor: containerCursor }}
          onMouseDown={handleContainerMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Original (full, underneath) */}
          <img
            src={initialOriginalUrl}
            alt="Original"
            className="pointer-events-none"
            style={imageStyle}
            draggable={false}
            onLoad={handleImgLoad}
          />

          {/* Optimized (clipped by slider) */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
          >
            <img
              src={currentOptimizedUrl}
              alt="Optimized"
              className="pointer-events-none"
              style={imageStyle}
              draggable={false}
            />
          </div>

          {/* Slider line + handle */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
          >
            <div
              className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]"
              style={{ left: '50%', transform: 'translateX(-50%)' }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg border-2 border-white/80 pointer-events-auto cursor-col-resize"
              onMouseDown={handleSliderHandleMouseDown}
              onTouchStart={(e) => {
                e.stopPropagation();
                setDragging(true);
                updateSlider(e.touches[0].clientX);
              }}
            >
              <div className="flex items-center gap-0.5">
                <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
                  <path d="M4.5 1L1.5 7L4.5 13" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
                  <path d="M1.5 1L4.5 7L1.5 13" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Labels */}
          <div
            className="absolute top-4 left-4 rounded-md bg-black/60 px-2.5 py-1 text-white pointer-events-none"
            style={{ fontSize: '0.75rem', fontWeight: 500 }}
          >
            Original &mdash; {formatBytes(originalSize)}
          </div>
          <div
            className="absolute top-4 right-4 rounded-md bg-black/60 px-2.5 py-1 text-white pointer-events-none"
            style={{ fontSize: '0.75rem', fontWeight: 500 }}
          >
            Optimized &mdash; {formatBytes(currentOptimizedSize)}
          </div>

          {/* ─── Zoom Controls (floating bottom-right) ─── */}
          <div
            className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-sm p-1 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleZoomOut}
              disabled={zoomMode === 'fit'}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            {/* Preset buttons */}
            <div className="flex items-center gap-0.5 px-0.5">
              {ZOOM_PRESETS.map((level) => (
                <button
                  key={level}
                  onClick={() => setZoomAndClampPan(level)}
                  className={`rounded-md px-1.5 py-0.5 transition-colors ${
                    isPresetActive(level)
                      ? 'bg-white/25 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  style={{ fontSize: '0.6875rem', fontWeight: 500, minWidth: '1.75rem', textAlign: 'center' }}
                >
                  {level}x
                </button>
              ))}
            </div>

            <button
              onClick={handleZoomIn}
              disabled={effectiveScale >= ZOOM_MAX}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom in (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {/* Fit button */}
            <div className="border-l border-white/20 ml-0.5 pl-1">
              <button
                onClick={handleZoomReset}
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  zoomMode === 'fit'
                    ? 'bg-white/25 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                style={{ fontSize: '0.6875rem', fontWeight: 500 }}
                title="Fit to window (0)"
              >
                Fit
              </button>
            </div>
          </div>

          {/* Zoom level indicator (bottom-left) */}
          <div
            className="absolute bottom-4 left-4 rounded-md bg-black/60 px-2.5 py-1 text-white/80 pointer-events-none"
            style={{ fontSize: '0.75rem', fontWeight: 500 }}
          >
            {zoomPercent}%
            {isZoomed && <span className="text-white/40 ml-1.5">Drag to pan</span>}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="text-center pb-4 shrink-0">
        <p className="text-white/50" style={{ fontSize: '0.75rem' }}>
          Drag the slider to compare &bull; Scroll to zoom &bull; +/&minus; keys to zoom &bull; 0 to fit
          {canReprocess && ' \u2022 Use Settings to adjust and re-optimize in real time'}
        </p>
      </div>
    </div>
  );
}