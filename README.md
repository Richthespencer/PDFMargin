# PDFMargin

[中文](./README.zh.md) · [Privacy Policy](./PRIVACY.md)

Chrome Web Store: https://chromewebstore.google.com/detail/pdfmargin/pcckkfncbpioipomonnfkoiinejeljip

PDFMargin is a local-first PDF app built around two practical workflows:

- `Margin`: fix print cutoff issues near page edges and output print-ready files
- `Organize`: reorder, rotate, remove, and combine pages across multiple PDFs

All processing runs locally in your browser/desktop runtime.

## Core Features

### Margin

- Output size supports `Original` (default) plus `A4/A3/A5/Letter/Legal/Tabloid/Custom`
- Uniform and per-side margins, including negative margin values
- Drag page content directly in Live Preview to fine-tune margins
- Download adjusted PDFs or print directly
- Page range syntax: `1-3,6,9-12`, `all/*`, `odd`, `even`
- Live preview supports page navigation and drag-and-drop PDF upload
- Download modes:
  - All pages (apply margins only to selected pages)
  - Selected pages only

### Organize

- Upload multiple PDFs in one or multiple batches
- Drag-and-drop upload is supported in the Page Wall area
- Visual page wall with thumbnails
- Drag-and-drop reorder (including moving to final position)
- Click-to-toggle multi-select and group drag
- Move selected pages to a target position (`Move to` with Before/After)
- 90° per-page rotation
- Two-step delete confirmation
- One-click clear all pages and undo last action
- Download PDF or print current organized result

### UX and Platforms

- Bilingual UI (Chinese/English, globally synced)
- Light/Dark theme toggle (default: light)
- Available for Web, Tauri desktop, and Chrome Extension

## Quick Start

```bash
npm install
npm run dev
```

## Common Commands

```bash
# Web
npm run build
npm run preview

# Tauri desktop
npm run tauri:dev
npm run tauri:build

# Chrome extension
npm run build:extension
npm run pack:extension
```

## Build Outputs

- Web build: `dist/`
- Tauri bundle: `src-tauri/target/release/bundle/`
- Extension unpacked: `dist-extension/`
- Extension zip: `release/pdfmargin-chrome-extension.zip`

## Load Extension Locally

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `dist-extension/`

## Project Structure

- `src/App.tsx`: global mode/language/theme switch
- `src/MarginTool.tsx`: margin workflow
- `src/OrganizeTool.tsx`: organize workflow
- `src/styles.css`: global + theming styles
- `src-tauri/`: desktop wrapper
- `extension/`: Chrome extension manifest and background script
