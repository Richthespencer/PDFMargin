import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type { Lang } from './MarginTool';

GlobalWorkerOptions.workerSrc = workerSrc;

type OrganizeSource = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
};

type OrganizePage = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourcePageIndex: number;
  previewDataUrl: string;
};

const COPY = {
  zh: {
    statusReady: '上传多个 PDF 后可拖动排序并删除页面',
    statusReading: '正在读取文件并展开页面...',
    statusReadDone: (fileCount: number, pageCount: number) => `已追加 ${fileCount} 个文件，共新增 ${pageCount} 页，可拖动排序`,
    statusReadFail: '读取失败，请重试',
    statusOrderUpdated: '页面顺序已更新',
    statusDeleted: '页面已删除',
    statusNoPages: '没有可导出的页面',
    statusExporting: '正在生成合并 PDF...',
    statusExportDone: '导出完成，已开始下载',
    statusExportFail: '导出失败',
    readFail: (message: string) => `读取 PDF 失败：${message}`,
    exportFail: (message: string) => `导出失败：${message}`,
    eyebrow: 'PDF Organizer',
    heroTitle: '合并、拖动排序、删除页面',
    heroSubtitle: '上传多个 PDF，将所有页面放在一个贴片墙中，自由拖拽调整顺序并按当前结果导出。',
    pagesLoaded: (count: number) => `共 ${count} 页`,
    pagesNotLoaded: '未加载页面',
    language: 'English',
    sectionFileTitle: '文件与导出',
    sectionFileDesc: '支持一次选择多个 PDF，也可多次追加上传。',
    choosingFiles: '处理中...',
    chooseFiles: '点击选择多个 PDF 文件',
    chooseFilesHint: '上传后会按文件顺序展开为页面卡片，可继续拖动重排。',
    uploadedFiles: '已上传文件',
    totalPages: '当前页面总数',
    exportButton: '导出当前顺序 PDF',
    sectionPagesTitle: '页面贴片墙',
    sectionPagesDesc: '拖动卡片即可调整顺序；点击删除可移除单页。',
    emptyState: '上传 PDF 后可在这里管理页面顺序',
    sourcePage: (index: number) => `源页码 ${index}`,
    remove: '删除',
    ariaList: 'Organized PDF pages',
    thumbAlt: (name: string, page: number) => `${name} 第 ${page} 页`,
  },
  en: {
    statusReady: 'Upload multiple PDFs to drag, reorder, and remove pages',
    statusReading: 'Reading files and expanding pages...',
    statusReadDone: (fileCount: number, pageCount: number) => `Added ${fileCount} file(s), ${pageCount} new page(s), ready to reorder`,
    statusReadFail: 'Read failed, please try again',
    statusOrderUpdated: 'Page order updated',
    statusDeleted: 'Page removed',
    statusNoPages: 'No pages available to export',
    statusExporting: 'Generating merged PDF...',
    statusExportDone: 'Export complete, download started',
    statusExportFail: 'Export failed',
    readFail: (message: string) => `Failed to read PDF: ${message}`,
    exportFail: (message: string) => `Export failed: ${message}`,
    eyebrow: 'PDF Organizer',
    heroTitle: 'Merge PDFs, reorder pages, and delete pages',
    heroSubtitle: 'Upload multiple PDFs, arrange all pages in a visual card wall, and export exactly in the current order.',
    pagesLoaded: (count: number) => `${count} pages`,
    pagesNotLoaded: 'No pages loaded',
    language: '中文',
    sectionFileTitle: 'Files and Export',
    sectionFileDesc: 'You can upload multiple PDFs at once or append more batches later.',
    choosingFiles: 'Processing...',
    chooseFiles: 'Click to choose multiple PDFs',
    chooseFilesHint: 'Uploaded files expand into page cards in file order, then you can drag to reorder.',
    uploadedFiles: 'Uploaded files',
    totalPages: 'Total pages',
    exportButton: 'Export current order PDF',
    sectionPagesTitle: 'Page Wall',
    sectionPagesDesc: 'Drag cards to reorder pages; click remove to delete a single page.',
    emptyState: 'Upload PDFs to manage page order here',
    sourcePage: (index: number) => `Source page ${index}`,
    remove: 'Remove',
    ariaList: 'Organized PDF pages',
    thumbAlt: (name: string, page: number) => `${name} page ${page}`,
  },
} as const;

function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function renderPagePreview(bytes: Uint8Array, pageNumber: number) {
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const targetWidth = 180;
  const scale = Math.min(1.4, targetWidth / viewport.width);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(scaled.width);
  canvas.height = Math.floor(scaled.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    pdf.destroy();
    throw new Error('无法创建缩略图画布');
  }

  await page
    .render({
      canvasContext: ctx,
      viewport: scaled,
    } as Parameters<typeof page.render>[0])
    .promise;
  const dataUrl = canvas.toDataURL('image/png');
  pdf.destroy();
  return dataUrl;
}

