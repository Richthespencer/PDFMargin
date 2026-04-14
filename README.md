# PDFMargin

[English](./README.en.md) · [Privacy Policy](./PRIVACY.md)

PDFMargin 是一个本地优先的 PDF 工具，围绕两个高频场景：

- `Margin`：解决“打印边缘被裁切”问题，快速调整边距并导出
- `Organize`：多 PDF 页面级整理，拖拽重排、删除、撤销后导出

所有处理都在本地浏览器/客户端完成，不上传文件到服务端。

## 核心能力

### Margin（边距调整）

- 输出尺寸支持 `原尺寸`（默认）以及 `A4/A3/A5/Letter/Legal/Tabloid/Custom`
- 支持统一边距和四边独立边距，允许负边距（缩小边距）
- 页码范围支持 `1-3,6,9-12`、`all/*`、`odd`、`even`
- 实时预览当前设置效果
- 导出模式：
  - 全部页面（仅对选中页应用边距）
  - 仅调整页面

### Organize（页面整理）

- 一次或多次上传多个 PDF
- 页面墙缩略图视图（非列表）
- 拖拽重排（支持拖到最后位置）
- `Cmd/Ctrl + 点击` 多选并组拖移动
- 删除二次确认（再次点击确认删除）
- 撤销上一步（支持撤销重排/删除）

### 体验与平台

- 中英文双语（全局同步）
- 浅色/深色主题切换（默认浅色）
- Web、Tauri 桌面版、Chrome Extension 三端支持

## 快速开始

```bash
npm install
npm run dev
```

## 常用命令

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

## 产物位置

- Web build：`dist/`
- Tauri bundle：`src-tauri/target/release/bundle/`
- Extension unpacked：`dist-extension/`
- Extension zip：`release/pdfmargin-chrome-extension.zip`

## Chrome Extension 本地加载

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择 `dist-extension/`

## 项目结构

- `src/App.tsx`：全局模式/语言/主题切换
- `src/MarginTool.tsx`：边距调整流程
- `src/OrganizeTool.tsx`：页面整理流程
- `src/styles.css`：主题与全局样式
- `src-tauri/`：桌面端壳层
- `extension/`：Chrome Extension 清单与后台脚本
