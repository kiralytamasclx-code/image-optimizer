import React, { useCallback, useEffect, useState } from 'react';
import { Upload, Code as FileCode2, CodeBrackets as Code2, Xmark as X, NavArrowDown as ChevronDown, ClipboardCheck as Clipboard } from 'iconoir-react';
import { motion, AnimatePresence } from 'motion/react';
import { SmoothCollapse, PressableButton } from './animated';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  hasFiles?: boolean;
}

const ACCEPTED_TYPES = [
  'image/svg+xml',
  'image/png',
  'image/gif',
  'image/jpeg',
];

const ACCEPTED_EXTENSIONS = ['.svg', '.png', '.gif', '.jpg', '.jpeg'];

export function DropZone({ onFilesDropped, hasFiles = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [svgCode, setSvgCode] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [pasteFlash, setPasteFlash] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const accepted = Array.from(fileList).filter(
        (f) =>
          ACCEPTED_TYPES.includes(f.type) ||
          ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
      );
      if (accepted.length > 0) {
        onFilesDropped(accepted);
      }
    },
    [onFilesDropped]
  );

  const openFilePicker = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,.png,.gif,.jpg,.jpeg,image/svg+xml,image/png,image/gif,image/jpeg';
    input.multiple = true;
    input.style.display = 'none';
    input.onchange = () => {
      handleFiles(input.files);
      input.remove();
    };
    // Safari (and some others) won't open the dialog for a detached input,
    // so attach it to the document before clicking.
    document.body.appendChild(input);
    input.click();
  }, [handleFiles]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handlePasteSvg = useCallback(() => {
    const trimmed = svgCode.trim();
    if (!trimmed) return;
    if (!trimmed.includes('<svg')) {
      setPasteError('No <svg> element found in the pasted code.');
      return;
    }
    setPasteError('');
    const blob = new Blob([trimmed], { type: 'image/svg+xml' });
    const file = new File([blob], `pasted-svg-${Date.now()}.svg`, {
      type: 'image/svg+xml',
    });
    onFilesDropped([file]);
    setSvgCode('');
    setShowPaste(false);
  }, [svgCode, onFilesDropped]);

  // Global Ctrl+V / Cmd+V handler — processes clipboard images and SVG text
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Skip if user is typing in the textarea or another input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Check for image files first (screenshots, copied images)
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && ACCEPTED_TYPES.includes(item.type)) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        setPasteFlash(true);
        onFilesDropped(imageFiles);
        return;
      }

      // Check for SVG text
      const textItem = Array.from(items).find(
        (item) => item.kind === 'string' && item.type === 'text/plain'
      );
      if (textItem) {
        textItem.getAsString((text) => {
          const trimmed = text.trim();
          if (trimmed.includes('<svg')) {
            e.preventDefault();
            const blob = new Blob([trimmed], { type: 'image/svg+xml' });
            const file = new File([blob], `pasted-svg-${Date.now()}.svg`, {
              type: 'image/svg+xml',
            });
            setPasteFlash(true);
            onFilesDropped([file]);
          }
        });
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [onFilesDropped]);

  // Clear paste flash after animation
  useEffect(() => {
    if (!pasteFlash) return;
    const t = setTimeout(() => setPasteFlash(false), 800);
    return () => clearTimeout(t);
  }, [pasteFlash]);

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        layout
        className={`
          relative flex rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
          ${
            pasteFlash
              ? 'border-green-500 bg-green-500/5 scale-[1.01]'
              : isDragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
          }
          ${hasFiles ? 'flex-row items-center gap-4 p-4' : 'flex-col items-center justify-center gap-4 p-12'}
        `}
        onClick={openFilePicker}
        role="button"
        tabIndex={0}
        aria-label="Upload images. Drop files here, or press Enter to browse. SVG, PNG, GIF, and JPG are supported."
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFilePicker();
          }
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <motion.div
          layout
          className={`rounded-xl transition-colors ${
            isDragOver ? 'bg-primary/10' : 'bg-muted'
          } ${hasFiles ? 'p-2.5' : 'p-4'}`}
          animate={
            isDragOver
              ? { y: [0, -6, 0] }
              : { y: 0 }
          }
          transition={
            isDragOver
              ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDragOver ? (
              <motion.span
                key="drag"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex"
              >
                <FileCode2 className={hasFiles ? 'h-5 w-5 text-primary' : 'h-8 w-8 text-primary'} />
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex"
              >
                <Upload className={hasFiles ? 'h-5 w-5 text-muted-foreground' : 'h-8 w-8 text-muted-foreground'} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div layout className={hasFiles ? 'text-left' : 'text-center'}>
          <motion.p
            layout="position"
            className={pasteFlash ? 'text-green-600' : isDragOver ? 'text-primary' : 'text-foreground'}
            style={{ fontSize: hasFiles ? '0.875rem' : undefined }}
          >
            {pasteFlash
              ? 'Pasted!'
              : isDragOver
                ? 'Drop files here'
                : 'Drop images here or click to browse'}
          </motion.p>
          <motion.p
            layout="position"
            className="text-muted-foreground"
            style={{ fontSize: hasFiles ? '0.75rem' : '0.875rem', marginTop: hasFiles ? '0.125rem' : '0.25rem' }}
          >
            Supports multiple files • SVG, PNG, GIF, JPG •{' '}
            <span className="inline-flex items-center gap-0.5">
              <Clipboard className="inline h-3 w-3" />
              Ctrl+V to paste
            </span>
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Paste SVG toggle */}
      <button
        onClick={() => {
          setShowPaste((s) => !s);
          setPasteError('');
        }}
        className="mx-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        style={{ fontSize: '0.8125rem' }}
      >
        <Code2 className="h-3.5 w-3.5" />
        Paste SVG code
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${showPaste ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Paste SVG textarea */}
      <SmoothCollapse open={showPaste}>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              Paste SVG markup below
            </p>
            <button
              onClick={() => {
                setShowPaste(false);
                setSvgCode('');
                setPasteError('');
              }}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={svgCode}
            onChange={(e) => {
              setSvgCode(e.target.value);
              if (pasteError) setPasteError('');
            }}
            placeholder={'<svg xmlns="http://www.w3.org/2000/svg" ...>\n  ...\n</svg>'}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-y"
            style={{ fontSize: '0.8125rem', minHeight: 120, maxHeight: 320 }}
          />
          {pasteError && (
            <p className="text-red-500" style={{ fontSize: '0.8125rem' }}>
              {pasteError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <PressableButton
              onClick={handlePasteSvg}
              disabled={!svgCode.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: '0.8125rem' }}
            >
              <Code2 className="h-3.5 w-3.5" />
              Optimize SVG
            </PressableButton>
            <p className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
              The pasted code will be treated as a .svg file
            </p>
          </div>
        </div>
      </SmoothCollapse>
    </div>
  );
}