import { useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type { Theme } from './App';

GlobalWorkerOptions.workerSrc = workerSrc;

type PagePresetKey = 'Original' | 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';

type PagePreset = {
  label: string;
  widthMm: number;
  heightMm: number;
};

type MarginState = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type PageRangeResult = {
  indices: number[];
  invalidTokens: string[];
};

type DownloadMode = 'all' | 'selected';

export type Lang = 'zh' | 'en';

const MM_TO_PT = 72 / 25.4;
const PRESETS: Record<PagePresetKey, PagePreset> = {
  Original: { label: '原尺寸', widthMm: 210, heightMm: 297 },
  A4: { label: 'A4', widthMm: 210, heightMm: 297 },
  A3: { label: 'A3', widthMm: 297, heightMm: 420 },
  A5: { label: 'A5', widthMm: 148, heightMm: 210 },
  Letter: { label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  Legal: { label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
  Tabloid: { label: 'Tabloid', widthMm: 279.4, heightMm: 431.8 },
  Custom: { label: '自定义', widthMm: 210, heightMm: 297 },
};

const PRESET_LABELS_EN: Record<PagePresetKey, string> = {
  Original: 'Original',
  A4: 'A4',
  A3: 'A3',
  A5: 'A5',
  Letter: 'Letter',
  Legal: 'Legal',
  Tabloid: 'Tabloid',
  Custom: 'Custom',
};

const COPY = {
  zh: {
    heroTitle: '为 PDF 添加边距，并实时预览输出效果',
    heroSubtitle: '支持常见纸张尺寸、单页预览和自定义边距设置，适合快速调整文档版式。',
    panelTitle: '控制面板',
    panelDesc: '上传文件，调整纸张与边距。',
    choosePdf: '点击选择 PDF 文件',
    choosePdfHint: '支持选择本地 PDF 并立即生成预览。',
    outputSize: '输出尺寸',
    pageRange: '页码范围',
    pageRangeSettings: '页码范围设置',
    pageRangeHint: '示例：1-3, 6, 9-12；留空表示全部页面。',
    pageRangePlaceholder: '如：1-3, 8, 10-12',
    allPages: '全部',
    oddPages: '奇数页',
    evenPages: '偶数页',
    selectedPages: (count: number) => `已选择 ${count} 页`,
    invalidPageRange: (tokens: string) => `无效页码：${tokens}`,
    pageRangeEmpty: '当前页码范围未匹配任何页面',
    uniformMargin: '统一边距',
    perSideMargins: '单独边距调整',
    width: '宽度（mm）',
    height: '高度（mm）',
    top: '上边距（mm）',
    right: '右边距（mm）',
    bottom: '下边距（mm）',
    left: '左边距（mm）',
    outputPage: '输出页面',
    downloadScope: '下载范围',
    downloadScopeSettings: '下载范围设置',
    downloadAllPages: '全部页面（保留未调整页）',
    downloadAdjustedPages: '仅调整页面',
    downloadAll: '下载全部页面 PDF',
    downloadSelected: '下载仅调整页面 PDF',
    contentArea: '可用内容区',
    processing: '处理中...',
    previewTitle: '实时预览',
    previewDesc: '当前设置下的第一页效果。',
    previewEmpty: '上传 PDF 后即可查看实时预览',
    language: 'English',
    statusWaiting: '等待上传 PDF',
    statusReading: '正在读取文件...',
    statusLoaded: (pages: number) => `已加载 ${pages} 页，正在生成预览...`,
    statusPreviewReady: (pages: number) => `已加载 ${pages} 页，预览已就绪`,
    statusPageRangeEmpty: '页码范围未匹配到可预览页面',
    statusPreviewFail: '预览生成失败',
    statusOutputting: '正在生成输出 PDF...',
    statusDone: 'PDF 已生成并开始下载',
    statusOutputFail: '生成失败，请稍后重试',
    statusFileReadFail: '文件读取失败',
    outputSizeInfo: '目标尺寸',
    originalSize: '原始首页尺寸约为',
    pagesLoaded: (pages: number) => `${pages} 页`,
    pagesNotLoaded: '未加载',
    useCurrentMargin: '20 mm',
  },
  en: {
    heroTitle: 'Add margins to PDFs and preview the result in real time',
    heroSubtitle: 'Adjust margins and export PDFs.',
    panelTitle: 'Controls',
    panelDesc: 'Upload a file and adjust paper and margins.',
    choosePdf: 'Click to choose a PDF',
    choosePdfHint: 'Select a local PDF to generate the preview immediately.',
    outputSize: 'Output size',
    pageRange: 'Page range',
    pageRangeSettings: 'Page range settings',
    pageRangeHint: 'Example: 1-3, 6, 9-12. Leave empty for all pages.',
    pageRangePlaceholder: 'e.g. 1-3, 8, 10-12',
    allPages: 'All',
    oddPages: 'Odd',
    evenPages: 'Even',
    selectedPages: (count: number) => `${count} pages selected`,
    invalidPageRange: (tokens: string) => `Invalid pages: ${tokens}`,
    pageRangeEmpty: 'The page range does not match any pages',
    uniformMargin: 'Uniform margin',
    perSideMargins: 'Per-side margins',
    width: 'Width (mm)',
    height: 'Height (mm)',
    top: 'Top margin (mm)',
    right: 'Right margin (mm)',
    bottom: 'Bottom margin (mm)',
    left: 'Left margin (mm)',
    outputPage: 'Output page',
    downloadScope: 'Download scope',
    downloadScopeSettings: 'Download scope settings',
    downloadAllPages: 'All pages (keep unadjusted pages)',
    downloadAdjustedPages: 'Adjusted pages only',
    downloadAll: 'Download all pages PDF',
    downloadSelected: 'Download adjusted pages PDF',
    contentArea: 'Available content area',
    processing: 'Processing...',
    previewTitle: 'Live preview',
    previewDesc: 'Preview of the first page with current settings.',
    previewEmpty: 'Upload a PDF to see the live preview',
    language: '中文',
    statusWaiting: 'Waiting for a PDF',
    statusReading: 'Reading file...',
    statusLoaded: (pages: number) => `Loaded ${pages} pages, generating preview...`,
    statusPreviewReady: (pages: number) => `Loaded ${pages} pages, preview ready`,
    statusPageRangeEmpty: 'No previewable pages in page range',
    statusPreviewFail: 'Preview generation failed',
    statusOutputting: 'Generating output PDF...',
    statusDone: 'PDF generated and download started',
    statusOutputFail: 'Generation failed, please try again later',
    statusFileReadFail: 'File read failed',
    outputSizeInfo: 'Target size',
    originalSize: 'Approximate first-page size',
    pagesLoaded: (pages: number) => `${pages} pages`,
    pagesNotLoaded: 'Not loaded',
    useCurrentMargin: '20 mm',
  },
} as const;

function mmToPt(valueMm: number) {
  return valueMm * MM_TO_PT;
}

function ptToMm(valuePt: number) {
  return valuePt / MM_TO_PT;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatMm(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} mm`;
}

function parseNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function getPageSizeMm(
  preset: PagePresetKey,
  customWidthMm: number,
  customHeightMm: number,
  originalWidthMm: number,
  originalHeightMm: number,
) {
  if (preset === 'Original') {
    return { widthMm: originalWidthMm, heightMm: originalHeightMm };
  }
  if (preset === 'Custom') {
    return { widthMm: customWidthMm, heightMm: customHeightMm };
  }
  const selected = PRESETS[preset];
  return { widthMm: selected.widthMm, heightMm: selected.heightMm };
}

async function loadPagePreview(bytes: Uint8Array, pageNumber: number) {
  const pdf = await getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(pageNumber);
  return { pdf, page };
}

function parsePageRange(input: string, totalPages: number): PageRangeResult {
  if (totalPages <= 0) {
    return { indices: [], invalidTokens: [] };
  }

  const value = input.trim().toLowerCase();
  if (!value || value === 'all' || value === '*') {
    return {
      indices: Array.from({ length: totalPages }, (_, idx) => idx),
      invalidTokens: [],
    };
  }

  if (value === 'odd') {
    return {
      indices: Array.from({ length: totalPages }, (_, idx) => idx).filter((idx) => (idx + 1) % 2 === 1),
      invalidTokens: [],
    };
  }

  if (value === 'even') {
    return {
      indices: Array.from({ length: totalPages }, (_, idx) => idx).filter((idx) => (idx + 1) % 2 === 0),
      invalidTokens: [],
    };
  }

  const indexSet = new Set<number>();
  const invalidTokens: string[] = [];
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  tokens.forEach((token) => {
    if (/^\d+$/.test(token)) {
      const pageNumber = Number(token);
      if (pageNumber >= 1 && pageNumber <= totalPages) {
        indexSet.add(pageNumber - 1);
      } else {
        invalidTokens.push(token);
      }
      return;
    }

    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!rangeMatch) {
      invalidTokens.push(token);
      return;
    }

    const startRaw = Number(rangeMatch[1]);
    const endRaw = Number(rangeMatch[2]);
    if (startRaw < 1 || startRaw > totalPages || endRaw < 1 || endRaw > totalPages) {
      invalidTokens.push(token);
      return;
    }

    const start = Math.min(startRaw, endRaw);
    const end = Math.max(startRaw, endRaw);
    for (let current = start; current <= end; current += 1) {
      indexSet.add(current - 1);
    }
  });

  return {
    indices: Array.from(indexSet).sort((a, b) => a - b),
    invalidTokens,
  };
}

type MarginToolProps = {
  lang: Lang;
  onToggleLang: () => void;
  theme: Theme;
};

export default function MarginTool({ lang, onToggleLang, theme }: MarginToolProps) {
  const [fileName, setFileName] = useState('');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageRangeInput, setPageRangeInput] = useState('');
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('all');
  const [preset, setPreset] = useState<PagePresetKey>('Original');
  const [originalWidthMm, setOriginalWidthMm] = useState(210);
  const [originalHeightMm, setOriginalHeightMm] = useState(297);
  const [customWidthMm, setCustomWidthMm] = useState(210);
  const [customHeightMm, setCustomHeightMm] = useState(297);
  const [isPerSideOpen, setIsPerSideOpen] = useState(false);
  const [isPageRangeOpen, setIsPageRangeOpen] = useState(false);
  const [isDownloadScopeOpen, setIsDownloadScopeOpen] = useState(false);
  const [margins, setMargins] = useState<MarginState>({
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  });
  const [isRendering, setIsRendering] = useState(false);
  const [status, setStatus] = useState('等待上传 PDF');
  const [previewError, setPreviewError] = useState('');
  const [previewScaleInfo, setPreviewScaleInfo] = useState('');
  const [previewSourceVersion, setPreviewSourceVersion] = useState(0);

  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceViewportRef = useRef<{ width: number; height: number } | null>(null);
  const ui = COPY[lang];

  const pageSizeMm = useMemo(
    () => getPageSizeMm(preset, customWidthMm, customHeightMm, originalWidthMm, originalHeightMm),
    [preset, customWidthMm, customHeightMm, originalWidthMm, originalHeightMm],
  );

  const pageSizePt = useMemo(
    () => ({ width: mmToPt(pageSizeMm.widthMm), height: mmToPt(pageSizeMm.heightMm) }),
    [pageSizeMm],
  );

  const marginBoxPt = useMemo(
    () => ({
      top: mmToPt(margins.top),
      right: mmToPt(margins.right),
      bottom: mmToPt(margins.bottom),
      left: mmToPt(margins.left),
    }),
    [margins],
  );

  const pageRangeResult = useMemo(() => parsePageRange(pageRangeInput, pageCount), [pageRangeInput, pageCount]);
  const selectedPageIndices = pageRangeResult.indices;
  const previewPageNumber = selectedPageIndices.length > 0 ? selectedPageIndices[0] + 1 : 1;
  const pageRangeError =
    pageRangeResult.invalidTokens.length > 0
      ? ui.invalidPageRange(pageRangeResult.invalidTokens.join(', '))
      : selectedPageIndices.length === 0 && pageCount > 0
        ? ui.pageRangeEmpty
        : '';

  const canProcess = Boolean(
    fileBytes
    && pageCount > 0
    && (downloadMode === 'all' || selectedPageIndices.length > 0),
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setStatus(ui.statusReading);
    setPreviewError('');

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setFileBytes(bytes);
      const previewBytes = new Uint8Array(bytes);
      const pdf = await getDocument({ data: previewBytes }).promise;
      setPageCount(pdf.numPages);
      setPageRangeInput('');
      const firstPage = await pdf.getPage(1);
      const size = firstPage.getViewport({ scale: 1 });
      setOriginalWidthMm(ptToMm(size.width));
      setOriginalHeightMm(ptToMm(size.height));
      setPreviewScaleInfo(`${ui.originalSize} ${formatMm(ptToMm(size.width))} × ${formatMm(ptToMm(size.height))}`);
      setStatus(ui.statusLoaded(pdf.numPages));
    } catch (error) {
      setFileBytes(null);
      setPageCount(0);
      setFileName('');
      setPreviewError(lang === 'zh' ? 'PDF 读取失败，请重新选择文件。' : 'PDF failed to load. Please choose another file.');
      setStatus(ui.statusFileReadFail);
    }
  }

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    const loadSourcePage = async () => {
      if (!fileBytes) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 1;
          canvas.height = 1;
          ctx.clearRect(0, 0, 1, 1);
        }
        sourceCanvasRef.current = null;
        sourceViewportRef.current = null;
        setStatus(ui.statusWaiting);
        setPreviewScaleInfo('');
        return;
      }

      if (selectedPageIndices.length === 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 1;
          canvas.height = 1;
          ctx.clearRect(0, 0, 1, 1);
        }
        sourceCanvasRef.current = null;
        sourceViewportRef.current = null;
        setStatus(ui.statusPageRangeEmpty);
        return;
      }

      setIsRendering(true);
      setPreviewError('');

      try {
        const { pdf, page } = await loadPagePreview(new Uint8Array(fileBytes), previewPageNumber);
        if (cancelled) {
          pdf.destroy();
          return;
        }

        const sourceViewport = page.getViewport({ scale: 1 });
        const backgroundScale = Math.min(2.5, 1400 / sourceViewport.width);
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = Math.floor(sourceViewport.width * backgroundScale);
        sourceCanvas.height = Math.floor(sourceViewport.height * backgroundScale);
        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) {
          pdf.destroy();
          throw new Error('无法创建预览上下文');
        }

        await page
          .render({
            canvasContext: sourceCtx,
            viewport: page.getViewport({ scale: backgroundScale }),
          } as Parameters<typeof page.render>[0])
          .promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        sourceCanvasRef.current = sourceCanvas;
        sourceViewportRef.current = { width: sourceViewport.width, height: sourceViewport.height };
        setPreviewSourceVersion((current) => current + 1);
        setStatus(ui.statusPreviewReady(pdf.numPages));
        pdf.destroy();
      } catch (error) {
        console.error('Preview render failed:', error);
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setPreviewError(lang === 'zh' ? `预览生成失败：${message}` : `Preview generation failed: ${message}`);
          setStatus(ui.statusPreviewFail);
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void loadSourcePage();

    return () => {
      cancelled = true;
    };
  }, [
    fileBytes,
    lang,
    previewPageNumber,
    selectedPageIndices.length,
    ui.statusPageRangeEmpty,
    ui.statusPreviewFail,
    ui.statusPreviewReady,
    ui.statusWaiting,
  ]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const container = previewWrapRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    const sourceViewport = sourceViewportRef.current;
    if (!canvas || !container || !fileBytes || !sourceCanvas || !sourceViewport) {
      return;
    }

    const containerWidth = clamp(container.clientWidth || 900, 320, 1100);
    const cssHeight = Math.max(420, containerWidth * (pageSizePt.height / pageSizePt.width));
    const pixelWidth = Math.floor(containerWidth * window.devicePixelRatio);
    const pixelHeight = Math.floor(cssHeight * window.devicePixelRatio);

    const bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = pixelWidth;
    bufferCanvas.height = pixelHeight;
    const bufferCtx = bufferCanvas.getContext('2d');
    if (!bufferCtx) {
      return;
    }

    bufferCtx.save();
    bufferCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    bufferCtx.clearRect(0, 0, containerWidth, cssHeight);
    const isDarkTheme = theme === 'dark';
    bufferCtx.fillStyle = isDarkTheme ? '#0f172a' : '#e2e8f0';
    bufferCtx.fillRect(0, 0, containerWidth, cssHeight);

    const pageCssWidth = Math.min(containerWidth - 64, 780);
    const pageCssHeight = pageCssWidth * (pageSizePt.height / pageSizePt.width);
    const offsetX = (containerWidth - pageCssWidth) / 2;
    const offsetY = 24;

    bufferCtx.fillStyle = '#ffffff';
    bufferCtx.fillRect(offsetX, offsetY, pageCssWidth, pageCssHeight);
    bufferCtx.shadowColor = isDarkTheme ? 'rgba(15, 23, 42, 0.28)' : 'rgba(15, 23, 42, 0.12)';
    bufferCtx.shadowBlur = 30;
    bufferCtx.shadowOffsetY = 10;
    bufferCtx.fillStyle = '#ffffff';
    bufferCtx.fillRect(offsetX, offsetY, pageCssWidth, pageCssHeight);
    bufferCtx.shadowColor = 'transparent';

    const marginLeft = pageCssWidth * (marginBoxPt.left / pageSizePt.width);
    const marginRight = pageCssWidth * (marginBoxPt.right / pageSizePt.width);
    const marginTop = pageCssHeight * (marginBoxPt.top / pageSizePt.height);
    const marginBottom = pageCssHeight * (marginBoxPt.bottom / pageSizePt.height);
    const contentX = offsetX + marginLeft;
    const contentY = offsetY + marginTop;
    const contentWidth = pageCssWidth - marginLeft - marginRight;
    const contentHeight = pageCssHeight - marginTop - marginBottom;

    bufferCtx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
    bufferCtx.setLineDash([10, 8]);
    bufferCtx.strokeRect(contentX, contentY, contentWidth, contentHeight);
    bufferCtx.setLineDash([]);

    const scale = Math.min(contentWidth / sourceViewport.width, contentHeight / sourceViewport.height);
    const drawWidth = sourceViewport.width * scale;
    const drawHeight = sourceViewport.height * scale;
    const drawX = contentX + (contentWidth - drawWidth) / 2;
    const drawY = contentY + (contentHeight - drawHeight) / 2;

    bufferCtx.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);
    bufferCtx.strokeStyle = isDarkTheme ? 'rgba(148, 163, 184, 0.8)' : 'rgba(100, 116, 139, 0.65)';
    bufferCtx.lineWidth = 1;
    bufferCtx.strokeRect(offsetX, offsetY, pageCssWidth, pageCssHeight);
    const hasNegativeMargin = margins.top < 0 || margins.right < 0 || margins.bottom < 0 || margins.left < 0;
    if (!hasNegativeMargin) {
      bufferCtx.fillStyle = isDarkTheme ? '#64748b' : '#475569';
      bufferCtx.font = '13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      bufferCtx.fillText(
        lang === 'zh'
          ? `预览为第 ${previewPageNumber} 页，目标尺寸 ${pageSizeMm.widthMm.toFixed(1)} × ${pageSizeMm.heightMm.toFixed(1)} mm`
          : `Preview page ${previewPageNumber}, target size ${pageSizeMm.widthMm.toFixed(1)} × ${pageSizeMm.heightMm.toFixed(1)} mm`,
        offsetX,
        offsetY + pageCssHeight + 28,
      );
    }
    bufferCtx.restore();

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }

    const screenCtx = canvas.getContext('2d');
    if (!screenCtx) {
      return;
    }
    screenCtx.clearRect(0, 0, canvas.width, canvas.height);
    screenCtx.drawImage(bufferCanvas, 0, 0);
  }, [
    fileBytes,
    lang,
    marginBoxPt,
    margins.bottom,
    margins.left,
    margins.right,
    margins.top,
    pageSizeMm.heightMm,
    pageSizeMm.widthMm,
    pageSizePt.height,
    pageSizePt.width,
    previewPageNumber,
    previewSourceVersion,
    theme,
  ]);

  async function handleDownload() {
    if (!fileBytes) {
      return;
    }

    try {
      setIsRendering(true);
      setStatus(ui.statusOutputting);
      const sourceDoc = await PDFDocument.load(new Uint8Array(fileBytes));
      const outputDoc = await PDFDocument.create();
      const outputWidth = pageSizePt.width;
      const outputHeight = pageSizePt.height;
      const contentWidth = outputWidth - marginBoxPt.left - marginBoxPt.right;
      const contentHeight = outputHeight - marginBoxPt.top - marginBoxPt.bottom;
      const sourcePageCount = sourceDoc.getPageCount();
      const safePageIndices = selectedPageIndices.filter((index) => index >= 0 && index < sourcePageCount);

      if (downloadMode === 'selected' && safePageIndices.length === 0) {
        setStatus(ui.statusPageRangeEmpty);
        return;
      }

      const transformPageWithMargin = (page: PDFPage) => {
        const sourceSize = page.getSize();
        const scale = Math.min(contentWidth / sourceSize.width, contentHeight / sourceSize.height);
        const drawWidth = sourceSize.width * scale;
        const drawHeight = sourceSize.height * scale;
        const x = marginBoxPt.left + (contentWidth - drawWidth) / 2;
        const y = marginBoxPt.bottom + (contentHeight - drawHeight) / 2;
        page.setSize(outputWidth, outputHeight);
        page.scaleContent(scale, scale);
        page.scaleAnnotations(scale, scale);
        page.translateContent(x, y);
      };

      if (downloadMode === 'selected') {
        const copiedPages = await outputDoc.copyPages(sourceDoc, safePageIndices);
        copiedPages.forEach((page) => {
          outputDoc.addPage(page);
          transformPageWithMargin(page);
        });
      } else {
        const allPageIndices = Array.from({ length: sourcePageCount }, (_, index) => index);
        const copiedPages = await outputDoc.copyPages(sourceDoc, allPageIndices);
        const selectedSet = new Set(safePageIndices);
        copiedPages.forEach((page, pageIndex) => {
          outputDoc.addPage(page);
          if (selectedSet.has(pageIndex)) {
            transformPageWithMargin(page);
          }
        });
      }

      const outputBytes = await outputDoc.save();
      const outputBuffer = new ArrayBuffer(outputBytes.byteLength);
      new Uint8Array(outputBuffer).set(outputBytes);
      const blob = new Blob([outputBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const baseName = fileName.replace(/\.pdf$/i, '') || 'output';
      anchor.href = url;
      anchor.download = downloadMode === 'all'
        ? `${baseName}-mixed-margin.pdf`
        : `${baseName}-selected-margin.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(ui.statusDone);
    } catch (error) {
      console.error('Output PDF generation failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      setStatus(ui.statusOutputFail);
      setPreviewError(lang === 'zh' ? `输出 PDF 生成失败：${message}` : `Output PDF generation failed: ${message}`);
    } finally {
      setIsRendering(false);
    }
  }

  function applyUniformMargin(value: number) {
    setMargins({ top: value, right: value, bottom: value, left: value });
  }

  return (
    <div>
      <header className="hero">
        <div>
          <p className="eyebrow">PDF Margin Tool</p>
          <h1>{ui.heroTitle}</h1>
        </div>
        <div className="hero-card">
          <span>{status}</span>
          <strong>{pageCount > 0 ? ui.pagesLoaded(pageCount) : ui.pagesNotLoaded}</strong>
          <button type="button" className="lang-toggle" onClick={onToggleLang}>
            {ui.language}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel controls-panel">
          <div className="panel-header">
            <h2>{ui.panelTitle}</h2>
            <p>{ui.panelDesc}</p>
          </div>

          <label className="file-dropzone">
            <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
            <div>
              <strong>{fileName || ui.choosePdf}</strong>
              <span>{ui.choosePdfHint}</span>
            </div>
          </label>

          <div className="field-grid">
            <label>
              <span>{ui.outputSize}</span>
              <select value={preset} onChange={(event) => setPreset(event.target.value as PagePresetKey)}>
                {Object.entries(PRESETS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {lang === 'en' ? PRESET_LABELS_EN[key as PagePresetKey] : value.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="margin-priority">
              <label>
                <span>{ui.uniformMargin}</span>
                <div className="inline-control">
                  <input
                    type="number"
                    min="-200"
                    step="1"
                    value={margins.top}
                    onChange={(event) => applyUniformMargin(clamp(parseNumber(event.target.value), -200, 200))}
                  />
                  <button type="button" onClick={() => applyUniformMargin(20)}>
                    {ui.useCurrentMargin}
                  </button>
                </div>
              </label>

              <div className="collapsible-section">
                <button
                  type="button"
                  className="collapsible-toggle"
                  onClick={() => setIsPerSideOpen((current) => !current)}
                  aria-expanded={isPerSideOpen}
                >
                  <span>{ui.perSideMargins}</span>
                  <span>{isPerSideOpen ? '−' : '+'}</span>
                </button>
                {isPerSideOpen ? (
                  <div className="field-grid two-up margin-priority-grid collapsible-body">
                    <label>
                      <span>{ui.top}</span>
                      <input
                        type="number"
                        min="-200"
                        step="1"
                        value={margins.top}
                        onChange={(event) => setMargins((current) => ({ ...current, top: clamp(parseNumber(event.target.value), -200, 200) }))}
                      />
                    </label>
                    <label>
                      <span>{ui.right}</span>
                      <input
                        type="number"
                        min="-200"
                        step="1"
                        value={margins.right}
                        onChange={(event) => setMargins((current) => ({ ...current, right: clamp(parseNumber(event.target.value), -200, 200) }))}
                      />
                    </label>
                    <label>
                      <span>{ui.bottom}</span>
                      <input
                        type="number"
                        min="-200"
                        step="1"
                        value={margins.bottom}
                        onChange={(event) => setMargins((current) => ({ ...current, bottom: clamp(parseNumber(event.target.value), -200, 200) }))}
                      />
                    </label>
                    <label>
                      <span>{ui.left}</span>
                      <input
                        type="number"
                        min="-200"
                        step="1"
                        value={margins.left}
                        onChange={(event) => setMargins((current) => ({ ...current, left: clamp(parseNumber(event.target.value), -200, 200) }))}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="collapsible-section">
              <button
                type="button"
                className="collapsible-toggle"
                onClick={() => setIsPageRangeOpen((current) => !current)}
                aria-expanded={isPageRangeOpen}
              >
                <span>{ui.pageRangeSettings}</span>
                <span>{isPageRangeOpen ? '−' : '+'}</span>
              </button>
              {isPageRangeOpen ? (
                <div className="collapsible-body">
                  <label>
                    <span>{ui.pageRange}</span>
                    <input
                      type="text"
                      value={pageRangeInput}
                      placeholder={ui.pageRangePlaceholder}
                      onChange={(event) => setPageRangeInput(event.target.value)}
                    />
                  </label>

                  <div className="range-chip-row" role="group" aria-label={ui.pageRange}>
                    <button type="button" className="range-chip" onClick={() => setPageRangeInput('')}>
                      {ui.allPages}
                    </button>
                    <button type="button" className="range-chip" onClick={() => setPageRangeInput('odd')}>
                      {ui.oddPages}
                    </button>
                    <button type="button" className="range-chip" onClick={() => setPageRangeInput('even')}>
                      {ui.evenPages}
                    </button>
                  </div>

                  <p className="muted-text range-hint">{ui.pageRangeHint}</p>
                </div>
              ) : null}
            </div>

            <div className="collapsible-section">
              <button
                type="button"
                className="collapsible-toggle"
                onClick={() => setIsDownloadScopeOpen((current) => !current)}
                aria-expanded={isDownloadScopeOpen}
              >
                <span>{ui.downloadScopeSettings}</span>
                <span>{isDownloadScopeOpen ? '−' : '+'}</span>
              </button>
              {isDownloadScopeOpen ? (
                <div className="collapsible-body">
                  <label>
                    <span>{ui.downloadScope}</span>
                    <div className="range-chip-row" role="radiogroup" aria-label={ui.downloadScope}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={downloadMode === 'all'}
                        className={`range-chip ${downloadMode === 'all' ? 'active' : ''}`}
                        onClick={() => setDownloadMode('all')}
                      >
                        {ui.downloadAllPages}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={downloadMode === 'selected'}
                        className={`range-chip ${downloadMode === 'selected' ? 'active' : ''}`}
                        onClick={() => setDownloadMode('selected')}
                      >
                        {ui.downloadAdjustedPages}
                      </button>
                    </div>
                  </label>
                </div>
              ) : null}
            </div>

            <p className="muted-text range-hint">{ui.selectedPages(selectedPageIndices.length)}</p>
          </div>

          {preset === 'Custom' ? (
            <div className="field-grid two-up">
              <label>
                <span>{ui.width}</span>
                <input
                  type="number"
                  min="10"
                  step="1"
                  value={customWidthMm}
                  onChange={(event) => setCustomWidthMm(clamp(parseNumber(event.target.value), 10, 1000))}
                />
              </label>
              <label>
                <span>{ui.height}</span>
                <input
                  type="number"
                  min="10"
                  step="1"
                  value={customHeightMm}
                  onChange={(event) => setCustomHeightMm(clamp(parseNumber(event.target.value), 10, 1000))}
                />
              </label>
            </div>
          ) : null}

          <div className="summary-card">
            <div>
              <span>{ui.outputPage}</span>
              <strong>
                {pageSizeMm.widthMm.toFixed(1)} × {pageSizeMm.heightMm.toFixed(1)} mm
              </strong>
            </div>
            <div>
              <span>{ui.contentArea}</span>
              <strong>
                {Math.max(0, pageSizeMm.widthMm - margins.left - margins.right).toFixed(1)} ×{' '}
                {Math.max(0, pageSizeMm.heightMm - margins.top - margins.bottom).toFixed(1)} mm
              </strong>
            </div>
          </div>

          <button className="primary-button" type="button" onClick={handleDownload} disabled={!canProcess || isRendering}>
            {isRendering ? ui.processing : downloadMode === 'all' ? ui.downloadAll : ui.downloadSelected}
          </button>

          {pageRangeError ? <p className="error-text">{pageRangeError}</p> : null}
          {previewError ? <p className="error-text">{previewError}</p> : null}
          {previewScaleInfo ? <p className="muted-text">{previewScaleInfo}</p> : null}
        </section>

        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>{ui.previewTitle}</h2>
            <p>{ui.previewDesc}</p>
          </div>
          <div className="preview-wrap" ref={previewWrapRef}>
            <canvas ref={previewCanvasRef} />
            {!fileBytes ? <div className="empty-state">{ui.previewEmpty}</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
