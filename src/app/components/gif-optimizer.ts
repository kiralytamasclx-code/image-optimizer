/**
 * Animated GIF optimizer
 *
 * Decodes an animated GIF frame-by-frame with gifuct-js,
 * optionally resizes each frame on a canvas, then re-encodes
 * with gifenc using a reduced color palette controlled by
 * the quality setting.
 */

import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface GifOptimizeOptions {
  /** 0–1, maps to palette size: 1.0 → 256 colors, 0.5 → 64, etc. */
  quality: number;
  /** Max width or height in px; 0 = keep original dimensions */
  maxWidthOrHeight: number;
}

export interface GifOptimizeResult {
  blob: Blob;
  width: number;
  height: number;
}

export async function optimizeAnimatedGif(
  file: File | Blob,
  options: GifOptimizeOptions
): Promise<GifOptimizeResult> {
  const buffer = await file.arrayBuffer();
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true); // true = build full RGBA patches

  if (frames.length === 0) {
    throw new Error('No frames found in GIF');
  }

  // Source dimensions from the logical screen descriptor
  const srcWidth = gif.lsd.width;
  const srcHeight = gif.lsd.height;

  // Calculate output dimensions
  let outWidth = srcWidth;
  let outHeight = srcHeight;

  if (options.maxWidthOrHeight > 0) {
    const max = options.maxWidthOrHeight;
    if (srcWidth > max || srcHeight > max) {
      const ratio = Math.min(max / srcWidth, max / srcHeight);
      outWidth = Math.round(srcWidth * ratio);
      outHeight = Math.round(srcHeight * ratio);
    }
  }

  // Map quality (0–1) to palette size (8–256)
  // quality 1.0 → 256, quality 0.5 → 128, quality 0.1 → 32, minimum 8
  const maxColors = Math.max(8, Math.min(256, Math.round(256 * options.quality)));

  // We need two canvases:
  //  - compositeCanvas: accumulates frames respecting disposal methods (at source resolution)
  //  - resizeCanvas: optional downscaled output
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = srcWidth;
  compositeCanvas.height = srcHeight;
  const compositeCtx = compositeCanvas.getContext('2d')!;

  let resizeCanvas: HTMLCanvasElement | null = null;
  let resizeCtx: CanvasRenderingContext2D | null = null;
  const needsResize = outWidth !== srcWidth || outHeight !== srcHeight;

  if (needsResize) {
    resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = outWidth;
    resizeCanvas.height = outHeight;
    resizeCtx = resizeCanvas.getContext('2d')!;
  }

  // Create GIF encoder
  const encoder = GIFEncoder();

  // Keep a snapshot for disposal method "restore to previous"
  let previousImageData: ImageData | null = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const { dims, delay, disposalType } = frame;
    const { width: fw, height: fh, left: fx, top: fy } = dims;

    // Save state before drawing this frame if disposal is "restore to previous" (3)
    if (disposalType === 3) {
      previousImageData = compositeCtx.getImageData(0, 0, srcWidth, srcHeight);
    }

    // Draw frame patch onto the composite canvas
    const patchData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      fw,
      fh
    );
    // Use a temporary canvas for the patch to handle transparency
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = fw;
    patchCanvas.height = fh;
    const patchCtx = patchCanvas.getContext('2d')!;
    patchCtx.putImageData(patchData, 0, 0);

    compositeCtx.drawImage(patchCanvas, fx, fy);

    // Get the full composite frame as RGBA
    let outputCanvas: HTMLCanvasElement;
    if (needsResize && resizeCanvas && resizeCtx) {
      resizeCtx.clearRect(0, 0, outWidth, outHeight);
      resizeCtx.drawImage(compositeCanvas, 0, 0, outWidth, outHeight);
      outputCanvas = resizeCanvas;
    } else {
      outputCanvas = compositeCanvas;
    }

    const imgData = (needsResize ? resizeCtx! : compositeCtx).getImageData(
      0,
      0,
      outWidth,
      outHeight
    );
    const rgba = imgData.data;

    // Quantize and apply palette
    const palette = quantize(rgba, maxColors);
    const indexed = applyPalette(rgba, palette);

    // Detect if frame has any transparent pixels
    let hasTransparency = false;
    for (let p = 3; p < rgba.length; p += 4) {
      if (rgba[p] < 128) {
        hasTransparency = true;
        break;
      }
    }

    // Delay is in centiseconds for GIF; gifuct-js gives it in ms
    const delayCentiseconds = Math.max(2, Math.round((delay || 100) / 10));

    encoder.writeFrame(indexed, outWidth, outHeight, {
      palette,
      delay: delayCentiseconds,
      transparent: hasTransparency,
      dispose: disposalType === 2 ? 2 : 0,
    });

    // Handle disposal AFTER encoding the frame
    if (disposalType === 2) {
      // Restore to background — clear the frame area
      compositeCtx.clearRect(fx, fy, fw, fh);
    } else if (disposalType === 3 && previousImageData) {
      // Restore to previous
      compositeCtx.putImageData(previousImageData, 0, 0);
    }
    // disposalType 0 or 1: leave as-is (do nothing)
  }

  encoder.finish();

  const bytes = encoder.bytes();
  const blob = new Blob([bytes], { type: 'image/gif' });

  return { blob, width: outWidth, height: outHeight };
}
