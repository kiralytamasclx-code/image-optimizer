import { Download, Trash as Trash2, ArrowRight } from 'iconoir-react';
import { formatBytes } from './svg-optimizer';
import type { ProcessedFile } from './types';
import { getFileTypeBadgeColor } from './types';
import { SavingsBadge, PressableButton } from './animated';
import { downloadUrl } from './download';

interface PdfResultCardProps {
  file: ProcessedFile;
  onRemove: () => void;
}

export function PdfResultCard({ file, onRemove }: PdfResultCardProps) {
  const handleDownload = () => {
    if (!file.optimizedUrl) return;
    downloadUrl(file.optimizedUrl, file.name.replace(/\.pdf$/i, '') + '.compressed.pdf');
  };

  const savingsColor =
    (file.savingsPercent || 0) > 20
      ? 'text-green-600'
      : (file.savingsPercent || 0) > 5
        ? 'text-amber-600'
        : 'text-muted-foreground';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 ${getFileTypeBadgeColor('pdf')}`}
            style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.03em' }}
          >
            PDF
          </span>
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
              <span className={savingsColor}>{formatBytes(file.optimizedSize || 0)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
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

      {/* Stats */}
      <div className="flex items-center gap-6 px-5 py-3 bg-muted/30">
        <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: '0.8125rem' }}>
          <SavingsBadge className={savingsColor} style={{ fontWeight: 600 }}>
            {(file.savingsPercent || 0) > 0
              ? `-${file.savingsPercent!.toFixed(1)}%`
              : 'No change'}
          </SavingsBadge>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Download className="h-3.5 w-3.5" />
            {formatBytes(file.savings || 0)} saved
          </span>
        </div>
      </div>
    </div>
  );
}
