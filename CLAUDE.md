# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` |
| Type-check + production build | `npm run build` (runs `tsc -b` then `vite build`) |
| Preview built app | `npm run preview` |
| Chrome extension (unpacked) | `npm run build:extension` |
| Chrome extension (zip) | `npm run pack:extension` |

No test, lint, or formatter scripts are configured.

## Architecture

PDFMargin is a local-first PDF tool shipped as two targets from a single Vite + React 19 + TypeScript codebase:

- **Web App (GitHub Pages)** -- Vite SPA. Entry: `index.html` -> `src/main.tsx`.
- **Chrome Extension (Manifest V3)** -- Same web app bundled into `dist-extension/`. `extension/background.js` opens the app in a new tab on icon click. No content scripts.

### Source layout

- `src/App.tsx` -- Top-level component. Manages mode (`margin`/`organize`/`compress`), language (`zh`/`zh-TW`/`en`/`ja`/`ko`/`es`/`fr`/`de`), and theme (`light`/`dark`) state.
- `src/i18n.ts` -- Multi-language UI dictionary and locale detection/persistence.
- `src/MarginTool.tsx` -- Margin workflow. PDF upload, page-range parsing, live preview via PDF.js, margin controls, drag-to-adjust, download/print.
- `src/OrganizeTool.tsx` -- Organize workflow. Multi-PDF upload, page wall with thumbnails, drag-and-drop reorder, multi-select, rotation, delete with confirmation, undo, download/print.
- `src/CompressTool.tsx` -- Compression workflow. 3 compression levels, live preview comparison, progress feedback, download/print.
- `src/pdfCompression.ts` -- Local TypeScript compression pipeline (image downsampling, stream deduplication, object stream packing, and cleanup).
- `src/styles.css` -- All styles. Theming via `data-theme` attribute on `<html>`.
- `extension/` -- Chrome extension manifest and icons.
- `scripts/build-extension.mjs` -- Builds web app then copies into `dist-extension/`.
- `scripts/pack-extension.mjs` -- Builds extension then zips to `release/`.

### Key libraries

- **pdfjs-dist** (PDF.js) -- Rendering PDFs for preview and thumbnails.
- **pdf-lib** -- Manipulating PDFs (margins, merging, rotation, export).
- PDF.js worker is imported via Vite's `?url` suffix: `import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'`.

## Implementation constraints

- **PDF.js worker wiring** in `src/MarginTool.tsx`: must import the worker with `?url` and set `GlobalWorkerOptions.workerSrc`. Preview/file parsing depends on this.
- **Multi-language UI**: copy lives in `src/i18n.ts`. When changing UI text, keep all 8 locales in sync.
- **Page range parsing** (`parsePageRange` in `MarginTool.tsx`): supports `all`/`*`, `odd`, `even`, and numeric ranges.
- **Margin download has two modes** in `handleDownload`: `all` (exports all pages, applies margins only to selected indices) and `selected` (exports only selected pages).
- **Organize mode intentionally does not apply margins**; it exports pages exactly in the current list order after drag/drop and deletions.
- **No external UI library** -- all components and styling are hand-built in `styles.css`.
