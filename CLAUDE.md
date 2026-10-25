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
| Tauri desktop dev | `npm run tauri:dev` |
| Tauri desktop build | `npm run tauri:build` |

No test, lint, or formatter scripts are configured.

## Architecture

PDFMargin is a local-first PDF tool shipped as three targets from a single Vite + React 19 + TypeScript codebase:

- **Web App** -- Vite SPA. Entry: `index.html` -> `src/main.tsx`.
- **Chrome Extension (Manifest V3)** -- Same web app bundled into `dist-extension/`. `extension/background.js` opens the app in a new tab on icon click. No content scripts.
- **Tauri Desktop** -- Same web frontend inside a Tauri 2.x webview. The Rust shell (`src-tauri/`) has no custom commands.

### Source layout

- `src/App.tsx` -- Top-level component. Manages mode (`margin`/`organize`/`compress`), language (`zh`/`en`), and theme (`light`/`dark`) state.
- `src/MarginTool.tsx` -- Margin workflow (~1200 lines). PDF upload, page-range parsing, live preview via PDF.js, margin controls, drag-to-adjust, download/print.
- `src/OrganizeTool.tsx` -- Organize workflow (~1100 lines). Multi-PDF upload, page wall with thumbnails, drag-and-drop reorder, multi-select, rotation, delete with confirmation, undo, download/print.
- `src/CompressTool.tsx` -- Compression workflow. 3 compression levels, live preview comparison, progress feedback, download/print.
- `src/pdfCompression.ts` -- Local TypeScript compression pipeline (image downsampling, stream deduplication, object stream packing, and cleanup).
- `src/styles.css` -- All styles. Theming via `data-theme` attribute on `<html>`.
- `extension/` -- Chrome extension manifest and icons.
- `scripts/build-extension.mjs` -- Builds web app then copies into `dist-extension/`.
- `scripts/pack-extension.mjs` -- Builds extension then zips to `release/`.
- `src-tauri/` -- Tauri Rust shell (minimal bootstrap only).

### Key libraries

- **pdfjs-dist** (PDF.js) -- Rendering PDFs for preview and thumbnails.
- **pdf-lib** -- Manipulating PDFs (margins, merging, rotation, export).
- PDF.js worker is imported via Vite's `?url` suffix: `import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'`.

## Implementation constraints

- **PDF.js worker wiring** in `src/MarginTool.tsx`: must import the worker with `?url` and set `GlobalWorkerOptions.workerSrc`. Preview/file parsing depends on this.
- **Bilingual UI**: copy lives in a `COPY` object in each tool file. When changing UI text, update both `zh` and `en` entries.
- **Page range parsing** (`parsePageRange` in `MarginTool.tsx`): supports `all`/`*`, `odd`, `even`, and numeric ranges.
- **Margin download has two modes** in `handleDownload`: `all` (exports all pages, applies margins only to selected indices) and `selected` (exports only selected pages).
- **Organize mode intentionally does not apply margins**; it exports pages exactly in the current list order after drag/drop and deletions.
- **No external UI library** -- all components and styling are hand-built in `styles.css`.
