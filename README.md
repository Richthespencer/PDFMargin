# PDF Margin Tool

一个在浏览器中运行的 PDF 边距调整工具，可为 PDF 文件添加边距、选择输出纸张尺寸并实时预览结果。

## 功能特性

- 上传本地 PDF 文件
- 设置四边边距，也支持统一边距
- 选择输出纸张尺寸：A4、A3、A5、Letter、Legal、Tabloid、Custom
- 中英文界面切换
- 实时预览第一页输出效果
- 下载处理后的 PDF
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
3. 调整上、右、下、左边距，或使用统一边距。
4. 在右侧查看实时预览。
5. 点击下载按钮生成新的 PDF 文件。

## 说明

- 预览区域只展示第一页。
- 输出文件会按当前边距和页面尺寸生成。
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
- Set per-side margins or a uniform margin
- Choose output paper sizes: A4, A3, A5, Letter, Legal, Tabloid, or Custom
- Switch between Chinese and English UI
- Live preview of the first page
- Download the processed PDF
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
3. Adjust the top, right, bottom, and left margins, or use the uniform margin control.
4. Check the live preview on the right.
5. Click the download button to generate a new PDF.

### Notes

- The preview shows the first page only.
- The output PDF is generated using the current margin and paper size settings.
- Large PDFs or PDFs with many images may take longer to process.

### Troubleshooting

#### Preview failed?

Make sure the file is a valid PDF. Encrypted, corrupted, or highly unusual PDFs may fail to preview.

#### Why is the output file larger or smaller?

PDF size depends on images, fonts, and page complexity. This tool preserves the original page content as much as possible.
