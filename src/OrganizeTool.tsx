import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
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
  rotation: 0 | 90 | 180 | 270;
};

type InsertPlacement = 'before' | 'after';

const COPY = {
  zh: {
    statusReady: '上传多个 PDF 后可拖动排序并删除页面',
    statusReading: '正在读取文件并展开页面...',
    statusReadDone: (fileCount: number, pageCount: number) => `已追加 ${fileCount} 个文件，共新增 ${pageCount} 页，可拖动排序`,
    statusReadFail: '读取失败，请重试',
    statusOrderUpdated: '页面顺序已更新',
    statusDeleted: '页面已删除',
    statusRotated: '页面已旋转 90°',
    statusNoPages: '没有可导出的页面',
    statusExporting: '正在生成合并 PDF...',
    statusExportDone: '导出完成，已开始下载',
    statusExportFail: '导出失败',
    statusPrintReady: '已打开打印窗口',
    statusUndoDone: '已撤销上一步操作',
    statusNoUndo: '没有可撤销的操作',
    statusCleared: '已清除当前页面，可重新上传 PDF',
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
    loadingProgress: (fileIndex: number, totalFiles: number, pageIndex: number, totalPages: number) => `加载中：文件 ${fileIndex}/${totalFiles}，页面 ${pageIndex}/${totalPages}`,
    uploadedFiles: '已上传文件',
    totalPages: '当前页面总数',
    exportButton: '下载 PDF',
    print: '打印',
    undoButton: '撤销上一步',
    clearAllButton: '清除全部页面',
    sectionPagesTitle: '页面贴片墙',
    sectionPagesDesc: '拖动卡片即可调整顺序；支持旋转和删除单页。',
    emptyState: '上传 PDF 后可在这里管理页面顺序',
    sourcePage: (index: number) => `源页码 ${index}`,
    rotate: '旋转',
    rotateAria: (index: number) => `旋转第 ${index} 页 90 度`,
    remove: '删除',
    confirmRemove: '确认删除',
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
    statusRotated: 'Page rotated by 90°',
    statusNoPages: 'No pages available to export',
    statusExporting: 'Generating merged PDF...',
    statusExportDone: 'Export complete, download started',
    statusExportFail: 'Export failed',
    statusPrintReady: 'Print window opened',
    statusUndoDone: 'Last action undone',
    statusNoUndo: 'Nothing to undo',
    statusCleared: 'All current pages cleared, ready to upload again',
    readFail: (message: string) => `Failed to read PDF: ${message}`,
    exportFail: (message: string) => `Export failed: ${message}`,
    eyebrow: 'PDF Organizer',
    heroTitle: 'Merge PDFs, reorder pages, and delete pages',
    heroSubtitle: 'Upload, reorder, and export pages.',
    pagesLoaded: (count: number) => `${count} pages`,
    pagesNotLoaded: 'No pages loaded',
    language: '中文',
    sectionFileTitle: 'Files and Export',
    sectionFileDesc: 'You can upload multiple PDFs at once or append more batches later.',
    choosingFiles: 'Processing...',
    chooseFiles: 'Click to choose multiple PDFs',
    chooseFilesHint: 'Uploaded files expand into page cards in file order, then you can drag to reorder.',
    loadingProgress: (fileIndex: number, totalFiles: number, pageIndex: number, totalPages: number) => `Loading: file ${fileIndex}/${totalFiles}, page ${pageIndex}/${totalPages}`,
    uploadedFiles: 'Uploaded files',
    totalPages: 'Total pages',
    exportButton: 'Download PDF',
    print: 'Print',
    undoButton: 'Undo last action',
    clearAllButton: 'Clear all pages',
    sectionPagesTitle: 'Page Wall',
    sectionPagesDesc: 'Drag cards to reorder pages; rotate or remove single pages.',
    emptyState: 'Upload PDFs to manage page order here',
    sourcePage: (index: number) => `Source page ${index}`,
    rotate: 'Rotate',
    rotateAria: (index: number) => `Rotate page ${index} by 90 degrees`,
    remove: 'Remove',
    confirmRemove: 'Confirm',
    ariaList: 'Organized PDF pages',
    thumbAlt: (name: string, page: number) => `${name} page ${page}`,
  },
} as const;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

