import { useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type { Theme } from './App';
import lockLockedUrl from './assets/icons/lock-locked.svg?url';
import lockUnlockedUrl from './assets/icons/lock-unlocked.svg?url';
import { checkPasswordException, savePdfWithOptionalEncryption } from './pdfEncryption';

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

type MarginPresetId = 'uniform' | 'right-note' | 'bottom-note' | 'gutter';

type MarginPattern = 'none' | 'ruled' | 'dots' | 'grid';

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
    choosePdf: '点击或拖拽 PDF 文件到此处',
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
    print: '打印',
    contentArea: '可用内容区',
    processing: '处理中...',
    previewTitle: '实时预览',
    previewDesc: '当前设置下的第一页效果。可在预览中拖动页面内容来调整边距。',
    previewPrev: '上一页',
    previewNext: '下一页',
    previewPageCounter: (current: number, total: number) => `${current} / ${total}`,
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
    statusPrintReady: '已打开打印窗口',
    statusOutputFail: '生成失败，请稍后重试',
    rasterizeCanvasFail: '加密 PDF 页面无法渲染为图片',
    statusFileReadFail: '文件读取失败',
    outputSizeInfo: '目标尺寸',
    originalSize: '原始首页尺寸约为',
    pagesLoaded: (pages: number) => `${pages} 页`,
    pagesNotLoaded: '未加载',
    useCurrentMargin: '20 mm',
    passwordTitle: '需要密码解锁 PDF',
    passwordDesc: (name: string) => `“${name}”受密码保护，请输入密码以解锁加载。`,
    passwordPlaceholder: '请输入 PDF 密码',
    passwordUnlock: '解锁',
    passwordCancel: '取消',
    passwordIncorrect: '密码错误，请重新输入。',
    statusPasswordRequired: '等待输入 PDF 密码...',
    keepEncryptionLabel: '保留 PDF 加密（取消勾选则移除加密）',
    quickPresets: '快捷留白',
    presetUniform: '四周均等',
    presetRightNote: '右侧笔记',
    presetBottomNote: '底部笔记',
    presetGutter: '双面装订',
    gutterMirrorHint: '双面装订已启用：偶数页左右边距将自动镜像对调',
    marginPattern: '留白样式',
    patternNone: '空白',
    patternRuled: '横线',
    patternDots: '点阵',
    patternGrid: '方格',
  },
  en: {
    heroTitle: 'Add margins to PDFs and preview the result in real time',
    heroSubtitle: 'Adjust margins and export PDFs.',
    panelTitle: 'Controls',
    panelDesc: 'Upload a file and adjust paper and margins.',
    choosePdf: 'Click or drag a PDF here',
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
    print: 'Print',
    contentArea: 'Available content area',
    processing: 'Processing...',
    previewTitle: 'Live preview',
    previewDesc: 'Preview of the first page with current settings. Drag the page content in preview to adjust margins.',
    previewPrev: 'Prev',
    previewNext: 'Next',
    previewPageCounter: (current: number, total: number) => `${current} / ${total}`,
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
    statusPrintReady: 'Print window opened',
    statusOutputFail: 'Generation failed, please try again later',
    rasterizeCanvasFail: 'Failed to render encrypted PDF page to image',
    statusFileReadFail: 'File read failed',
    outputSizeInfo: 'Target size',
    originalSize: 'Approximate first-page size',
    pagesLoaded: (pages: number) => `${pages} pages`,
    pagesNotLoaded: 'Not loaded',
    useCurrentMargin: '20 mm',
    passwordTitle: 'Password required to unlock PDF',
    passwordDesc: (name: string) => `"${name}" is password-protected. Please enter the password to unlock it.`,
    passwordPlaceholder: 'Enter PDF password',
    passwordUnlock: 'Unlock',
    passwordCancel: 'Cancel',
    passwordIncorrect: 'Incorrect password, please try again.',
    statusPasswordRequired: 'Waiting for PDF password...',
    keepEncryptionLabel: 'Keep PDF encryption (uncheck to remove encryption)',
    quickPresets: 'Quick preset',
    presetUniform: 'Uniform',
    presetRightNote: 'Right note',
    presetBottomNote: 'Bottom note',
    presetGutter: 'Book gutter',
    gutterMirrorHint: 'Book gutter active: left & right margins mirror on even pages',
    marginPattern: 'Margin style',
    patternNone: 'Blank',
    patternRuled: 'Ruled',
    patternDots: 'Dots',
    patternGrid: 'Grid',
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

function parseNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function roundTo4(value: number) {
  return Math.round(value * 10000) / 10000;
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

function getEffectiveMargins(base: MarginState, mirrorGutter: boolean, pageNumber: number): MarginState {
  if (mirrorGutter && pageNumber % 2 === 0) {
    return {
      top: base.top,
      right: base.left,
      bottom: base.bottom,
      left: base.right,
    };
  }
  return base;
}

type PatternGeometry = {
  hLines: Array<{ x1: number; x2: number; y: number }>;
  vLines: Array<{ x: number; y1: number; y2: number }>;
  dots: Array<{ x: number; y: number }>;
};

function computeMarginPatternGeometry(
  widthPt: number,
  heightPt: number,
  effectiveMargins: MarginState,
  pattern: MarginPattern,
): PatternGeometry {
  if (pattern === 'none' || widthPt <= 0 || heightPt <= 0) {
    return { hLines: [], vLines: [], dots: [] };
  }

  const edgePadPt = mmToPt(6);
  const contentGapPt = mmToPt(3.5);
  const minSegPt = mmToPt(6);

  const cLeft = clamp(mmToPt(effectiveMargins.left), 0, widthPt);
  const cRight = clamp(widthPt - mmToPt(effectiveMargins.right), cLeft, widthPt);
  const cTop = clamp(mmToPt(effectiveMargins.top), 0, heightPt);
  const cBottom = clamp(heightPt - mmToPt(effectiveMargins.bottom), cTop, heightPt);

  const hasWideSide =
    effectiveMargins.top >= 14
    || effectiveMargins.right >= 14
    || effectiveMargins.bottom >= 14
    || effectiveMargins.left >= 14;
  const thresholdMm = hasWideSide ? 14 : 5;

  const activeTop = effectiveMargins.top >= thresholdMm;
  const activeRight = effectiveMargins.right >= thresholdMm;
  const activeBottom = effectiveMargins.bottom >= thresholdMm;
  const activeLeft = effectiveMargins.left >= thresholdMm;

  if (!activeTop && !activeRight && !activeBottom && !activeLeft) {
    return { hLines: [], vLines: [], dots: [] };
  }

  const rLeft = activeLeft ? edgePadPt : clamp(cLeft, edgePadPt, widthPt - edgePadPt);
  const rRight = activeRight ? widthPt - edgePadPt : clamp(cRight, rLeft, widthPt - edgePadPt);
  const rTop = activeTop ? edgePadPt : clamp(cTop, edgePadPt, heightPt - edgePadPt);
  const rBottom = activeBottom ? heightPt - edgePadPt : clamp(cBottom, rTop, heightPt - edgePadPt);

  if (rRight - rLeft < minSegPt || rBottom - rTop < minSegPt) {
    return { hLines: [], vLines: [], dots: [] };
  }

  const exLeft = activeLeft ? Math.max(rLeft, cLeft - contentGapPt) : rLeft;
  const exRight = activeRight ? Math.min(rRight, cRight + contentGapPt) : rRight;
  const exTop = activeTop ? Math.max(rTop, cTop - contentGapPt) : rTop;
  const exBottom = activeBottom ? Math.min(rBottom, cBottom + contentGapPt) : rBottom;

  const stepPt = mmToPt(pattern === 'ruled' ? 7 : 5);
  const hLines: PatternGeometry['hLines'] = [];
  const vLines: PatternGeometry['vLines'] = [];
  const dots: PatternGeometry['dots'] = [];

  if (pattern === 'ruled' || pattern === 'grid') {
    const startY = pattern === 'ruled' ? rTop + stepPt : rTop;
    for (let y = startY; y <= rBottom + 0.01; y += stepPt) {
      if (exLeft >= exRight || y <= exTop || y >= exBottom) {
        if (rRight - rLeft >= minSegPt) {
          hLines.push({ x1: rLeft, x2: rRight, y });
        }
      } else {
        if (exLeft - rLeft >= minSegPt) {
          hLines.push({ x1: rLeft, x2: exLeft, y });
        }
        if (rRight - exRight >= minSegPt) {
          hLines.push({ x1: exRight, x2: rRight, y });
        }
      }
    }
  }

  if (pattern === 'grid') {
    for (let x = rLeft; x <= rRight + 0.01; x += stepPt) {
      if (exTop >= exBottom || x <= exLeft || x >= exRight) {
        if (rBottom - rTop >= minSegPt) {
          vLines.push({ x, y1: rTop, y2: rBottom });
        }
      } else {
        if (exTop - rTop >= minSegPt) {
          vLines.push({ x, y1: rTop, y2: exTop });
        }
        if (rBottom - exBottom >= minSegPt) {
          vLines.push({ x, y1: exBottom, y2: rBottom });
        }
      }
    }
  }

  if (pattern === 'dots') {
    for (let y = rTop; y <= rBottom + 0.01; y += stepPt) {
      for (let x = rLeft; x <= rRight + 0.01; x += stepPt) {
        if (exLeft < exRight && exTop < exBottom && x > exLeft && x < exRight && y > exTop && y < exBottom) {
          continue;
        }
        dots.push({ x, y });
      }
    }
  }

  return { hLines, vLines, dots };
}

function drawMarginPatternCanvas(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  pageScale: number,
  widthPt: number,
  heightPt: number,
  effectiveMargins: MarginState,
  pattern: MarginPattern,
) {
  const geom = computeMarginPatternGeometry(widthPt, heightPt, effectiveMargins, pattern);
  if (geom.hLines.length === 0 && geom.vLines.length === 0 && geom.dots.length === 0) {
    return;
  }

  ctx.save();
  if (geom.hLines.length > 0 || geom.vLines.length > 0) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.52)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const seg of geom.hLines) {
      const y = offsetY + seg.y * pageScale;
      ctx.moveTo(offsetX + seg.x1 * pageScale, y);
      ctx.lineTo(offsetX + seg.x2 * pageScale, y);
    }
    for (const seg of geom.vLines) {
      const x = offsetX + seg.x * pageScale;
      ctx.moveTo(x, offsetY + seg.y1 * pageScale);
      ctx.lineTo(x, offsetY + seg.y2 * pageScale);
    }
    ctx.stroke();
  }

  if (geom.dots.length > 0) {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
    const radius = Math.max(1.05, 0.85 * pageScale);
    ctx.beginPath();
    for (const dot of geom.dots) {
      const cx = offsetX + dot.x * pageScale;
      const cy = offsetY + dot.y * pageScale;
      ctx.moveTo(cx + radius, cy);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawMarginPatternPdf(
  page: PDFPage,
  widthPt: number,
  heightPt: number,
  effectiveMargins: MarginState,
  pattern: MarginPattern,
) {
  const geom = computeMarginPatternGeometry(widthPt, heightPt, effectiveMargins, pattern);
  if (geom.hLines.length === 0 && geom.vLines.length === 0 && geom.dots.length === 0) {
    return;
  }

  page.resetPosition();
  const lineColor = rgb(0.78, 0.82, 0.87);
  const dotColor = rgb(0.66, 0.72, 0.79);

  for (const seg of geom.hLines) {
    const pdfY = heightPt - seg.y;
    page.drawLine({
      start: { x: seg.x1, y: pdfY },
      end: { x: seg.x2, y: pdfY },
      thickness: 0.45,
      color: lineColor,
    });
  }

  for (const seg of geom.vLines) {
    page.drawLine({
      start: { x: seg.x, y: heightPt - seg.y1 },
      end: { x: seg.x, y: heightPt - seg.y2 },
      thickness: 0.45,
      color: lineColor,
    });
  }

  for (const dot of geom.dots) {
    page.drawCircle({
      x: dot.x,
      y: heightPt - dot.y,
      size: 0.72,
      color: dotColor,
    });
  }
}

async function loadPagePreview(bytes: Uint8Array, pageNumber: number, password?: string) {
  const pdf = await getDocument({
    data: bytes,
    ...(password ? { password } : {}),
  }).promise;
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
  onPdfLoadedChange: (loaded: boolean) => void;
};

export default function MarginTool({ lang, onToggleLang, theme, onPdfLoadedChange }: MarginToolProps) {
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
  const [isMirrorGutter, setIsMirrorGutter] = useState(false);
  const [marginPattern, setMarginPattern] = useState<MarginPattern>('none');
  const [isRendering, setIsRendering] = useState(false);
  const [status, setStatus] = useState('等待上传 PDF');
  const [previewError, setPreviewError] = useState('');
  const [previewSourceVersion, setPreviewSourceVersion] = useState(0);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [isDragOverPreview, setIsDragOverPreview] = useState(false);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [isDragLocked, setIsDragLocked] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [isPdfEncrypted, setIsPdfEncrypted] = useState(false);
  const [keepEncryption, setKeepEncryption] = useState(true);
  const [pendingFile, setPendingFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceViewportRef = useRef<{ width: number; height: number } | null>(null);
  const previewLayoutRef = useRef<{
    pageCssWidth: number;
    pageCssHeight: number;
    contentX: number;
    contentY: number;
    contentWidth: number;
    contentHeight: number;
    pageSizeMmWidth: number;
    pageSizeMmHeight: number;
  } | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startMargins: MarginState;
  } | null>(null);
  const ui = COPY[lang];

  useEffect(() => {
    onPdfLoadedChange(Boolean(fileBytes));
  }, [fileBytes, onPdfLoadedChange]);

  function isExternalFileDrag(event: React.DragEvent<HTMLElement>) {
    const types = Array.from(event.dataTransfer?.types ?? []);
    return types.includes('Files');
  }

  const pageSizeMm = useMemo(
    () => getPageSizeMm(preset, customWidthMm, customHeightMm, originalWidthMm, originalHeightMm),
    [preset, customWidthMm, customHeightMm, originalWidthMm, originalHeightMm],
  );

  const pageSizePt = useMemo(
    () => ({ width: mmToPt(pageSizeMm.widthMm), height: mmToPt(pageSizeMm.heightMm) }),
    [pageSizeMm],
  );

  const pageRangeResult = useMemo(() => parsePageRange(pageRangeInput, pageCount), [pageRangeInput, pageCount]);
  const selectedPageIndices = pageRangeResult.indices;
  const activePreviewIndex =
    selectedPageIndices.length === 0
      ? 0
      : Math.min(previewPageIndex, selectedPageIndices.length - 1);
  const previewPageNumber = selectedPageIndices.length > 0 ? selectedPageIndices[activePreviewIndex] + 1 : 1;

  const previewMargins = useMemo(
    () => getEffectiveMargins(margins, isMirrorGutter, previewPageNumber),
    [margins, isMirrorGutter, previewPageNumber],
  );

  const previewMarginBoxPt = useMemo(
    () => ({
      top: mmToPt(previewMargins.top),
      right: mmToPt(previewMargins.right),
      bottom: mmToPt(previewMargins.bottom),
      left: mmToPt(previewMargins.left),
    }),
    [previewMargins],
  );

  const activeMarginPreset = useMemo<MarginPresetId | null>(() => {
    if (isMirrorGutter) {
      return 'gutter';
    }
    if (margins.top === 20 && margins.right === 20 && margins.bottom === 20 && margins.left === 20) {
      return 'uniform';
    }
    if (margins.top === 12 && margins.right === 65 && margins.bottom === 12 && margins.left === 12) {
      return 'right-note';
    }
    if (margins.top === 12 && margins.right === 12 && margins.bottom === 75 && margins.left === 12) {
      return 'bottom-note';
    }
    return null;
  }, [isMirrorGutter, margins]);
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
  const canDragPreview = Boolean(fileBytes && selectedPageIndices.length > 0) && !isDragLocked;

  async function tryLoadMarginBytes(name: string, bytes: Uint8Array, password = '') {
    try {
      const previewBytes = new Uint8Array(bytes);
      const pdf = await getDocument({
        data: previewBytes,
        ...(password ? { password } : {}),
      }).promise;
      let docEncrypted = Boolean(password);
      if (!docEncrypted) {
        try {
          const checkDoc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
          docEncrypted = checkDoc.isEncrypted;
        } catch {
          // ignore
        }
      }
      const firstPage = await pdf.getPage(1);
      const size = firstPage.getViewport({ scale: 1 });
      setFileName(name);
      setFileBytes(bytes);
      setPdfPassword(password);
      setIsPdfEncrypted(docEncrypted);
      setKeepEncryption(true);
      setPageCount(pdf.numPages);
      setPageRangeInput('');
      setPreviewPageIndex(0);
      setOriginalWidthMm(ptToMm(size.width));
      setOriginalHeightMm(ptToMm(size.height));
      setPendingFile(null);
      setPasswordInput('');
      setPasswordError('');
      setStatus(ui.statusLoaded(pdf.numPages));
      await pdf.destroy();
    } catch (error) {
      const pwCheck = checkPasswordException(error);
      if (pwCheck.isPasswordException) {
        setPendingFile({ name, bytes });
        if (password || pwCheck.isIncorrectPassword) {
          setPasswordError(ui.passwordIncorrect);
        } else {
          setPasswordError('');
          setPasswordInput('');
        }
        setStatus(ui.statusPasswordRequired);
        return;
      }
      setPendingFile(null);
      setPasswordInput('');
      setPasswordError('');
      setFileBytes(null);
      setPdfPassword('');
      setIsPdfEncrypted(false);
      setPageCount(0);
      setFileName('');
      setPreviewError(lang === 'zh' ? 'PDF 读取失败，请重新选择文件。' : 'PDF failed to load. Please choose another file.');
      setStatus(ui.statusFileReadFail);
    }
  }

  async function loadMarginFile(file: File) {
    if (!file) {
      return;
    }

    setStatus(ui.statusReading);
    setPreviewError('');

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await tryLoadMarginBytes(file.name, bytes, '');
    } catch {
      setFileBytes(null);
      setPageCount(0);
      setFileName('');
      setPreviewError(lang === 'zh' ? 'PDF 读取失败，请重新选择文件。' : 'PDF failed to load. Please choose another file.');
      setStatus(ui.statusFileReadFail);
    }
  }

  async function handleUnlockSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingFile || isUnlocking) {
      return;
    }
    if (!passwordInput) {
      setPasswordError(ui.passwordIncorrect);
      return;
    }
    setIsUnlocking(true);
    try {
      await tryLoadMarginBytes(pendingFile.name, pendingFile.bytes, passwordInput);
    } finally {
      setIsUnlocking(false);
    }
  }

  function handleUnlockCancel() {
    setPendingFile(null);
    setPasswordInput('');
    setPasswordError('');
    setStatus(fileBytes ? ui.statusPreviewReady(pageCount) : ui.statusWaiting);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    await loadMarginFile(file);
  }

  async function handlePreviewDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOverPreview(false);
    if (!isExternalFileDrag(event)) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      return;
    }
    await loadMarginFile(file);
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
        previewLayoutRef.current = null;
        setStatus(ui.statusWaiting);
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
        previewLayoutRef.current = null;
        setStatus(ui.statusPageRangeEmpty);
        return;
      }

      setIsRendering(true);
      setPreviewError('');

      try {
        const { pdf, page } = await loadPagePreview(new Uint8Array(fileBytes), previewPageNumber, pdfPassword);
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
    pdfPassword,
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

    const horizontalPadding = 32;
    const verticalPadding = 32;
    const containerWidth = clamp((container.clientWidth || 900) - horizontalPadding, 280, 1068);
    const containerHeight = Math.max(360, (container.clientHeight || 620) - verticalPadding);
    const cssHeight = containerHeight;
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

    const hasNegativeMargin =
      previewMargins.top < 0 || previewMargins.right < 0 || previewMargins.bottom < 0 || previewMargins.left < 0;
    const captionSpace = 34;
    const pageMaxWidth = Math.max(260, containerWidth - 64);
    const pageMaxHeight = Math.max(220, containerHeight - 44 - captionSpace);
    const pageScale = Math.min(pageMaxWidth / pageSizePt.width, pageMaxHeight / pageSizePt.height);
    const pageCssWidth = pageSizePt.width * pageScale;
    const pageCssHeight = pageSizePt.height * pageScale;
    const offsetX = (containerWidth - pageCssWidth) / 2;
    const offsetY = Math.max(16, (containerHeight - pageCssHeight - captionSpace) / 2);

    bufferCtx.fillStyle = '#ffffff';
    bufferCtx.fillRect(offsetX, offsetY, pageCssWidth, pageCssHeight);
    bufferCtx.shadowColor = isDarkTheme ? 'rgba(15, 23, 42, 0.28)' : 'rgba(15, 23, 42, 0.12)';
    bufferCtx.shadowBlur = 30;
    bufferCtx.shadowOffsetY = 10;
    bufferCtx.fillStyle = '#ffffff';
    bufferCtx.fillRect(offsetX, offsetY, pageCssWidth, pageCssHeight);
    bufferCtx.shadowColor = 'transparent';

    drawMarginPatternCanvas(
      bufferCtx,
      offsetX,
      offsetY,
      pageScale,
      pageSizePt.width,
      pageSizePt.height,
      previewMargins,
      marginPattern,
    );

    const marginLeft = pageCssWidth * (previewMarginBoxPt.left / pageSizePt.width);
    const marginRight = pageCssWidth * (previewMarginBoxPt.right / pageSizePt.width);
    const marginTop = pageCssHeight * (previewMarginBoxPt.top / pageSizePt.height);
    const marginBottom = pageCssHeight * (previewMarginBoxPt.bottom / pageSizePt.height);
    const contentX = offsetX + marginLeft;
    const contentY = offsetY + marginTop;
    const contentWidth = pageCssWidth - marginLeft - marginRight;
    const contentHeight = pageCssHeight - marginTop - marginBottom;
    previewLayoutRef.current = {
      pageCssWidth,
      pageCssHeight,
      contentX,
      contentY,
      contentWidth,
      contentHeight,
      pageSizeMmWidth: pageSizeMm.widthMm,
      pageSizeMmHeight: pageSizeMm.heightMm,
    };

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
    if (!hasNegativeMargin) {
      bufferCtx.fillStyle = isDarkTheme ? '#64748b' : '#475569';
      bufferCtx.font = '13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      bufferCtx.fillText(
        lang === 'zh'
          ? `预览为第 ${previewPageNumber} 页，目标尺寸 ${pageSizeMm.widthMm.toFixed(1)} × ${pageSizeMm.heightMm.toFixed(1)} mm`
          : `Preview page ${previewPageNumber}, target size ${pageSizeMm.widthMm.toFixed(1)} × ${pageSizeMm.heightMm.toFixed(1)} mm`,
        offsetX,
        Math.min(containerHeight - 12, offsetY + pageCssHeight + 24),
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
    marginPattern,
    pageSizeMm.heightMm,
    pageSizeMm.widthMm,
    pageSizePt.height,
    pageSizePt.width,
    previewMarginBoxPt,
    previewMargins,
    previewPageNumber,
    previewSourceVersion,
    theme,
  ]);

  type PdfDocProxy = Awaited<ReturnType<typeof getDocument>['promise']>;

  async function rasterizeSourcePage(pdfjsDoc: PdfDocProxy, pageIndex: number, outputDoc: PDFDocument) {
    const pdfjsPage = await pdfjsDoc.getPage(pageIndex + 1);
    const renderScale = 2.5;
    const viewport = pdfjsPage.getViewport({ scale: renderScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(ui.rasterizeCanvasFail);
    }
    await pdfjsPage
      .render({ canvasContext: ctx, viewport } as Parameters<typeof pdfjsPage.render>[0])
      .promise;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] ?? '';
    const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const image = await outputDoc.embedPng(pngBytes);
    const baseViewport = pdfjsPage.getViewport({ scale: 1 });
    return { image, width: baseViewport.width, height: baseViewport.height };
  }

  async function buildMarginPdf(options?: { forPrint?: boolean }): Promise<Uint8Array | null> {
    if (!fileBytes) {
      return null;
    }

    let sourceDoc: PDFDocument | null = null;
    let encrypted = isPdfEncrypted;
    try {
      sourceDoc = await PDFDocument.load(new Uint8Array(fileBytes), { ignoreEncryption: true });
      if (sourceDoc.isEncrypted) {
        encrypted = true;
      }
    } catch {
      encrypted = true;
    }

    const outputDoc = await PDFDocument.create();
    const outputWidth = pageSizePt.width;
    const outputHeight = pageSizePt.height;

    const getPageMarginGeometry = (pageIndex: number) => {
      const effMargins = getEffectiveMargins(margins, isMirrorGutter, pageIndex + 1);
      const effMarginBoxPt = {
        top: mmToPt(effMargins.top),
        right: mmToPt(effMargins.right),
        bottom: mmToPt(effMargins.bottom),
        left: mmToPt(effMargins.left),
      };
      const contentWidth = outputWidth - effMarginBoxPt.left - effMarginBoxPt.right;
      const contentHeight = outputHeight - effMarginBoxPt.top - effMarginBoxPt.bottom;
      return { effMargins, effMarginBoxPt, contentWidth, contentHeight };
    };

    const transformPageWithMargin = (page: PDFPage, pageIndex: number) => {
      const { effMargins, effMarginBoxPt, contentWidth, contentHeight } = getPageMarginGeometry(pageIndex);
      const sourceSize = page.getSize();
      const scale = Math.min(contentWidth / sourceSize.width, contentHeight / sourceSize.height);
      const drawWidth = sourceSize.width * scale;
      const drawHeight = sourceSize.height * scale;
      const x = effMarginBoxPt.left + (contentWidth - drawWidth) / 2;
      const y = effMarginBoxPt.bottom + (contentHeight - drawHeight) / 2;
      page.setSize(outputWidth, outputHeight);
      page.scaleContent(scale, scale);
      page.scaleAnnotations(scale, scale);
      page.translateContent(x, y);
      drawMarginPatternPdf(page, outputWidth, outputHeight, effMargins, marginPattern);
    };

    if (encrypted || !sourceDoc) {
      const pdfjsDoc = await getDocument({
        data: new Uint8Array(fileBytes),
        ...(pdfPassword ? { password: pdfPassword } : {}),
      }).promise;
      const sourcePageCount = pdfjsDoc.numPages;
      const safePageIndices = selectedPageIndices.filter((index) => index >= 0 && index < sourcePageCount);
      if (downloadMode === 'selected' && safePageIndices.length === 0) {
        await pdfjsDoc.destroy();
        return null;
      }

      const drawImageWithMargin = (
        page: PDFPage,
        image: Awaited<ReturnType<typeof outputDoc.embedPng>>,
        srcWidth: number,
        srcHeight: number,
        pageIndex: number,
      ) => {
        const { effMargins, effMarginBoxPt, contentWidth, contentHeight } = getPageMarginGeometry(pageIndex);
        drawMarginPatternPdf(page, outputWidth, outputHeight, effMargins, marginPattern);
        const scale = Math.min(contentWidth / srcWidth, contentHeight / srcHeight);
        const drawWidth = srcWidth * scale;
        const drawHeight = srcHeight * scale;
        const x = effMarginBoxPt.left + (contentWidth - drawWidth) / 2;
        const y = effMarginBoxPt.bottom + (contentHeight - drawHeight) / 2;
        page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
      };

      try {
        if (downloadMode === 'selected') {
          for (const index of safePageIndices) {
            const { image, width, height } = await rasterizeSourcePage(pdfjsDoc, index, outputDoc);
            const page = outputDoc.addPage([outputWidth, outputHeight]);
            drawImageWithMargin(page, image, width, height, index);
          }
        } else {
          const selectedSet = new Set(safePageIndices);
          for (let index = 0; index < sourcePageCount; index += 1) {
            const { image, width, height } = await rasterizeSourcePage(pdfjsDoc, index, outputDoc);
            if (selectedSet.has(index)) {
              const page = outputDoc.addPage([outputWidth, outputHeight]);
              drawImageWithMargin(page, image, width, height, index);
            } else {
              const page = outputDoc.addPage([width, height]);
              page.drawImage(image, { x: 0, y: 0, width, height });
            }
          }
        }
      } finally {
        try {
          await pdfjsDoc.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
    } else {
      const sourcePageCount = sourceDoc.getPageCount();
      const safePageIndices = selectedPageIndices.filter((index) => index >= 0 && index < sourcePageCount);
      if (downloadMode === 'selected' && safePageIndices.length === 0) {
        return null;
      }
      if (downloadMode === 'selected') {
        const copiedPages = await outputDoc.copyPages(sourceDoc, safePageIndices);
        copiedPages.forEach((page, i) => {
          outputDoc.addPage(page);
          transformPageWithMargin(page, safePageIndices[i] ?? i);
        });
      } else {
        const allPageIndices = Array.from({ length: sourcePageCount }, (_, index) => index);
        const copiedPages = await outputDoc.copyPages(sourceDoc, allPageIndices);
        const selectedSet = new Set(safePageIndices);
        copiedPages.forEach((page, pageIndex) => {
          outputDoc.addPage(page);
          if (selectedSet.has(pageIndex)) {
            transformPageWithMargin(page, pageIndex);
          }
        });
      }
    }

    const shouldEncrypt = !options?.forPrint && encrypted && keepEncryption;
    return savePdfWithOptionalEncryption(
      outputDoc,
      shouldEncrypt ? { encryptPassword: pdfPassword } : undefined,
    );
  }

  async function handleDownload() {
    if (!fileBytes) {
      return;
    }

    try {
      setIsRendering(true);
      setStatus(ui.statusOutputting);
      const outputBytes = await buildMarginPdf();
      if (!outputBytes) {
        setStatus(ui.statusPageRangeEmpty);
        return;
      }
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

  async function handlePrint() {
    if (!fileBytes) {
      return;
    }

    try {
      setIsRendering(true);
      setStatus(ui.statusOutputting);
      const outputBytes = await buildMarginPdf({ forPrint: true });
      if (!outputBytes) {
        setStatus(ui.statusPageRangeEmpty);
        return;
      }
      const outputBuffer = new ArrayBuffer(outputBytes.byteLength);
      new Uint8Array(outputBuffer).set(outputBytes);
      const blob = new Blob([outputBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.focus();
          printWindow.print();
        });
      }
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
      setStatus(ui.statusPrintReady);
    } catch (error) {
      console.error('Print PDF generation failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      setStatus(ui.statusOutputFail);
      setPreviewError(lang === 'zh' ? `打印 PDF 生成失败：${message}` : `Print PDF generation failed: ${message}`);
    } finally {
      setIsRendering(false);
    }
  }

  function applyUniformMargin(value: number) {
    setIsMirrorGutter(false);
    setMargins({ top: value, right: value, bottom: value, left: value });
  }

  function applyMarginPreset(presetId: MarginPresetId) {
    switch (presetId) {
      case 'uniform':
        setIsMirrorGutter(false);
        setMargins({ top: 20, right: 20, bottom: 20, left: 20 });
        break;
      case 'right-note':
        setIsMirrorGutter(false);
        setMargins({ top: 12, right: 65, bottom: 12, left: 12 });
        break;
      case 'bottom-note':
        setIsMirrorGutter(false);
        setMargins({ top: 12, right: 12, bottom: 75, left: 12 });
        break;
      case 'gutter':
        setIsMirrorGutter(true);
        setMargins({ top: 15, right: 12, bottom: 15, left: 32 });
        break;
    }
  }

  function handlePreviewPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canDragPreview) {
      return;
    }
    const layout = previewLayoutRef.current;
    if (!layout) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const insideContent =
      x >= layout.contentX
      && x <= layout.contentX + layout.contentWidth
      && y >= layout.contentY
      && y <= layout.contentY + layout.contentHeight;

    if (!insideContent) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startMargins: { ...margins },
    };
    setIsPreviewDragging(true);
  }

  function handlePreviewPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    const layout = previewLayoutRef.current;
    if (!dragState || !layout || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    const deltaMmX = (deltaX / layout.pageCssWidth) * layout.pageSizeMmWidth;
    const deltaMmY = (deltaY / layout.pageCssHeight) * layout.pageSizeMmHeight;
    const isMirroredPage = isMirrorGutter && previewPageNumber % 2 === 0;
    const horizontalDelta = isMirroredPage ? -deltaMmX : deltaMmX;

    setMargins({
      top: roundTo4(clamp(dragState.startMargins.top + deltaMmY, -200, 200)),
      right: roundTo4(clamp(dragState.startMargins.right - horizontalDelta, -200, 200)),
      bottom: roundTo4(clamp(dragState.startMargins.bottom - deltaMmY, -200, 200)),
      left: roundTo4(clamp(dragState.startMargins.left + horizontalDelta, -200, 200)),
    });
  }

  function endPreviewDrag(pointerId: number, target: HTMLDivElement) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }
    dragStateRef.current = null;
    setIsPreviewDragging(false);
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  }

  useEffect(() => {
    setPreviewPageIndex(0);
  }, [pageRangeInput, pageCount]);

  function handlePreviewPrev() {
    setPreviewPageIndex((current) => Math.max(0, current - 1));
  }

  function handlePreviewNext() {
    setPreviewPageIndex((current) => Math.min(Math.max(0, selectedPageIndices.length - 1), current + 1));
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
            </div>
          </label>

          <div className="field-grid">
            <label className="single-line-control aligned-with-margin">
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
              <div className="single-line-control margin-preset-row">
                <span>{ui.quickPresets}</span>
                <div className="range-chip-row margin-preset-chips" role="group" aria-label={ui.quickPresets}>
                  <button
                    type="button"
                    className={`range-chip ${activeMarginPreset === 'uniform' ? 'active' : ''}`}
                    onClick={() => applyMarginPreset('uniform')}
                  >
                    {ui.presetUniform}
                  </button>
                  <button
                    type="button"
                    className={`range-chip ${activeMarginPreset === 'right-note' ? 'active' : ''}`}
                    onClick={() => applyMarginPreset('right-note')}
                  >
                    {ui.presetRightNote}
                  </button>
                  <button
                    type="button"
                    className={`range-chip ${activeMarginPreset === 'bottom-note' ? 'active' : ''}`}
                    onClick={() => applyMarginPreset('bottom-note')}
                  >
                    {ui.presetBottomNote}
                  </button>
                  <button
                    type="button"
                    className={`range-chip ${activeMarginPreset === 'gutter' ? 'active' : ''}`}
                    onClick={() => applyMarginPreset('gutter')}
                  >
                    {ui.presetGutter}
                  </button>
                </div>
              </div>
              {isMirrorGutter ? <p className="range-hint muted-text margin-gutter-hint">{ui.gutterMirrorHint}</p> : null}

              <div className="single-line-control margin-preset-row">
                <span>{ui.marginPattern}</span>
                <div className="range-chip-row margin-pattern-chips" role="group" aria-label={ui.marginPattern}>
                  <button
                    type="button"
                    className={`range-chip ${marginPattern === 'none' ? 'active' : ''}`}
                    onClick={() => setMarginPattern('none')}
                  >
                    {ui.patternNone}
                  </button>
                  <button
                    type="button"
                    className={`range-chip ${marginPattern === 'ruled' ? 'active' : ''}`}
                    onClick={() => setMarginPattern('ruled')}
                  >
                    {ui.patternRuled}
                  </button>
                  <button
                    type="button"
                    className={`range-chip ${marginPattern === 'dots' ? 'active' : ''}`}
                    onClick={() => setMarginPattern('dots')}
                  >
                    {ui.patternDots}
                  </button>
                  <button
                    type="button"
                    className={`range-chip ${marginPattern === 'grid' ? 'active' : ''}`}
                    onClick={() => setMarginPattern('grid')}
                  >
                    {ui.patternGrid}
                  </button>
                </div>
              </div>

              <label className="single-line-control">
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

          {fileBytes && isPdfEncrypted ? (
            <label className="encryption-checkbox-row">
              <input
                type="checkbox"
                checked={keepEncryption}
                onChange={(event) => setKeepEncryption(event.target.checked)}
              />
              <span>{ui.keepEncryptionLabel}</span>
            </label>
          ) : null}

          <div className="action-row margin-action-row">
            <button className="primary-button" type="button" onClick={handleDownload} disabled={!canProcess || isRendering}>
              {isRendering ? ui.processing : downloadMode === 'all' ? ui.downloadAll : ui.downloadSelected}
            </button>
            <button className="secondary-button print-button" type="button" onClick={handlePrint} disabled={!canProcess || isRendering}>
              <svg viewBox="0 0 24 24" className="print-icon" aria-hidden="true">
                <path
                  d="M7 3h10a1 1 0 0 1 1 1v4H6V4a1 1 0 0 1 1-1zm0 14h10v4a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-4zm-2-7h14a3 3 0 0 1 3 3v4a1 1 0 0 1-1 1h-2v-3H5v3H3a1 1 0 0 1-1-1v-4a3 3 0 0 1 3-3zm13 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
                  fill="currentColor"
                />
              </svg>
              <span className="print-label">{ui.print}</span>
            </button>
          </div>

          {pageRangeError ? <p className="error-text">{pageRangeError}</p> : null}
          {previewError ? <p className="error-text">{previewError}</p> : null}
        </section>

        <section className="panel preview-panel margin-preview-panel">
          <div className="panel-header">
            <div className="preview-header-row">
              <h2>{ui.previewTitle}</h2>
              <div className="preview-nav" role="group" aria-label={ui.previewTitle}>
                <button
                  type="button"
                  className="range-chip icon-text-chip"
                  onClick={handlePreviewPrev}
                  disabled={selectedPageIndices.length === 0 || activePreviewIndex <= 0}
                  title={ui.previewPrev}
                >
                  <svg viewBox="0 0 24 24" className="chip-icon" aria-hidden="true">
                    <path d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0z" fill="currentColor" />
                  </svg>
                  <span className="chip-label">{ui.previewPrev}</span>
                </button>
                <span className="preview-counter">
                  {selectedPageIndices.length === 0
                    ? ui.previewPageCounter(0, 0)
                    : ui.previewPageCounter(activePreviewIndex + 1, selectedPageIndices.length)}
                </span>
                <button
                  type="button"
                  className="range-chip icon-text-chip"
                  onClick={handlePreviewNext}
                  disabled={selectedPageIndices.length === 0 || activePreviewIndex >= selectedPageIndices.length - 1}
                  title={ui.previewNext}
                >
                  <svg viewBox="0 0 24 24" className="chip-icon" aria-hidden="true">
                    <path d="M9.3 5.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4l5.3-5.3-5.3-5.3a1 1 0 0 1 0-1.4z" fill="currentColor" />
                  </svg>
                  <span className="chip-label">{ui.previewNext}</span>
                </button>
              </div>
            </div>
            <p>{ui.previewDesc}</p>
          </div>
          <div
            className={`preview-wrap margin-preview-wrap ${isDragOverPreview ? 'is-drag-over' : ''} ${canDragPreview ? 'is-draggable' : ''} ${isPreviewDragging ? 'is-pointer-dragging' : ''}`}
            ref={previewWrapRef}
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={(event) => endPreviewDrag(event.pointerId, event.currentTarget)}
            onPointerCancel={(event) => endPreviewDrag(event.pointerId, event.currentTarget)}
            onDragOver={(event) => {
              event.preventDefault();
              if (isExternalFileDrag(event) && !isDragOverPreview) {
                setIsDragOverPreview(true);
              }
            }}
            onDragLeave={(event) => {
              if (!isExternalFileDrag(event)) {
                return;
              }
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && event.currentTarget.contains(nextTarget)) {
                return;
              }
              setIsDragOverPreview(false);
            }}
            onDrop={handlePreviewDrop}
          >
            {fileBytes ? (
              <button
                type="button"
                className={`preview-lock-button ${isDragLocked ? 'is-locked' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDragLocked((current) => !current);
                }}
                aria-label={isDragLocked ? 'Unlock drag' : 'Lock drag'}
                title={isDragLocked ? 'Unlock drag' : 'Lock drag'}
              >
                <img
                  src={isDragLocked ? lockLockedUrl : lockUnlockedUrl}
                  alt=""
                  className="preview-lock-icon"
                  draggable={false}
                />
              </button>
            ) : null}
            <canvas ref={previewCanvasRef} />
            {!fileBytes ? <div className="empty-state">{ui.previewEmpty}</div> : null}
          </div>
        </section>
      </main>

      {pendingFile ? (
        <div className="password-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="margin-password-title">
          <form className="password-modal" onSubmit={handleUnlockSubmit}>
            <h3 id="margin-password-title">{ui.passwordTitle}</h3>
            <p>{ui.passwordDesc(pendingFile.name)}</p>
            <input
              type="password"
              value={passwordInput}
              placeholder={ui.passwordPlaceholder}
              onChange={(event) => {
                setPasswordInput(event.target.value);
                if (passwordError) {
                  setPasswordError('');
                }
              }}
              autoFocus
            />
            {passwordError ? <p className="error-text">{passwordError}</p> : null}
            <div className="password-modal-actions">
              <button type="button" className="secondary-button" onClick={handleUnlockCancel} disabled={isUnlocking}>
                {ui.passwordCancel}
              </button>
              <button type="submit" className="primary-button" disabled={isUnlocking}>
                {isUnlocking ? ui.processing : ui.passwordUnlock}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
