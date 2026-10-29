# PDFMargin

[中文](./README.zh.md) · [Privacy Policy](./PRIVACY.md)

Chrome Web Store: https://chromewebstore.google.com/detail/pdfmargin/pcckkfncbpioipomonnfkoiinejeljip

Live site: https://richthespencer.github.io/PDFMargin/

PDFMargin is a local-first PDF app built around three practical workflows:

- `Margin`: fix print cutoff issues near page edges and output print-ready files
- `Organize`: reorder, rotate, remove, and combine pages across multiple PDFs
- `Compress`: reduce PDF file size while preserving clarity and searchable text

All processing runs locally in your browser.

## Core Features

### Margin

- Output size supports `Original` (default) plus `A4/A3/A5/Letter/Legal/Tabloid/Custom`
- Uniform and per-side margins, including negative margin values
- Drag page content directly in Live Preview to fine-tune margins
- Preview lock toggle to control drag behavior
- Download adjusted PDFs or print directly
- Page range syntax: `1-3,6,9-12`, `all/*`, `odd`, `even`
- Live preview supports page navigation and drag-and-drop PDF upload
- Collapsible sections for per-side margins, page range, and download scope
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

### Compress

- Three compression levels: `Light`, `Balanced`, and `Strong` with visual intensity indicators
- Recompresses and downsamples embedded images while preserving the original text and vector layers
- Merges duplicate font and image resources, compresses unfiltered streams, and strips orphan objects
- Dual execution strategy:
  - Small files (< 20 MB) compress automatically on upload or level switch
  - Large files (≥ 20 MB) provide a manual Start Compression button to prevent browser slowdowns
- Real-time animated progress bar with percentage readout
- Live preview comparison between original and compressed renderings
- Automatic preview focus on newly uploaded PDF files
- Retains password protection for encrypted PDFs with optional decryption export
- Download individual or batch compressed PDFs, or print directly

### UX and Platforms

- Multi-language UI (简体中文, 繁體中文, English, 日本語, 한국어, Español, Français, Deutsch) with browser auto-detection and local persistence
- Persist mode, language, and theme state across page refresh, while preserving in-progress files across mode switches
- Refresh warning only when a PDF document is loaded
- Light/Dark theme toggle (default: light)
- Available for Web (GitHub Pages) and Chrome Extension

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

# Chrome extension
npm run build:extension
npm run pack:extension
```

## Build Outputs

- Web build: `dist/`
- Extension unpacked: `dist-extension/`
- Extension zip: `release/pdfmargin-chrome-extension.zip`

## Load Extension Locally

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `dist-extension/`

## Project Structure

- `src/App.tsx`: global mode/language/theme switch
- `src/i18n.ts`: 8-language localization dictionary
- `src/MarginTool.tsx`: margin workflow
- `src/OrganizeTool.tsx`: organize workflow
- `src/CompressTool.tsx`: compression workflow
- `src/pdfCompression.ts`: client-side PDF compression engine
- `src/styles.css`: global + theming styles
- `extension/`: Chrome extension manifest and background script
