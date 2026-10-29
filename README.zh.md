# PDFMargin

[English](./README.md) · [Privacy Policy](./PRIVACY.md)

Chrome 应用商店页面：https://chromewebstore.google.com/detail/pdfmargin/pcckkfncbpioipomonnfkoiinejeljip

在线体验：https://richthespencer.github.io/PDFMargin/

PDFMargin 是一个本地优先的 PDF 应用，专注三个核心场景：

- `Margin`：解决“打印边缘被裁切”问题，调整边距后下载或打印
- `Organize`：多 PDF 页面级整理，重排、旋转、删除后下载或打印
- `Compress`：压缩 PDF 体积，兼顾清晰度与文本可搜索性

所有处理都在本地浏览器内完成，不上传文件到服务端。

## 核心能力

### Margin（边距调整）

- 输出尺寸支持 `原尺寸`（默认）以及 `A4/A3/A5/Letter/Legal/Tabloid/Custom`
- 支持统一边距与四边独立边距（允许负边距）
- 支持在 Live Preview 中直接拖动页面内容微调边距
- 预览锁定开关，控制拖拽调整边距行为
- 支持下载 PDF 与直接打印调整结果
- 页码范围支持 `1-3,6,9-12`、`all/*`、`odd`、`even`
- 实时预览支持分页切换与拖拽上传 PDF
- 可折叠面板：单独边距、页码范围、下载范围
- 下载模式：
  - 全部页面（仅对选中页应用边距）
  - 仅调整页面

### Organize（页面整理）

- 一次或多次上传多个 PDF
- 页面墙区域支持拖拽上传 PDF
- 页面墙缩略图视图（非列表）
- 拖拽重排（支持拖到最后位置）
- 单击切换多选并组拖移动
- 支持手动指定目标位置移动（Move to + Before/After）
- 单页 90° 旋转
- 删除二次确认与一键清空全部页面
- 撤销上一步（支持撤销重排/删除）
- 支持下载 PDF 与直接打印当前结果

### Compress（体积压缩）

- 提供轻度、标准、强力三档压缩程度，辅以阶梯式视觉强度条直观指示
- 重压缩与降采样内嵌图片，完整保留文字与矢量内容的可选与搜索能力
- 合并重复字体与图像资源流，压缩未压缩流并清理冗余孤立对象
- 智能文件处理策略：
  - 小文件（< 20 MB）上传或切换压缩档位后自动即时压缩
  - 大文件（≥ 20 MB）提供手动“开始压缩”按钮，防止误触导致卡顿
- 实时动态进度条与百分比显示
- 压缩前后画质实时对比预览
- 添加新 PDF 后自动切换至最新上传文件的预览视图
- 支持加密 PDF 密码解锁与压缩后保留密码加密
- 支持单文件与批量下载压缩结果，亦可直接调用系统打印

### 体验与平台

- 支持 8 种界面语言（简体中文、繁體中文、English、日本語、한국어、Español、Français、Deutsch），自动识别浏览器语言并本地持久化
- 刷新页面时保留当前模式、语言与主题状态；切换功能模式时无缝保留各面板已上传的文件与进度
- 仅在已加载 PDF 时启用页面刷新离开防呆提示
- 浅色/深色主题切换（默认浅色）
- Web（GitHub Pages）与 Chrome Extension 双端支持

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

# Chrome extension
npm run build:extension
npm run pack:extension
```

## 产物位置

- Web build：`dist/`
- Extension unpacked：`dist-extension/`
- Extension zip：`release/pdfmargin-chrome-extension.zip`

## Chrome Extension 本地加载

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择 `dist-extension/`

## 项目结构

- `src/App.tsx`：全局模式/语言/主题切换
- `src/i18n.ts`：多语言文案与语言检测
- `src/MarginTool.tsx`：边距调整流程
- `src/OrganizeTool.tsx`：页面整理流程
- `src/CompressTool.tsx`：文件压缩流程
- `src/pdfCompression.ts`：本地 PDF 压缩引擎
- `src/styles.css`：主题与全局样式
- `extension/`：Chrome Extension 清单与后台脚本
