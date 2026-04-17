# Session Notes

Last updated: 2026-04-16

## Scope Completed

- Added top-level mode switching in `src/App.tsx` for `Margin` and `Organize`.
- Refactored original monolithic app logic into:
  - `src/MarginTool.tsx`
  - `src/OrganizeTool.tsx`

## Organize Feature (Major Additions)

- Multi-PDF upload and page-level merge/reorder/delete workflow.
- Card-wall layout with PDF page thumbnail previews (not list layout).
- Drag-and-drop reorder with smoother "slot-shift" animation behavior.
- Fixed jitter/flip-flop during drag near boundaries using dead-zone/cooldown/reverse-guard logic.
- Fixed inability to move items to the final position by adding before/after placement logic.
- Added multi-select drag:
  - `Cmd/Ctrl + click` toggles selection
  - selected pages can be moved as a group while preserving internal order
- Added two-step delete confirmation (click delete -> red confirm -> click again to delete).
- Added Undo button for last reorder/delete action.
- Added loading progress feedback while parsing uploaded PDFs and generating thumbnails.

## Margin Feature Updates

- Added `Original` output size option and made it the default.
- `Original` size is derived from the first page of the uploaded PDF.
- Kept all existing size presets (`A4/A3/A5/Letter/Legal/Tabloid/Custom`).
- Enabled negative margins (range now supports down to `-200`) for shrinking margins.

## Language and Theme

- Unified language state across `Margin` and `Organize` (no reset when switching modes).
- Added bilingual copy for Organize mode.
- Added light/dark theme toggle with default **light mode**.
- Updated theme toggle control to use moon/sun icons.
- Improved selection-state contrast in light mode (including download scope chips and organize selected cards).

## Chrome Extension Work

- Added extension scaffold under `extension/`:
  - `manifest.json` (MV3)
  - `background.js` (opens app in new tab)
- Added extension icons and integrated them in manifest:
  - `16/32/48/128` sizes
  - created an Organize-focused icon design and later made outer area transparent
- Added build pipeline:
  - `scripts/build-extension.mjs`
  - `npm run build:extension`
- Added zip packaging pipeline:
  - `scripts/pack-extension.mjs`
  - `npm run pack:extension`
  - output: `release/pdfmargin-chrome-extension.zip`

## Tauri/Desktop and Release

- Initialized Tauri desktop wrapper in `src-tauri/`.
- Set a valid bundle identifier (`com.richthespencer.pdfmargin`) for build compliance.
- Verified Tauri macOS build output:
  - `.app`
  - `.dmg`
- Updated GitHub release `v0.1.0` assets to include:
  - `PDFMargin_0.1.0_aarch64.dmg`
  - `pdfmargin-chrome-extension.zip`

## Documentation Updates

- Added `AGENTS.md` and kept it aligned with current architecture and commands.
- Reworked README files into cleaner CN/EN split:
  - `README.md` (primary Chinese)
  - `README.en.md` (English)
- Added `PRIVACY.md` for web/extension privacy statement.

## Notable Current Commands

- Web: `npm run dev`, `npm run build`, `npm run preview`
- Extension: `npm run build:extension`, `npm run pack:extension`
- Tauri: `npm run tauri:dev`, `npm run tauri:build`
