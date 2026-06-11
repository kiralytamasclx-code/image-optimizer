import React, { useState } from 'react';
import { Settings as Settings2, NavArrowDown as ChevronDown } from 'iconoir-react';
import type { ImageCompressionOptions } from './types';
import { SmoothCollapse } from './animated';

interface CompressionSettingsProps {
  options: ImageCompressionOptions;
  onChange: (options: ImageCompressionOptions) => void;
}

export function CompressionSettings({ options, onChange }: CompressionSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<ImageCompressionOptions>) =>
    onChange({ ...options, ...partial });

  const qualityLabel =
    options.quality >= 0.9
      ? 'Maximum'
      : options.quality >= 0.7
        ? 'High'
        : options.quality >= 0.5
          ? 'Medium'
          : 'Low';

  const maxDimPresets = [0, 512, 1024, 1920, 2560, 3840];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <p style={{ fontSize: '0.875rem' }}>Default Compression Settings</p>
          <span
            className="text-muted-foreground"
            style={{ fontSize: '0.75rem' }}
          >
            — applied automatically when new JPG, PNG & GIF files are added
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <SmoothCollapse open={expanded}>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-border">
          {/* Quality Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                style={{ fontSize: '0.8125rem', fontWeight: 500 }}
                className="text-foreground"
              >
                Quality
              </label>
              <span
                className="text-muted-foreground"
                style={{ fontSize: '0.75rem' }}
              >
                {Math.round(options.quality * 100)}% — {qualityLabel}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(options.quality * 100)}
              onChange={(e) => update({ quality: parseInt(e.target.value) / 100 })}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
            />
            <div
              className="flex justify-between text-muted-foreground mt-1"
              style={{ fontSize: '0.6875rem' }}
            >
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>

          {/* Max Dimensions */}
          <div>
            <label
              className="text-foreground block mb-2"
              style={{ fontSize: '0.8125rem', fontWeight: 500 }}
            >
              Max Dimension
            </label>
            <div className="flex flex-wrap gap-1.5">
              {maxDimPresets.map((dim) => (
                <button
                  key={dim}
                  onClick={() => update({ maxWidthOrHeight: dim })}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
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

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <label
              className="text-foreground block"
              style={{ fontSize: '0.8125rem', fontWeight: 500 }}
            >
              Options
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={options.convertToWebP}
                onChange={(e) => update({ convertToWebP: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-foreground" style={{ fontSize: '0.8125rem' }}>
                Convert to WebP
              </span>
              <span
                className="text-muted-foreground"
                style={{ fontSize: '0.6875rem' }}
              >
                (smaller files)
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={options.preserveExif}
                onChange={(e) => update({ preserveExif: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-foreground" style={{ fontSize: '0.8125rem' }}>
                Preserve EXIF data
              </span>
            </label>
          </div>
        </div>
      </SmoothCollapse>
    </div>
  );
}