type OrganizeToolProps = {
  lang: Lang;
  onToggleLang: () => void;
};

export default function OrganizeTool({ lang, onToggleLang }: OrganizeToolProps) {
  const [sources, setSources] = useState<OrganizeSource[]>([]);
  const [pages, setPages] = useState<OrganizePage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<OrganizePage[][]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(() => COPY[lang].statusReady);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{
    fileIndex: number;
    totalFiles: number;
    pageIndex: number;
    totalPages: number;
  } | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const draggingGroupIdsRef = useRef<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingGroupIds, setDraggingGroupIds] = useState<Set<string>>(new Set());
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const shouldAnimateRef = useRef(false);
  const lastReorderAtRef = useRef(0);
  const lastHoverTargetRef = useRef<string | null>(null);
  const lastMoveRef = useRef<{ from: number; to: number; at: number } | null>(null);
  const dragStartPagesRef = useRef<OrganizePage[] | null>(null);

  const totalPages = pages.length;
  const ui = COPY[lang];

  useLayoutEffect(() => {
    setStatus((current) => {
      if (current === COPY.zh.statusReady || current === COPY.en.statusReady) {
        return COPY[lang].statusReady;
      }
      return current;
    });
  }, [lang]);

  useLayoutEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

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

  function hasSameOrder(a: OrganizePage[], b: OrganizePage[]) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((page, index) => page.id === b[index]?.id);
  }

  function pushUndoSnapshot(snapshot: OrganizePage[]) {
    setUndoStack((current) => {
      const next = [...current, snapshot];
      return next.slice(-40);
    });
  }

  function getReorderedList(
    current: OrganizePage[],
    targetId: string,
    draggingSet: Set<string>,
    placement: InsertPlacement,
  ) {
    if (draggingSet.size === 0 || draggingSet.has(targetId)) {
      return current;
    }

    const movingItems = current.filter((page) => draggingSet.has(page.id));
    if (movingItems.length === 0) {
      return current;
    }

    const remaining = current.filter((page) => !draggingSet.has(page.id));
    const targetIndex = remaining.findIndex((page) => page.id === targetId);
    if (targetIndex < 0) {
      return current;
    }
    const insertAt = placement === 'after' ? targetIndex + 1 : targetIndex;

    const next = [...remaining.slice(0, insertAt), ...movingItems, ...remaining.slice(insertAt)];
    const unchanged = next.every((page, index) => page.id === current[index]?.id);
    return unchanged ? current : next;
  }

  function reorderWhileDragging(targetId: string, placement: InsertPlacement) {
    const draggingCurrent = draggingIdRef.current;
    const draggingSet = draggingGroupIdsRef.current;
    if (!draggingCurrent || draggingSet.size === 0 || draggingSet.has(targetId)) {
      return;
    }

    const now = performance.now();
    snapshotRects();
    shouldAnimateRef.current = true;
    setPages((current) => {
      const from = current.findIndex((page) => page.id === draggingCurrent);
      if (from < 0) {
        shouldAnimateRef.current = false;
        previousRectsRef.current = null;
        return current;
      }

      const next = getReorderedList(current, targetId, draggingSet, placement);
      if (next === current) {
        shouldAnimateRef.current = false;
        previousRectsRef.current = null;
        return current;
      }

      const to = next.findIndex((page) => page.id === draggingCurrent);

      const lastMove = lastMoveRef.current;
      if (lastMove && now - lastMove.at < 180 && lastMove.from === to && lastMove.to === from) {
        shouldAnimateRef.current = false;
        previousRectsRef.current = null;
        return current;
      }

      lastMoveRef.current = { from, to, at: now };
      return next;
    });
  }

  function getPlacementFromPointer(targetId: string, event: React.DragEvent<HTMLDivElement>): InsertPlacement {
    const node = itemRefs.current.get(targetId);
    if (!node) {
      return 'before';
    }
    const rect = node.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const yRatio = (event.clientY - rect.top) / Math.max(1, rect.height);
    const dx = Math.abs(xRatio - 0.5);
    const dy = Math.abs(yRatio - 0.5);

    if (dx > dy) {
      return xRatio >= 0.5 ? 'after' : 'before';
    }
    return yRatio >= 0.5 ? 'after' : 'before';
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
    reorderWhileDragging(targetId, getPlacementFromPointer(targetId, event));
  }

  async function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsProcessing(true);
    setIsLoadingFiles(true);
    setLoadingProgress(null);
    setError('');
    setStatus(ui.statusReading);

    try {
      const selectedFiles = Array.from(fileList);
      const nextSources: OrganizeSource[] = [];
      const nextPages: OrganizePage[] = [];

      let lastProgressUpdate = 0;

      for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex += 1) {
        const file = selectedFiles[fileIndex];
        const bytes = new Uint8Array(await file.arrayBuffer());
        const previewDoc = await getDocument({ data: new Uint8Array(bytes) }).promise;
        const sourceId = createId('source');
        const pageCount = previewDoc.numPages;
        nextSources.push({ id: sourceId, name: file.name, bytes, pageCount });

        for (let index = 0; index < pageCount; index += 1) {
          const now = performance.now();
          if (now - lastProgressUpdate > 90 || index === pageCount - 1) {
            setLoadingProgress({
              fileIndex: fileIndex + 1,
              totalFiles: selectedFiles.length,
              pageIndex: index + 1,
              totalPages: pageCount,
            });
            lastProgressUpdate = now;
          }

          const page = await previewDoc.getPage(index + 1);
          const viewport = page.getViewport({ scale: 1 });
          const targetWidth = 180;
          const scale = Math.min(1.35, targetWidth / viewport.width);
          const scaled = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(scaled.width);
          canvas.height = Math.floor(scaled.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            previewDoc.destroy();
            throw new Error(lang === 'zh' ? '无法创建缩略图画布' : 'Unable to create thumbnail canvas');
          }

          await page
            .render({
              canvasContext: ctx,
              viewport: scaled,
            } as Parameters<typeof page.render>[0])
            .promise;

          const previewDataUrl = canvas.toDataURL('image/jpeg', 0.86);
          nextPages.push({
            id: createId('page'),
            sourceId,
            sourceName: file.name,
            sourcePageIndex: index,
            previewDataUrl,
            rotation: 0,
          });
        }

        previewDoc.destroy();
      }

      setSources((current) => [...current, ...nextSources]);
      setPages((current) => [...current, ...nextPages]);
      setStatus(ui.statusReadDone(nextSources.length, nextPages.length));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(ui.readFail(message));
      setStatus(ui.statusReadFail);
    } finally {
      setIsLoadingFiles(false);
      setLoadingProgress(null);
      setIsProcessing(false);
      event.target.value = '';
    }
  }

  function handleCardClick(pageId: string, event: React.MouseEvent<HTMLDivElement>) {
    const isToggle = event.metaKey || event.ctrlKey;
    setPendingDeleteId(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isToggle) {
        if (next.has(pageId)) {
          next.delete(pageId);
        } else {
          next.add(pageId);
        }
        return next;
      }

      if (next.size === 1 && next.has(pageId)) {
        return next;
      }
      return new Set([pageId]);
    });
  }

  function handleDragStart(pageId: string, event: React.DragEvent<HTMLDivElement>) {
    setPendingDeleteId(null);
    const existingSelection = selectedIdsRef.current;
    const draggingSet = existingSelection.has(pageId)
      ? new Set(existingSelection)
      : new Set([pageId]);

    if (!existingSelection.has(pageId)) {
      selectedIdsRef.current = new Set([pageId]);
      setSelectedIds(new Set([pageId]));
    }

    draggingGroupIdsRef.current = draggingSet;
    dragStartPagesRef.current = pages;
    draggingIdRef.current = pageId;
    setDraggingId(pageId);
    setDraggingGroupIds(new Set(draggingSet));
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pageId);
  }

  function handleDrop(targetId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    reorderWhileDragging(targetId, getPlacementFromPointer(targetId, event));
    setDropTargetId(null);
    setStatus(ui.statusOrderUpdated);
  }

  function handleDragEnd() {
    const startPages = dragStartPagesRef.current;
    if (startPages && !hasSameOrder(startPages, pages)) {
      pushUndoSnapshot(startPages);
    }

    dragStartPagesRef.current = null;
    draggingIdRef.current = null;
    draggingGroupIdsRef.current = new Set();
    setDraggingId(null);
    setDraggingGroupIds(new Set());
    setDropTargetId(null);
    lastHoverTargetRef.current = null;
    lastReorderAtRef.current = 0;
    lastMoveRef.current = null;
  }

  function removePage(pageId: string) {
    if (!pages.some((page) => page.id === pageId)) {
      return;
    }

    pushUndoSnapshot(pages);
    setPages((current) => current.filter((page) => page.id !== pageId));
    if (pendingDeleteId === pageId) {
      setPendingDeleteId(null);
    }
    setSelectedIds((current) => {
      if (!current.has(pageId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(pageId);
      return next;
    });
    setStatus(ui.statusDeleted);
  }

  function rotatePage(pageId: string) {
    if (!pages.some((page) => page.id === pageId)) {
      return;
    }
    pushUndoSnapshot(pages);
    setPendingDeleteId(null);
    setPages((current) => current.map((page) => {
      if (page.id !== pageId) {
        return page;
      }
      const nextRotation = ((page.rotation + 90) % 360) as OrganizePage['rotation'];
      return { ...page, rotation: nextRotation };
    }));
    setStatus(ui.statusRotated);
  }

  function handleUndo() {
    setUndoStack((current) => {
      if (current.length === 0) {
        setStatus(ui.statusNoUndo);
        return current;
      }

      const snapshot = current[current.length - 1];
      const validIds = new Set(snapshot.map((page) => page.id));
      setPages(snapshot);
      setPendingDeleteId(null);
      setDropTargetId(null);
      setSelectedIds((selected) => {
        const next = new Set<string>();
        selected.forEach((id) => {
          if (validIds.has(id)) {
            next.add(id);
          }
        });
        return next;
      });
      setStatus(ui.statusUndoDone);
      return current.slice(0, -1);
    });
  }

  function handleClearAll() {
    if (pages.length === 0 && sources.length === 0) {
      return;
    }

    setPages([]);
    setSources([]);
    setSelectedIds(new Set());
    selectedIdsRef.current = new Set();
    setUndoStack([]);
    setPendingDeleteId(null);
    setDropTargetId(null);
    setDraggingId(null);
    setDraggingGroupIds(new Set());
    draggingIdRef.current = null;
    draggingGroupIdsRef.current = new Set();
    dragStartPagesRef.current = null;
    lastHoverTargetRef.current = null;
    lastReorderAtRef.current = 0;
    lastMoveRef.current = null;
    setError('');
    setStatus(ui.statusCleared);
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
        const outputPage = copied[0];
        outputPage.setRotation(degrees(page.rotation));
        outputDoc.addPage(outputPage);
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

  async function handlePrint() {
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
        const outputPage = copied[0];
        outputPage.setRotation(degrees(page.rotation));
        outputDoc.addPage(outputPage);
      }

      const outputBytes = await outputDoc.save();
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
    } catch (printError) {
      const message = printError instanceof Error ? printError.message : String(printError);
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
              {isLoadingFiles && loadingProgress ? (
                <span className="loading-inline">
                  <span className="loading-dot" aria-hidden="true" />
                  {ui.loadingProgress(
                    loadingProgress.fileIndex,
                    loadingProgress.totalFiles,
                    loadingProgress.pageIndex,
                    loadingProgress.totalPages,
                  )}
                </span>
              ) : null}
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

          <div className="action-row">
            <button className="primary-button" type="button" onClick={handleExport} disabled={isProcessing || pages.length === 0}>
              {isProcessing ? ui.choosingFiles : ui.exportButton}
            </button>
            <button className="secondary-button print-button" type="button" onClick={handlePrint} disabled={isProcessing || pages.length === 0} title={ui.print}>
              <svg viewBox="0 0 24 24" className="print-icon" aria-hidden="true">
                <path
                  d="M7 3h10a1 1 0 0 1 1 1v4H6V4a1 1 0 0 1 1-1zm0 14h10v4a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-4zm-2-7h14a3 3 0 0 1 3 3v4a1 1 0 0 1-1 1h-2v-3H5v3H3a1 1 0 0 1-1-1v-4a3 3 0 0 1 3-3zm13 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
                  fill="currentColor"
                />
              </svg>
              <span className="print-label">{ui.print}</span>
            </button>
          </div>

          <button className="secondary-button" type="button" onClick={handleUndo} disabled={isProcessing || undoStack.length === 0}>
            {ui.undoButton}
          </button>

          <button className="secondary-button" type="button" onClick={handleClearAll} disabled={isProcessing || pages.length === 0}>
            {ui.clearAllButton}
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
                  className={`organize-card ${selectedIds.has(page.id) ? 'is-selected' : ''} ${draggingId === page.id ? 'is-dragging' : ''} ${draggingGroupIds.has(page.id) ? 'is-drag-group' : ''} ${dropTargetId === page.id ? 'is-target' : ''}`}
                  aria-selected={selectedIds.has(page.id)}
                  draggable
                  onClick={(event) => handleCardClick(page.id, event)}
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
                    <img
                      src={page.previewDataUrl}
                      alt={ui.thumbAlt(page.sourceName, page.sourcePageIndex + 1)}
                      className="organize-preview"
                      style={{
                        transform: `rotate(${page.rotation}deg) scale(${page.rotation % 180 === 0 ? 1 : 0.76})`,
                      }}
                    />
                  </div>
                  <div className="organize-meta">
                    <div className="organize-item-left">
                      <span className="organize-index">#{pageNumberMap.get(page.id)}</span>
                      <div>
                        <strong>{page.sourceName}</strong>
                        <p>{ui.sourcePage(page.sourcePageIndex + 1)}</p>
                      </div>
                    </div>
                    <div className="organize-actions">
                      <button
                        type="button"
                        className="range-chip icon-chip"
                        aria-label={ui.rotateAria(page.sourcePageIndex + 1)}
                        title={ui.rotate}
                        onClick={(event) => {
                          event.stopPropagation();
                          rotatePage(page.id);
                        }}
                        >
                          <svg viewBox="0 0 24 24" className="icon-rotate" aria-hidden="true">
                          <path
                            d="M12 3a9 9 0 1 0 8.7 11.2 1 1 0 1 0-1.9-.5A7 7 0 1 1 12 5h2.4l-1.7 1.7a1 1 0 1 0 1.4 1.4l3.4-3.4a1 1 0 0 0 0-1.4L14 0.9a1 1 0 1 0-1.4 1.4L14.4 3H12z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`range-chip ${pendingDeleteId === page.id ? 'danger-confirm' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (pendingDeleteId === page.id) {
                            removePage(page.id);
                            return;
                          }
                          setPendingDeleteId(page.id);
                        }}
                      >
                        {pendingDeleteId === page.id ? ui.confirmRemove : ui.remove}
                      </button>
                    </div>
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