type OrganizeToolProps = {
  lang: Lang;
  onToggleLang: () => void;
};

export default function OrganizeTool({ lang, onToggleLang }: OrganizeToolProps) {
  const [sources, setSources] = useState<OrganizeSource[]>([]);
  const [pages, setPages] = useState<OrganizePage[]>([]);
  const [status, setStatus] = useState<string>(COPY.zh.statusReady);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const shouldAnimateRef = useRef(false);
  const lastReorderAtRef = useRef(0);
  const lastHoverTargetRef = useRef<string | null>(null);
  const lastMoveRef = useRef<{ from: number; to: number; at: number } | null>(null);

  const totalPages = pages.length;
  const ui = COPY[lang];

  const pageNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    pages.forEach((page, index) => {
      map.set(page.id, index + 1);
    });
    return map;
  }, [pages]);

  useLayoutEffect(() => {
    if (!shouldAnimateRef.current || !previousRectsRef.current) {
      return;
    }

    const previousRects = previousRectsRef.current;
    itemRefs.current.forEach((node, id) => {
      const prev = previousRects.get(id);
      if (!prev) {
        return;
      }
      const next = node.getBoundingClientRect();
      const deltaX = prev.left - next.left;
      const deltaY = prev.top - next.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)',
        },
      );
    });

    shouldAnimateRef.current = false;
    previousRectsRef.current = null;
  }, [pages]);

  function snapshotRects() {
    const rects = new Map<string, DOMRect>();
    itemRefs.current.forEach((node, id) => {
      rects.set(id, node.getBoundingClientRect());
    });
    previousRectsRef.current = rects;
  }

  function reorderWhileDragging(targetId: string) {
    const draggingCurrent = draggingIdRef.current;
    if (!draggingCurrent || draggingCurrent === targetId) {
      return;
    }

    const now = performance.now();
    snapshotRects();
    shouldAnimateRef.current = true;
    setPages((current) => {
      const from = current.findIndex((page) => page.id === draggingCurrent);
      const to = current.findIndex((page) => page.id === targetId);
      if (from < 0 || to < 0 || from === to) {
        shouldAnimateRef.current = false;
        previousRectsRef.current = null;
        return current;
      }

      const lastMove = lastMoveRef.current;
      if (lastMove && now - lastMove.at < 180 && lastMove.from === to && lastMove.to === from) {
        shouldAnimateRef.current = false;
        previousRectsRef.current = null;
        return current;
      }

      lastMoveRef.current = { from, to, at: now };
      return moveItem(current, from, to);
    });
  }

  function maybeReorderOnHover(targetId: string, event: React.DragEvent<HTMLDivElement>) {
    const draggingCurrent = draggingIdRef.current;
    if (!draggingCurrent || draggingCurrent === targetId) {
      return;
    }

    const node = itemRefs.current.get(targetId);
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const yRatio = (event.clientY - rect.top) / Math.max(1, rect.height);
    const inDeadZone = xRatio > 0.28 && xRatio < 0.72 && yRatio > 0.28 && yRatio < 0.72;
    if (inDeadZone) {
      return;
    }

    const now = performance.now();
    const sameTarget = lastHoverTargetRef.current === targetId;
    const cooldown = sameTarget ? 130 : 85;
    if (now - lastReorderAtRef.current < cooldown) {
      return;
    }

    lastReorderAtRef.current = now;
    lastHoverTargetRef.current = targetId;
    reorderWhileDragging(targetId);
  }

  async function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsProcessing(true);
    setError('');
    setStatus(ui.statusReading);

    try {
      const selectedFiles = Array.from(fileList);
      const nextSources: OrganizeSource[] = [];
      const nextPages: OrganizePage[] = [];

      for (const file of selectedFiles) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sourceDoc = await PDFDocument.load(new Uint8Array(bytes));
        const sourceId = createId('source');
        const pageCount = sourceDoc.getPageCount();
        nextSources.push({ id: sourceId, name: file.name, bytes, pageCount });

        for (let index = 0; index < pageCount; index += 1) {
          const previewDataUrl = await renderPagePreview(bytes, index + 1);
          nextPages.push({
            id: createId('page'),
            sourceId,
            sourceName: file.name,
            sourcePageIndex: index,
            previewDataUrl,
          });
        }
      }

      setSources((current) => [...current, ...nextSources]);
      setPages((current) => [...current, ...nextPages]);
      setStatus(ui.statusReadDone(nextSources.length, nextPages.length));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(ui.readFail(message));
      setStatus(ui.statusReadFail);
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  }

  function handleDragStart(pageId: string, event: React.DragEvent<HTMLDivElement>) {
    draggingIdRef.current = pageId;
    setDraggingId(pageId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pageId);
  }

  function handleDrop(targetId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    reorderWhileDragging(targetId);
    setDropTargetId(null);
    setStatus(ui.statusOrderUpdated);
  }

  function handleDragEnd() {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    lastHoverTargetRef.current = null;
    lastReorderAtRef.current = 0;
    lastMoveRef.current = null;
  }

  function removePage(pageId: string) {
    setPages((current) => current.filter((page) => page.id !== pageId));
    setStatus(ui.statusDeleted);
  }

  async function handleExport() {
    if (pages.length === 0) {
      setStatus(ui.statusNoPages);
      return;
    }

    setIsProcessing(true);
    setError('');
    setStatus(ui.statusExporting);

    try {
      const sourceDocs = new Map<string, PDFDocument>();
      for (const source of sources) {
        sourceDocs.set(source.id, await PDFDocument.load(new Uint8Array(source.bytes)));
      }

      const outputDoc = await PDFDocument.create();
      for (const page of pages) {
        const sourceDoc = sourceDocs.get(page.sourceId);
        if (!sourceDoc) {
          continue;
        }
        const copied = await outputDoc.copyPages(sourceDoc, [page.sourcePageIndex]);
        outputDoc.addPage(copied[0]);
      }

      const outputBytes = await outputDoc.save();
      const outputBuffer = new ArrayBuffer(outputBytes.byteLength);
      new Uint8Array(outputBuffer).set(outputBytes);
      const blob = new Blob([outputBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `organized-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(ui.statusExportDone);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : String(exportError);
      setError(ui.exportFail(message));
      setStatus(ui.statusExportFail);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <header className="hero">
        <div>
          <p className="eyebrow">{ui.eyebrow}</p>
          <h1>{ui.heroTitle}</h1>
          <p className="subtitle">{ui.heroSubtitle}</p>
        </div>
        <div className="hero-card">
          <span>{status}</span>
          <strong>{totalPages > 0 ? ui.pagesLoaded(totalPages) : ui.pagesNotLoaded}</strong>
          <button type="button" className="lang-toggle" onClick={onToggleLang}>
            {ui.language}
          </button>
        </div>
      </header>

      <main className="layout organize-layout">
        <section className="panel controls-panel">
          <div className="panel-header">
            <h2>{ui.sectionFileTitle}</h2>
            <p>{ui.sectionFileDesc}</p>
          </div>

          <label className="file-dropzone">
            <input type="file" accept="application/pdf,.pdf" multiple onChange={handleFilesChange} disabled={isProcessing} />
            <div>
              <strong>{isProcessing ? ui.choosingFiles : ui.chooseFiles}</strong>
              <span>{ui.chooseFilesHint}</span>
            </div>
          </label>

          <div className="summary-card">
            <div>
              <span>{ui.uploadedFiles}</span>
              <strong>{sources.length}</strong>
            </div>
            <div>
              <span>{ui.totalPages}</span>
              <strong>{totalPages}</strong>
            </div>
          </div>

          <button className="primary-button" type="button" onClick={handleExport} disabled={isProcessing || pages.length === 0}>
            {isProcessing ? ui.choosingFiles : ui.exportButton}
          </button>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>{ui.sectionPagesTitle}</h2>
            <p>{ui.sectionPagesDesc}</p>
          </div>

          <div className="organize-grid" role="list" aria-label={ui.ariaList}>
            {pages.length === 0 ? (
              <div className="empty-state organize-empty">{ui.emptyState}</div>
            ) : (
              pages.map((page) => (
                <div
                  key={page.id}
                  role="listitem"
                  className={`organize-card ${draggingId === page.id ? 'is-dragging' : ''} ${dropTargetId === page.id ? 'is-target' : ''}`}
                  draggable
                  onDragStart={(event) => handleDragStart(page.id, event)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropTargetId(page.id);
                    maybeReorderOnHover(page.id, event);
                  }}
                  onDragEnter={() => {
                    setDropTargetId(page.id);
                  }}
                  onDrop={(event) => handleDrop(page.id, event)}
                  ref={(node) => {
                    if (node) {
                      itemRefs.current.set(page.id, node);
                    } else {
                      itemRefs.current.delete(page.id);
                    }
                  }}
                >
                  <div className="organize-preview-wrap">
                    <img src={page.previewDataUrl} alt={ui.thumbAlt(page.sourceName, page.sourcePageIndex + 1)} className="organize-preview" />
                  </div>
                  <div className="organize-meta">
                    <div className="organize-item-left">
                      <span className="organize-index">#{pageNumberMap.get(page.id)}</span>
                      <div>
                        <strong>{page.sourceName}</strong>
                        <p>{ui.sourcePage(page.sourcePageIndex + 1)}</p>
                      </div>
                    </div>
                    <button type="button" className="range-chip" onClick={() => removePage(page.id)}>
                      {ui.remove}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
