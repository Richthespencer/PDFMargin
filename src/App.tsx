import { useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

type PagePresetKey = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';

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

type Lang = 'zh' | 'en';

const MM_TO_PT = 72 / 25.4;
const PRESETS: Record<PagePresetKey, PagePreset> = {
  A4: { label: 'A4', widthMm: 210, heightMm: 297 },
  A3: { label: 'A3', widthMm: 297, heightMm: 420 },
  A5: { label: 'A5', widthMm: 148, heightMm: 210 },
  Letter: { label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  Legal: { label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
  Tabloid: { label: 'Tabloid', widthMm: 279.4, heightMm: 431.8 },
  Custom: { label: '自定义', widthMm: 210, heightMm: 297 },
};

const PRESET_LABELS_EN: Record<PagePresetKey, string> = {
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
    uniformMargin: '统一边距',
    width: '宽度（mm）',
    height: '高度（mm）',
    top: '上边距（mm）',
    right: '右边距（mm）',
    bottom: '下边距（mm）',
    left: '左边距（mm）',
    outputPage: '输出页面',
    contentArea: '可用内容区',
    download: '下载处理后的 PDF',
    processing: '处理中...',
    previewTitle: '实时预览',
    previewDesc: '当前设置下的第一页效果。',
    previewEmpty: '上传 PDF 后即可查看实时预览',
    language: 'English',
    statusWaiting: '等待上传 PDF',
    statusReading: '正在读取文件...',
    statusLoaded: (pages: number) => `已加载 ${pages} 页，正在生成预览...`,
    statusPreviewReady: (pages: number) => `已加载 ${pages} 页，预览已就绪`,
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
    heroSubtitle: 'Supports common paper sizes, live first-page preview, and custom margins for quick layout adjustments.',
    panelTitle: 'Controls',
    panelDesc: 'Upload a file and adjust paper and margins.',
    choosePdf: 'Click to choose a PDF',
    choosePdfHint: 'Select a local PDF to generate the preview immediately.',
    outputSize: 'Output size',
    uniformMargin: 'Uniform margin',
    width: 'Width (mm)',
    height: 'Height (mm)',
    top: 'Top margin (mm)',
    right: 'Right margin (mm)',
    bottom: 'Bottom margin (mm)',
    left: 'Left margin (mm)',
    outputPage: 'Output page',
    contentArea: 'Available content area',
    download: 'Download processed PDF',
    processing: 'Processing...',
    previewTitle: 'Live preview',
    previewDesc: 'Preview of the first page with current settings.',
    previewEmpty: 'Upload a PDF to see the live preview',
    language: '中文',
    statusWaiting: 'Waiting for a PDF',
    statusReading: 'Reading file...',
    statusLoaded: (pages: number) => `Loaded ${pages} pages, generating preview...`,
    statusPreviewReady: (pages: number) => `Loaded ${pages} pages, preview ready`,
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

function getPageSizeMm(preset: PagePresetKey, customWidthMm: number, customHeightMm: number) {
  if (preset === 'Custom') {
    return { widthMm: customWidthMm, heightMm: customHeightMm };
  }
  const selected = PRESETS[preset];
  return { widthMm: selected.widthMm, heightMm: selected.heightMm };
}

async function loadFirstPagePreview(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  return { pdf, page };
}

export default function App() {
  const [lang, setLang] = useState<Lang>('zh');
  const [fileName, setFileName] = useState('');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [preset, setPreset] = useState<PagePresetKey>('A4');
  const [customWidthMm, setCustomWidthMm] = useState(210);
  const [customHeightMm, setCustomHeightMm] = useState(297);
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

  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ui = COPY[lang];

  const pageSizeMm = useMemo(
    () => getPageSizeMm(preset, customWidthMm, customHeightMm),
    [preset, customWidthMm, customHeightMm],
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

  const canProcess = Boolean(fileBytes && pageCount > 0);

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
      const firstPage = await pdf.getPage(1);
      const size = firstPage.getViewport({ scale: 1 });
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
    const container = previewWrapRef.current;
    if (!canvas || !container) {
      return;
    }

    let cancelled = false;
    const render = async () => {
      if (!fileBytes) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 1;
          canvas.height = 1;
          ctx.clearRect(0, 0, 1, 1);
        }
        setStatus(ui.statusWaiting);
        setPreviewScaleInfo('');
        return;
      }

      setIsRendering(true);
      setPreviewError('');

      try {
        const { pdf, page } = await loadFirstPagePreview(new Uint8Array(fileBytes));
        if (cancelled) {
          pdf.destroy();
          return;
        }

        const sourceViewport = page.getViewport({ scale: 1 });
        const containerWidth = clamp(container.clientWidth || 900, 320, 1100);
        const displayWidth = Math.floor(containerWidth * window.devicePixelRatio);
        const displayHeight = Math.floor((containerWidth * pageSizePt.height / pageSizePt.width) * window.devicePixelRatio);
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        canvas.style.width = `${containerWidth}px`;
        canvas.style.height = `${Math.max(420, displayHeight / window.devicePixelRatio)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          pdf.destroy();
          throw new Error('无法创建画布上下文');
        }

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

        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.clearRect(0, 0, containerWidth, Math.max(420, displayHeight / window.devicePixelRatio));
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, containerWidth, Math.max(420, displayHeight / window.devicePixelRatio));

        const pageCssWidth = Math.min(containerWidth - 64, 780);
        const pageCssHeight = pageCssWidth * (pageSizePt.height / pageSizePt.width);
        const offsetX = (containerWidth - pageCssWidth) / 2;
        const offsetY = 24;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(offsetX, offsetY, pageCssWidth, pageCssHeight);
        ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(offsetX, offsetY, pageCssWidth, pageCssHeight);
        ctx.shadowColor = 'transparent';

        const marginLeft = pageCssWidth * (marginBoxPt.left / pageSizePt.width);
        const marginRight = pageCssWidth * (marginBoxPt.right / pageSizePt.width);
        const marginTop = pageCssHeight * (marginBoxPt.top / pageSizePt.height);
        const marginBottom = pageCssHeight * (marginBoxPt.bottom / pageSizePt.height);
        const contentX = offsetX + marginLeft;
        const contentY = offsetY + marginTop;
        const contentWidth = pageCssWidth - marginLeft - marginRight;
        const contentHeight = pageCssHeight - marginTop - marginBottom;

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
        ctx.setLineDash([10, 8]);
        ctx.strokeRect(contentX, contentY, contentWidth, contentHeight);
        ctx.setLineDash([]);

        const scale = Math.min(
          contentWidth / sourceViewport.width,
          contentHeight / sourceViewport.height,
        );
        const drawWidth = sourceViewport.width * scale;
        const drawHeight = sourceViewport.height * scale;
        const drawX = contentX + (contentWidth - drawWidth) / 2;
        const drawY = contentY + (contentHeight - drawHeight) / 2;

        ctx.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(offsetX, offsetY, pageCssWidth, pageCssHeight);

        ctx.fillStyle = '#64748b';
        ctx.font = '13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(`预览为第 1 页，目标尺寸 ${pageSizeMm.widthMm.toFixed(1)} × ${pageSizeMm.heightMm.toFixed(1)} mm`, offsetX, offsetY + pageCssHeight + 28);
        ctx.restore();

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

    void render();

    return () => {
      cancelled = true;
    };
  }, [fileBytes, marginBoxPt, pageSizeMm.heightMm, pageSizeMm.widthMm, pageSizePt.height, pageSizePt.width]);

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
      const pageCount = sourceDoc.getPageCount();
      const copiedPages = await outputDoc.copyPages(
        sourceDoc,
        Array.from({ length: pageCount }, (_, index) => index),
      );

      copiedPages.forEach((page) => {
        const sourceSize = page.getSize();
        const scale = Math.min(contentWidth / sourceSize.width, contentHeight / sourceSize.height);
        const drawWidth = sourceSize.width * scale;
        const drawHeight = sourceSize.height * scale;
        const x = marginBoxPt.left + (contentWidth - drawWidth) / 2;
        const y = marginBoxPt.bottom + (contentHeight - drawHeight) / 2;
        outputDoc.addPage(page);
        page.setSize(outputWidth, outputHeight);
        page.scaleContent(scale, scale);
        page.scaleAnnotations(scale, scale);
        page.translateContent(x, y);
      });

      const outputBytes = await outputDoc.save();
      const outputBuffer = new ArrayBuffer(outputBytes.byteLength);
      new Uint8Array(outputBuffer).set(outputBytes);
      const blob = new Blob([outputBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const baseName = fileName.replace(/\.pdf$/i, '') || 'output';
      anchor.href = url;
      anchor.download = `${baseName}-margin.pdf`;
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
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">PDF Margin Tool</p>
          <h1>{ui.heroTitle}</h1>
          <p className="subtitle">{ui.heroSubtitle}</p>
        </div>
        <div className="hero-card">
          <span>{status}</span>
          <strong>{pageCount > 0 ? ui.pagesLoaded(pageCount) : ui.pagesNotLoaded}</strong>
          <button type="button" className="lang-toggle" onClick={() => setLang((current) => (current === 'zh' ? 'en' : 'zh'))}>
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

            <label>
              <span>{ui.uniformMargin}</span>
              <div className="inline-control">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={margins.top}
                  onChange={(event) => applyUniformMargin(clamp(parseNumber(event.target.value), 0, 200))}
                />
                <button type="button" onClick={() => applyUniformMargin(20)}>
                  {ui.useCurrentMargin}
                </button>
              </div>
            </label>
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

          <div className="field-grid two-up">
            <label>
              <span>{ui.top}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={margins.top}
                onChange={(event) => setMargins((current) => ({ ...current, top: clamp(parseNumber(event.target.value), 0, 200) }))}
              />
            </label>
            <label>
              <span>{ui.right}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={margins.right}
                onChange={(event) => setMargins((current) => ({ ...current, right: clamp(parseNumber(event.target.value), 0, 200) }))}
              />
            </label>
            <label>
              <span>{ui.bottom}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={margins.bottom}
                onChange={(event) => setMargins((current) => ({ ...current, bottom: clamp(parseNumber(event.target.value), 0, 200) }))}
              />
            </label>
            <label>
              <span>{ui.left}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={margins.left}
                onChange={(event) => setMargins((current) => ({ ...current, left: clamp(parseNumber(event.target.value), 0, 200) }))}
              />
            </label>
          </div>

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
            {isRendering ? ui.processing : ui.download}
          </button>

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
