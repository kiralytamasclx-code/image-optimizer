# Image Optimizer

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE) [![Live demo](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://image-optimizer.tamaskiraly.com) [![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev) [![100% client-side](https://img.shields.io/badge/100%25-client--side-8B5CF6.svg)](#privacy)

![Image Optimizer](public/og.png)

A browser-based tool for optimizing SVGs, compressing JPG, PNG, and GIF images, and shrinking PDFs. Everything runs locally in the browser, so files are never uploaded to a server.

**Live:** https://image-optimizer.tamaskiraly.com

## What it does

Drop in one file or a few dozen. The app picks the right optimizer for each file type, shows the before and after sizes, and lets you download the results one by one or as a single ZIP.

- **SVG.** Removes editor leftovers (Inkscape and Sodipodi attributes, metadata, comments, empty groups, and `display:none` layers) and leaves alone anything referenced by `id`, sitting inside `<defs>`, or otherwise able to change how the file renders. It collapses whitespace in path data but never rounds coordinates, so curves stay exactly where the designer put them.
- **JPG.** Quality-based compression with an optional toggle to keep EXIF data. There is a quality-cascade fallback for Safari, whose canvas encoder sometimes ignores the quality value.
- **PNG.** Lossy or lossless compression, plus an optional maximum width or height for downscaling.
- **GIF.** Animated files are re-encoded frame by frame; static ones are converted to PNG. Resizing is optional.
- **PDF.** Two modes. **Text-safe** (the default, powered by MuPDF compiled to WebAssembly) re-encodes embedded images to JPEG and cleans up the file — re-tokenizing content streams, de-duplicating and pruning objects — while never touching the text or font layer, so selectable text always survives (including the Type3 fonts that design tools export, which most re-distillers quietly break). **Maximum** (Ghostscript) re-distills for the smallest possible size but can strip selectable text on some PDFs, so it is strictly opt-in. A quality control (Smaller / Balanced / Higher quality) sets the image JPEG quality in text-safe mode and the image DPI in maximum mode.

A few other things worth knowing:

- Add files by dragging them in, clicking to browse, or pasting from the clipboard (Ctrl/Cmd+V). SVG can also be pasted as raw code.
- Any raster image can be converted to WebP or AVIF instead of keeping its original format.
- It processes files in parallel and shows running totals: file count by type, original size, optimized size, and how much you saved.
- It won't hand back a file that came out larger than the original, unless you asked it to change the format or the dimensions.
- Light and dark themes, remembered between visits.

## How it works

Everything runs on the client. There is no server round-trip; the same code that ships to the browser does the optimizing.

- **SVG** is parsed into a DOM and cleaned conservatively. It strips comments, XML and doctype declarations, metadata, and editor namespaces (Inkscape, Sodipodi, RDF), drops `display:none` layers, and removes empty groups. It deliberately does not round path coordinates, and never removes anything referenced by `id` or living inside `<defs>`, so the rendered result matches the input.
- **JPG and PNG** go through `browser-image-compression` first, with a Canvas fallback (`createImageBitmap` plus `toDataURL`) for the cases that need it, including a quality cascade for older Safari. The tool won't hand back a file larger than the original unless you changed the format or the dimensions.
- **AVIF** is encoded with libavif compiled to WebAssembly (the same encoder Squoosh uses). The encoder and its WASM load on demand the first time you choose AVIF, so they never weigh down the initial page load.
- **Animated GIF** is decoded frame by frame, optionally resized, then re-encoded with a reduced palette. That code is split into its own chunk and only fetched when you drop a GIF.
- **PDF** is compressed inside a Web Worker. The default text-safe engine is MuPDF compiled to WebAssembly (~10 MB): it decodes each embedded image (any colorspace) and re-encodes it as JPEG, then rewrites the file with `sanitize` + garbage collection — leaving fonts, text, and vectors byte-for-byte, so selectable text is preserved. The opt-in Maximum mode uses Ghostscript (~16 MB). Both engines load on demand the first time you add a PDF, so neither touches the initial page load, and a never-larger fallback returns the original if compression would not shrink it.

## Privacy

There is no backend. Files are read, compressed, and downloaded entirely on the client: images via the Canvas API and `browser-image-compression`, GIFs via small re-encoding libraries, and PDFs via MuPDF (default) or Ghostscript (opt-in) compiled to WebAssembly. Nothing is uploaded, and the optimizing itself needs no network connection.

## Browser support

Built for current evergreen browsers (recent Chrome, Edge, Firefox, and Safari). The image pipeline relies on the Canvas API, and both AVIF encoding and PDF compression run as WebAssembly that loads on demand, so very old browsers are out of scope. The build targets ES2022 (the PDF engine uses top-level await), which needs Chrome 89+, Safari 15+, Firefox 89+, or Edge 89+. Safari's canvas encoder, which sometimes ignores the requested quality, is handled with a quality-cascade fallback.

## Tech stack

- React 18 and TypeScript
- Vite 6
- Tailwind CSS v4
- Motion for animations, Iconoir for icons
- `browser-image-compression` and `@jsquash/avif` (WASM) for raster encoding, `gifenc` + `gifuct-js` for animated GIFs, `mupdf` (WASM, default) and `@jspawn/ghostscript-wasm` (WASM, opt-in) for PDF compression, `jszip` for the bulk download

## Getting started

Requires Node 18 or newer.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173 by default)
npm run build    # production build into dist/
npm run preview  # serve the built output locally
```

## Project structure

```
src/
  main.tsx                       # entry point
  app/
    App.tsx                      # state, file handling, layout
    components/
      drop-zone.tsx              # drag/drop, browse, paste
      svg-optimizer.ts           # SVG parsing and cleanup
      image-optimizer.ts         # JPG/PNG/WebP compression (Canvas + browser-image-compression)
      gif-optimizer.ts           # animated GIF re-encoding
      compression-settings.tsx   # quality, resize, and format controls
      svg-result-card.tsx        # per-file before/after UI
      image-result-card.tsx
      pdf-optimizer.ts           # routes to the PDF worker by mode, never-larger fallback
      pdf-worker-mupdf.ts        # text-safe default: MuPDF WASM (image re-encode + sanitize)
      pdf-worker.ts              # opt-in "Maximum": Ghostscript WASM re-distill
      pdf-result-card.tsx
  styles/                        # Tailwind entry and theme tokens
public/                          # favicon, social image, sample files
```

## Deployment

Hosted on Vercel with the GitHub repo connected, so every push to `main` builds and deploys on its own. To trigger a production deploy by hand:

```bash
vercel deploy --prod
```

## Licensing

The image, SVG, and GIF features use permissively-licensed libraries (MIT / Apache-2.0). PDF compression uses **MuPDF** (default) and **Ghostscript** (opt-in), both **AGPL-3.0**, and because the app ships and runs them (as WebAssembly) in the user's browser, the project as a whole is distributed under the **GNU AGPL-3.0**. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

If you fork this and deploy it, the AGPL requires you to keep your source public and offer it to your users. If you would rather avoid that obligation, remove both PDF engines (the MuPDF and Ghostscript workers) and the remaining image/SVG/GIF code can be relicensed permissively.

## Author

Built by Tamás Király (Tommy K). See [tamaskiraly.com](https://tamaskiraly.com). Personal project.
