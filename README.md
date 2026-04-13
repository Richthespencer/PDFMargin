# PDFMargin

[English](./README.en.md)

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

## Tauri 桌面打包

先确保本机已安装 Rust 工具链与平台构建依赖（如 Xcode Command Line Tools）。

```bash
# 桌面开发模式（会启动 Vite + Tauri）
npm run tauri:dev

# 生成安装包
npm run tauri:build
```

打包产物位于 `src-tauri/target/release/bundle/`。

## Chrome Extension

```bash
# 构建扩展目录
npm run build:extension

# 构建并打包为 zip（用于 Chrome Web Store 上传）
npm run pack:extension
```

构建后会生成 `dist-extension/`，可直接用于 Chrome 开发者模式加载：

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择项目内的 `dist-extension/`

点击扩展图标会在新标签页打开 PDFMargin。

打包后的 zip 文件位于 `release/pdfmargin-chrome-extension.zip`。

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
