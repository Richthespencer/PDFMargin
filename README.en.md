# PDFMargin

[中文](./README.md)

A browser-based PDF tool with two modes:

- `Margin`: add page margins, choose output paper size, live preview, and export
- `Organize`: merge multiple PDFs, drag to reorder pages, delete individual pages, and export in current order

All processing runs fully in the browser.

## Features

### Margin Mode

- Upload a single PDF
- Page range parsing supports `1-3,6,9-12`, `all/*`, `odd`, and `even`
- Per-side margin or uniform margin
- Output presets: `A4`, `A3`, `A5`, `Letter`, `Legal`, `Tabloid`, `Custom`
- Live preview (uses the smallest selected page number)
- Two export scopes:
  - All pages (apply margin only to selected pages)
  - Selected pages only
- Chinese/English UI toggle

### Organize Mode

- Upload multiple PDFs in one batch or multiple batches
- Expand to page-level cards laid out in a visual grid
- Card-level PDF page thumbnail preview
- Real-time drag reordering with slot-shift animation
- Remove individual pages
- Export merges exactly by current list order, with no margin transform

## Tech Stack

- Vite
- React + TypeScript
- pdf-lib (page copy/export)
- pdfjs-dist (preview and thumbnails)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Build output is in `dist/`.

## Tauri Desktop Packaging

Make sure Rust and platform build dependencies are installed first (for example, Xcode Command Line Tools on macOS).

```bash
# Desktop dev mode (runs Vite + Tauri)
npm run tauri:dev

# Build installer bundles
npm run tauri:build
```

Bundle outputs are generated under `src-tauri/target/release/bundle/`.

## Chrome Extension

```bash
# Build extension output
npm run build:extension

# Build and package zip for Chrome Web Store upload
npm run pack:extension
```

This generates `dist-extension/`, which can be loaded directly in Chrome Developer Mode:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `dist-extension/` in this project

Clicking the extension action opens PDFMargin in a new tab.

The packaged zip is generated at `release/pdfmargin-chrome-extension.zip`.

## Usage

1. Use the top mode switch: `Margin` or `Organize`.
2. In `Margin`, upload one PDF, configure size/margins/page range, then export.
3. In `Organize`, upload multiple PDFs, drag cards to reorder, remove pages, then export.

## Project Structure

- `src/main.tsx`: app bootstrap
- `src/App.tsx`: top-level mode switch (`Margin` / `Organize`)
- `src/MarginTool.tsx`: margin workflow
- `src/OrganizeTool.tsx`: merge/reorder/remove workflow
- `src/styles.css`: global styles
