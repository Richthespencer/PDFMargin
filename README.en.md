# PDFMargin

[中文](./README.md) · [Privacy Policy](./PRIVACY.md)

PDFMargin is a local-first PDF tool focused on two practical workflows:

- `Margin`: fix print cutoff issues near page edges by adding safe margins
- `Organize`: reorder, merge, remove, and export pages across multiple PDFs

All processing runs locally in your browser/desktop runtime.

## Core Features

### Margin

- Output size supports `Original` (default) plus `A4/A3/A5/Letter/Legal/Tabloid/Custom`
- Uniform and per-side margins, including negative margin values
- Page range syntax: `1-3,6,9-12`, `all/*`, `odd`, `even`
- Live preview before export
- Export modes:
  - All pages (apply margins only to selected pages)
  - Selected pages only

### Organize

- Upload multiple PDFs in one or multiple batches
- Visual page wall with thumbnails
- Drag-and-drop reorder (including moving to final position)
- `Cmd/Ctrl + Click` multi-select with group drag
- Two-step delete confirmation
- Undo last action (reorder/delete)

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
