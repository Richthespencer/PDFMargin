# PDF Margin Tool

一个在浏览器中运行的 PDF 边距调整工具，可为 PDF 文件添加边距、选择输出纸张尺寸并实时预览结果。

## 功能特性

- 上传本地 PDF 文件
- 页码范围选择：支持 1-3,6,9-12、奇数页、偶数页、全部页面
- 设置四边边距，也支持统一边距
- 选择输出纸张尺寸：A4、A3、A5、Letter、Legal、Tabloid、Custom
- 中英文界面切换
- 实时预览：当设置了页码范围时，预览所选页面中页码最小的页面
- 下载模式：
	- 全部页面（仅对选中页面应用边距，未选中页面保持原样，并按原页序合成）
	- 仅调整页面（仅导出选中并调整后的页面）
- 基于浏览器可用的 PDF 库实现，无需安装桌面软件

## 技术栈

- Vite
- React
- TypeScript
- pdf-lib
- pdfjs-dist

## 本地开发

```bash
npm install
npm run dev
```

开发服务启动后，在终端提示的地址中打开页面即可。

## 生产构建

```bash
npm run build
```

构建产物会输出到 dist 目录。

## 使用方法

1. 点击“选择 PDF 文件”上传文档。
2. 选择输出尺寸，或切换为 Custom 自定义尺寸。
3. 输入页码范围（如 1-3,6,9-12），或使用“全部 / 奇数页 / 偶数页”快捷按钮。
4. 调整上、右、下、左边距，或使用统一边距。
5. 选择下载范围：
	- 全部页面（推荐，保持原顺序）
	- 仅调整页面
6. 在右侧查看实时预览（若指定范围，则预览最小页码页）。
7. 点击下载按钮生成新的 PDF 文件。

## 说明

- 预览区域默认展示第一页；设置页码范围后，展示选中范围内页码最小的页面。
- 全部页面下载会保留未选中页面，并与调整后页面按原顺序合成。
- 仅调整页面下载只包含选中的页面。
- 如果 PDF 本身包含复杂内容或大体积图片，生成和下载可能需要更多时间。

## 常见问题

### 预览失败怎么办？

请确认文件是有效的 PDF。如果是加密 PDF、损坏文件或格式非常特殊的 PDF，预览可能失败。

### 输出文件为什么体积变化明显？

PDF 中的图片、字体和页面内容复杂度都会影响最终体积。当前工具以尽量保留原始页面为主。

## 项目结构

- src/App.tsx：主界面与 PDF 处理逻辑
- src/styles.css：界面样式
- index.html：应用入口

## English

A browser-based PDF margin tool that lets you add margins, choose output paper sizes, and preview the result in real time.

### Features

- Upload local PDF files
- Page range selection: supports 1-3,6,9-12, odd pages, even pages, and all pages
- Set per-side margins or a uniform margin
- Choose output paper sizes: A4, A3, A5, Letter, Legal, Tabloid, or Custom
- Switch between Chinese and English UI
- Live preview: when a page range is set, the preview shows the smallest selected page number
- Download scopes:
	- All pages (apply margins only to selected pages, keep unselected pages unchanged, and merge in original order)
	- Adjusted pages only (export only selected adjusted pages)
- Uses browser-safe PDF libraries, no desktop app required

### Tech Stack

- Vite
- React
- TypeScript
- pdf-lib
- pdfjs-dist

### Development

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal after the dev server starts.

### Build

```bash
npm run build
```

The production build is generated in the dist folder.

### How to Use

1. Upload a PDF file.
2. Choose an output paper size, or select Custom.
3. Enter a page range (for example: 1-3,6,9-12), or use quick actions for all/odd/even pages.
4. Adjust the top, right, bottom, and left margins, or use the uniform margin control.
5. Select a download scope:
	- All pages (recommended, preserves original page order)
	- Adjusted pages only
6. Check the live preview on the right (if range is set, it previews the smallest selected page).
7. Click the download button to generate a new PDF.

### Notes

- By default, the preview shows the first page. When a page range is provided, it shows the smallest selected page number.
- All-pages download keeps unselected pages and merges adjusted and original pages in original order.
- Adjusted-pages-only download exports only selected pages.
- Large PDFs or PDFs with many images may take longer to process.

### Troubleshooting

#### Preview failed?

Make sure the file is a valid PDF. Encrypted, corrupted, or highly unusual PDFs may fail to preview.

#### Why is the output file larger or smaller?

PDF size depends on images, fonts, and page complexity. This tool preserves the original page content as much as possible.
