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

## Browser automated testing
- Use `agent-browser` for UI testing (requires `agent-browser` CLI installed).
- **Only run tests when code is modified**; do not re-run unchanged scenarios.
- **Test only the modified parts**; avoid running full test suites after every change.
- Start dev server: `npm run dev` (port 5173 or next available).
- Open browser: `pkill -f agent-browser; sleep 1; agent-browser open http://localhost:5173 --headed && agent-browser set viewport 1920 1080`.
- Key test scenarios (run selectively based on what changed):
  - Mode switching: Margin ↔ Organize, verify localStorage `pdfmargin-mode` persists.
  - Theme toggle: Light ↔ Dark, verify localStorage `pdfmargin-theme` persists.
  - Language switch: 中文 ↔ English, verify UI text changes.
  - State persistence: After `agent-browser reload`, verify mode/theme/language persist.
  - Collapsible sections: Expand/collapse per-side margins, page range, download scope.
- Screenshot naming: `.agent-screenshots/YYYYMMDD-HHMMSS-description.png`.
- Use `agent-browser eval "localStorage.getItem('pdfmargin-mode')"` to verify persistence.
- Use `agent-browser snapshot -i -c` to inspect interactive elements with @refs.
- **Stop testing after verification**; do not loop or repeat checks.

## Git workflow preferences
- User prefers not pushing to GitHub remote after every change; only push when explicitly requested.
- Local commits are fine; remote pushes require explicit user instruction.

## Existing instruction source
- Keep `.github/copilot-instructions.md` intent intact: preserve existing behavior unless user asks for a change; keep PDF-library changes minimal and browser-safe.
