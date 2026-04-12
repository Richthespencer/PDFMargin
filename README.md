# PDF Margin + Organizer Tool

一个在浏览器中运行的 PDF 工具，支持两种模式：

- `Margin`：添加边距、调整输出尺寸、实时预览并下载
- `Organize`：多 PDF 合并、页面拖拽重排、删除单页并按当前顺序导出

全部处理都在浏览器内完成，无需后端服务。

## 功能特性

### Margin 模式

- 上传单个 PDF
- 页码范围选择：支持 `1-3,6,9-12`、`all/*`、`odd`、`even`
- 设置四边边距或统一边距
- 输出纸张尺寸：`A4`、`A3`、`A5`、`Letter`、`Legal`、`Tabloid`、`Custom`
- 实时预览（按当前选择范围的最小页码预览）
- 两种下载模式：
  - 全部页面（仅对选中页应用边距，未选中页保持原样）
  - 仅调整页面（只导出选中页）
- 中英文切换

### Organize 模式

- 支持一次或多次上传多个 PDF
- 按页面粒度展开为贴片卡片墙（非列表）
- 页面卡片展示 PDF 预览缩略图
- 拖拽时实时腾挪位置（类似 iOS 桌面重排体验）
- 删除任意单页
- 导出时按当前页面顺序合并，不应用边距逻辑

## 技术栈

- Vite
- React + TypeScript
- pdf-lib（页面复制/导出）
- pdfjs-dist（预览与缩略图）

## 本地开发

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
```

构建结果在 `dist/`。

## 使用说明

1. 打开页面顶部模式切换：`Margin` 或 `Organize`。
2. 在 `Margin` 模式中上传 PDF、设置尺寸/边距/页码范围并下载。
3. 在 `Organize` 模式中上传多个 PDF，拖动页面卡片排序、删除页面后导出。

## 项目结构

- `src/main.tsx`：应用入口
- `src/App.tsx`：模式切换容器（Margin / Organize）
- `src/MarginTool.tsx`：边距工具实现
- `src/OrganizeTool.tsx`：合并/重排/删页实现
- `src/styles.css`：全局样式

## English

A browser-based PDF tool with two modes:

- `Margin`: add page margins, choose output paper size, live preview, and export
- `Organize`: merge multiple PDFs, drag to reorder pages, delete individual pages, and export in current order

All processing runs fully in the browser.

### Features

#### Margin Mode

- Upload a single PDF
- Page range parsing supports `1-3,6,9-12`, `all/*`, `odd`, and `even`
- Per-side margin or uniform margin
- Output presets: `A4`, `A3`, `A5`, `Letter`, `Legal`, `Tabloid`, `Custom`
- Live preview (uses the smallest selected page number)
- Two export scopes:
  - All pages (apply margin only to selected pages)
  - Selected pages only
- Chinese/English UI toggle

#### Organize Mode

- Upload multiple PDFs in one batch or multiple batches
- Expand to page-level cards laid out in a visual grid
- Card-level PDF page thumbnail preview
- Real-time drag reordering with slot-shift animation
- Delete individual pages
- Export merges exactly by current list order, with no margin transform

### Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```
