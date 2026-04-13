# AGENTS

## Repo shape
- Single-package Vite + React + TypeScript app (no monorepo/workspaces).
- Main entrypoints: `src/main.tsx` (bootstraps app) and `src/App.tsx` (top-level mode switch: `Margin` / `Organize`).
- Feature modules: `src/MarginTool.tsx` (margin workflow) and `src/OrganizeTool.tsx` (merge/reorder/delete workflow).
- No CI workflows, no lint script, and no test script are configured in this repo.

## Verified commands
- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build` (runs `tsc -b` first, then `vite build`)
- Preview built app: `npm run preview`
- Chrome extension build: `npm run build:extension` (builds web app then prepares `dist-extension/` for unpacked loading)
- Chrome extension package: `npm run pack:extension` (creates `release/pdfmargin-chrome-extension.zip`)
- Tauri desktop: `npm run tauri:dev`, `npm run tauri:build`

## Implementation constraints that are easy to break
- PDF.js worker wiring is required in `src/MarginTool.tsx`: import `pdfjs-dist/legacy/build/pdf.worker.mjs?url` and set `GlobalWorkerOptions.workerSrc`; preview/file parsing depends on this.
- Margin UI copy is bilingual via `COPY` in `src/MarginTool.tsx`; when changing existing margin text, update both `zh` and `en` entries.
- Margin page-range parsing behavior lives in `parsePageRange` in `src/MarginTool.tsx`; supported tokens include numeric ranges plus `all`/`*`, `odd`, and `even`.
- Margin download behavior has two distinct modes in `handleDownload`:
  - `all`: export all pages, apply margins only to selected indices.
  - `selected`: export only selected indices.
- Organize mode intentionally does not apply margins; it exports pages exactly in the current list order after drag/drop and deletions.

## Existing instruction source
- Keep `.github/copilot-instructions.md` intent intact: preserve existing behavior unless user asks for a change; keep PDF-library changes minimal and browser-safe.
