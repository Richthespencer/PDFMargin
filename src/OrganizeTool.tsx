import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { ORGANIZE_COPY, translateStaticStatus, type Lang } from './i18n';
import { checkPasswordException, savePdfWithOptionalEncryption } from './pdfEncryption';

GlobalWorkerOptions.workerSrc = workerSrc;

type OrganizeSource = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  isEncrypted: boolean;
  password?: string;
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

const COPY = ORGANIZE_COPY;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

type OrganizeToolProps = {
  lang: Lang;
  onPdfLoadedChange: (loaded: boolean) => void;
};

export default function OrganizeTool({ lang, onPdfLoadedChange }: OrganizeToolProps) {
  const [sources, setSources] = useState<OrganizeSource[]>([]);
  const [pages, setPages] = useState<OrganizePage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<OrganizePage[][]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(() => COPY[lang].statusReady);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isDragOverPageWall, setIsDragOverPageWall] = useState(false);
  const [moveTargetInput, setMoveTargetInput] = useState('1');
  const [movePlacement, setMovePlacement] = useState<InsertPlacement>('before');
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
  const ignoreClickUntilRef = useRef(0);
  const [keepEncryption, setKeepEncryption] = useState(true);
  const [passwordModal, setPasswordModal] = useState<{
    fileName: string;
    error: string;
    resolve: (password: string | null) => void;
  } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  function isExternalFileDrag(event: React.DragEvent<HTMLElement>) {
    const types = Array.from(event.dataTransfer?.types ?? []);
    return types.includes('Files') && !types.includes('application/x-pdfmargin-page');
  }

  const totalPages = pages.length;
  const selectedCount = selectedIds.size;
  const ui = COPY[lang];

  const prevLangRef = useRef<Lang>(lang);

  useEffect(() => {
    onPdfLoadedChange(sources.length > 0);
  }, [sources.length, onPdfLoadedChange]);

  useLayoutEffect(() => {
    const prevLang = prevLangRef.current;
    if (prevLang === lang) return;
    prevLangRef.current = lang;
    setStatus((current) => {
      const translated = translateStaticStatus(COPY, prevLang, lang, current);
      if (translated !== current) {
        return translated;
      }
      if (pages.length > 0) {
        return COPY[lang].statusReadDone(sources.length, pages.length);
      }
      return COPY[lang].statusReady;
    });
  }, [lang, pages.length, sources.length]);

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

  const encryptedSourceInfo = useMemo(() => {
    const sourceById = new Map(sources.map((s) => [s.id, s] as const));
    for (const page of pages) {
      const src = sourceById.get(page.sourceId);
      if (src?.isEncrypted) {
        return { isEncrypted: true, password: src.password ?? '' };
      }
    }
    for (const src of sources) {
      if (src.isEncrypted) {
        return { isEncrypted: true, password: src.password ?? '' };
      }
    }
    return { isEncrypted: false, password: '' };
  }, [pages, sources]);

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

  function moveSelectionList(
    current: OrganizePage[],
    selectedSet: Set<string>,
    targetPosition: number,
    placement: InsertPlacement,
  ) {
    if (selectedSet.size === 0 || current.length === 0) {
      return current;
    }

    const selectedItems = current.filter((page) => selectedSet.has(page.id));
    if (selectedItems.length === 0 || selectedItems.length === current.length) {
      return current;
    }

    const remaining = current.filter((page) => !selectedSet.has(page.id));
    const targetIndexInCurrent = Math.min(Math.max(targetPosition - 1, 0), current.length - 1);
    let targetPage: OrganizePage | undefined = current[targetIndexInCurrent];

    if (targetPage && selectedSet.has(targetPage.id)) {
      if (placement === 'before') {
        targetPage = current.slice(0, targetIndexInCurrent).reverse().find((page) => !selectedSet.has(page.id))
          ?? current.slice(targetIndexInCurrent + 1).find((page) => !selectedSet.has(page.id));
      } else {
        targetPage = current.slice(targetIndexInCurrent + 1).find((page) => !selectedSet.has(page.id))
          ?? current.slice(0, targetIndexInCurrent).reverse().find((page) => !selectedSet.has(page.id));
      }
      if (!targetPage) {
        return current;
      }
    }

    const targetIndexInRemaining = remaining.findIndex((page) => page.id === targetPage.id);
    if (targetIndexInRemaining < 0) {
      return current;
    }

    const insertAt = placement === 'after' ? targetIndexInRemaining + 1 : targetIndexInRemaining;
    const next = [...remaining.slice(0, insertAt), ...selectedItems, ...remaining.slice(insertAt)];
    return hasSameOrder(next, current) ? current : next;
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

  function requestFilePassword(fileName: string, errorMessage = ''): Promise<string | null> {
    setPasswordInput('');
    setStatus(ui.statusPasswordRequired);
    return new Promise((resolve) => {
      setPasswordModal({
        fileName,
        error: errorMessage,
        resolve,
      });
    });
  }

  function handlePasswordModalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordModal) {
      return;
    }
    if (!passwordInput) {
      setPasswordModal((current) => (current ? { ...current, error: ui.passwordIncorrect } : null));
      return;
    }
    const { resolve } = passwordModal;
    const submitted = passwordInput;
    setPasswordModal(null);
    setPasswordInput('');
    resolve(submitted);
  }

  function handlePasswordModalCancel() {
    if (!passwordModal) {
      return;
    }
    const { resolve } = passwordModal;
    setPasswordModal(null);
    setPasswordInput('');
    resolve(null);
  }

  async function openPdfWithPassword(name: string, bytes: Uint8Array) {
    let password = '';
    let showError = false;
    while (true) {
      try {
        const previewDoc = await getDocument({
          data: new Uint8Array(bytes),
          ...(password ? { password } : {}),
        }).promise;
        let isEncrypted = Boolean(password);
        if (!isEncrypted) {
          try {
            const checkDoc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
            isEncrypted = checkDoc.isEncrypted;
          } catch {
            isEncrypted = true;
          }
        }
        return { previewDoc, password, isEncrypted };
      } catch (err) {
        const pwCheck = checkPasswordException(err);
        if (!pwCheck.isPasswordException) {
          throw err;
        }
        const nextPw = await requestFilePassword(
          name,
          showError || pwCheck.isIncorrectPassword ? ui.passwordIncorrect : '',
        );
        if (nextPw === null) {
          return null;
        }
        password = nextPw;
        showError = true;
      }
    }
  }

  async function loadFilesList(selectedFiles: File[]) {
    if (selectedFiles.length === 0) {
      return;
    }

    setIsProcessing(true);
    setIsLoadingFiles(true);
    setLoadingProgress(null);
    setError('');
    setStatus(ui.statusReading);

    try {
      const nextSources: OrganizeSource[] = [];
      const nextPages: OrganizePage[] = [];
      let lastProgressUpdate = 0;

      for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex += 1) {
        const file = selectedFiles[fileIndex];
        const bytes = new Uint8Array(await file.arrayBuffer());
        const opened = await openPdfWithPassword(file.name, bytes);
        if (!opened) {
          continue;
        }
        setStatus(ui.statusReading);
        const { previewDoc, password, isEncrypted } = opened;
        const sourceId = createId('source');
        const pageCount = previewDoc.numPages;
        nextSources.push({
          id: sourceId,
          name: file.name,
          bytes,
          pageCount,
          isEncrypted,
          ...(password ? { password } : {}),
        });

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
            throw new Error(ui.thumbCanvasFail);
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

      if (nextSources.length > 0) {
        if (nextSources.some((s) => s.isEncrypted) && !sources.some((s) => s.isEncrypted)) {
          setKeepEncryption(true);
        }
        setSources((current) => [...current, ...nextSources]);
        setPages((current) => [...current, ...nextPages]);
        setStatus(ui.statusReadDone(nextSources.length, nextPages.length));
      } else {
        setStatus(pages.length > 0 ? ui.statusOrderUpdated : ui.statusReady);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(ui.readFail(message));
      setStatus(ui.statusReadFail);
    } finally {
      setIsLoadingFiles(false);
      setLoadingProgress(null);
      setIsProcessing(false);
    }
  }

  async function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }
    const selectedFiles = Array.from(fileList);
    event.target.value = '';
    await loadFilesList(selectedFiles);
  }

  async function handlePageWallDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOverPageWall(false);
    if (draggingIdRef.current) {
      return;
    }
    if (!isExternalFileDrag(event)) {
      return;
    }
    if (isProcessing) {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer.files ?? []).filter((file) => file.type === 'application/pdf');
    if (droppedFiles.length === 0) {
      return;
    }
    await loadFilesList(droppedFiles);
  }

  function handleCardClick(pageId: string) {
    if (performance.now() < ignoreClickUntilRef.current) {
      return;
    }

    setPendingDeleteId(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }

  function handleDragStart(pageId: string, event: React.DragEvent<HTMLDivElement>) {
    setIsDragOverPageWall(false);
    ignoreClickUntilRef.current = performance.now() + 280;
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
    event.dataTransfer.setData('application/x-pdfmargin-page', '1');
  }

  function handleDrop(targetId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    reorderWhileDragging(targetId, getPlacementFromPointer(targetId, event));
    setDropTargetId(null);
    setStatus(ui.statusOrderUpdated);
  }

  function handleDragEnd() {
    setIsDragOverPageWall(false);
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

  function handleMoveSelected() {
    if (selectedCount === 0) {
      return;
    }

    const targetPosition = Number(moveTargetInput);
    if (!Number.isInteger(targetPosition) || targetPosition < 1 || targetPosition > pages.length) {
      setStatus(ui.statusMoveInvalid);
      return;
    }

    const next = moveSelectionList(pages, selectedIdsRef.current, targetPosition, movePlacement);
    if (next === pages) {
      return;
    }

    pushUndoSnapshot(pages);
    setPendingDeleteId(null);
    setDropTargetId(null);
    setPages(next);
    setStatus(ui.statusMoved);
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
    selectedIdsRef.current = new Set();
  }

  type PdfDocProxy = Awaited<ReturnType<typeof getDocument>['promise']>;

  async function rasterizePageToImage(
    pdfjsDoc: PdfDocProxy,
    pageIndex: number,
    outputDoc: PDFDocument,
  ) {
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
    return {
      image,
      width: baseViewport.width,
      height: baseViewport.height,
    };
  }

  async function buildOrganizePdf(options?: { forPrint?: boolean }): Promise<Uint8Array> {
    const sourceById = new Map(sources.map((source) => [source.id, source] as const));
    const sourceDocs = new Map<string, PDFDocument>();
    const encryptedSourceIds = new Set<string>();
    for (const source of sources) {
      if (source.isEncrypted) {
        encryptedSourceIds.add(source.id);
      }
      try {
        const doc = await PDFDocument.load(new Uint8Array(source.bytes), { ignoreEncryption: true });
        sourceDocs.set(source.id, doc);
        if (doc.isEncrypted) {
          encryptedSourceIds.add(source.id);
        }
      } catch {
        encryptedSourceIds.add(source.id);
      }
    }

    const outputDoc = await PDFDocument.create();
    const pdfjsDocs = new Map<string, PdfDocProxy>();

    for (const page of pages) {
      const source = sourceById.get(page.sourceId);
      if (!source) {
        continue;
      }

      if (encryptedSourceIds.has(page.sourceId)) {
        let pdfjsDoc = pdfjsDocs.get(source.id);
        if (!pdfjsDoc) {
          pdfjsDoc = await getDocument({
            data: new Uint8Array(source.bytes),
            ...(source.password ? { password: source.password } : {}),
          }).promise;
          pdfjsDocs.set(source.id, pdfjsDoc);
        }
        const { image, width, height } = await rasterizePageToImage(pdfjsDoc, page.sourcePageIndex, outputDoc);
        const newPage = outputDoc.addPage([width, height]);
        newPage.drawImage(image, { x: 0, y: 0, width, height });
        newPage.setRotation(degrees(page.rotation));
      } else {
        const sourceDoc = sourceDocs.get(page.sourceId);
        if (!sourceDoc) {
          continue;
        }
        const copied = await outputDoc.copyPages(sourceDoc, [page.sourcePageIndex]);
        const outputPage = copied[0];
        outputPage.setRotation(degrees(page.rotation));
        outputDoc.addPage(outputPage);
      }
    }

    for (const doc of pdfjsDocs.values()) {
      try {
        await doc.destroy();
      } catch {
        // ignore cleanup errors
      }
    }

    const shouldEncrypt = !options?.forPrint && encryptedSourceInfo.isEncrypted && keepEncryption;
    return savePdfWithOptionalEncryption(
      outputDoc,
      shouldEncrypt ? { encryptPassword: encryptedSourceInfo.password } : undefined,
    );
  }

  function finalizeOutputBlob(outputBytes: Uint8Array): Blob {
    const outputBuffer = new ArrayBuffer(outputBytes.byteLength);
    new Uint8Array(outputBuffer).set(outputBytes);
    return new Blob([outputBuffer], { type: 'application/pdf' });
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
      const outputBytes = await buildOrganizePdf();
      const url = URL.createObjectURL(finalizeOutputBlob(outputBytes));
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
      const outputBytes = await buildOrganizePdf({ forPrint: true });
      const url = URL.createObjectURL(finalizeOutputBlob(outputBytes));
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
        <div className="hero-text">
          <p className="eyebrow">{ui.eyebrow}</p>
          <h1>{ui.heroTitle}</h1>
          <p className="subtitle">{ui.heroSubtitle}</p>
        </div>
        <div className={`hero-card ${totalPages > 0 ? 'is-ready' : ''}`} role="status">
          <span className="hero-card-dot" aria-hidden="true" />
          <div className="hero-card-text">
            <span>{status}</span>
            <strong>{totalPages > 0 ? ui.pagesLoaded(totalPages) : ui.pagesNotLoaded}</strong>
          </div>
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
            <span className="file-dropzone-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.5 14.5v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
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

          {pages.length > 0 && encryptedSourceInfo.isEncrypted ? (
            <label className="encryption-checkbox-row">
              <input
                type="checkbox"
                checked={keepEncryption}
                onChange={(event) => setKeepEncryption(event.target.checked)}
              />
              <span>{ui.keepEncryptionLabel}</span>
            </label>
          ) : null}

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
            <div className="pagewall-header-row">
              <h2>{ui.sectionPagesTitle}</h2>
              <div className="move-toolbar-slot">
                <div
                  className={`move-toolbar ${selectedCount > 0 ? '' : 'is-hidden'}`}
                  role="group"
                  aria-label={ui.moveTo}
                  aria-hidden={selectedCount === 0}
                >
                  <span className="move-selected-count">{ui.selectedCount(selectedCount)}</span>
                  <button type="button" className="range-chip danger-confirm" onClick={handleClearSelection}>
                    {ui.clearSelection}
                  </button>
                  <span>{ui.moveTo}</span>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, pages.length)}
                    value={moveTargetInput}
                    onChange={(event) => setMoveTargetInput(event.target.value)}
                    className="move-target-input"
                  />
                  <div className="range-chip-row move-placement-row" role="radiogroup" aria-label={ui.moveTo}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={movePlacement === 'before'}
                      className={`range-chip ${movePlacement === 'before' ? 'active' : ''}`}
                      onClick={() => setMovePlacement('before')}
                    >
                      {ui.moveBefore}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={movePlacement === 'after'}
                      className={`range-chip ${movePlacement === 'after' ? 'active' : ''}`}
                      onClick={() => setMovePlacement('after')}
                    >
                      {ui.moveAfter}
                    </button>
                  </div>
                  <button type="button" className="range-chip move-action-chip" onClick={handleMoveSelected}>
                    {ui.moveAction}
                  </button>
                </div>
              </div>
            </div>
            <p>{ui.sectionPagesDesc}</p>
          </div>

          <div
            className={`organize-grid ${isDragOverPageWall ? 'is-drag-over' : ''}`}
            role="list"
            aria-label={ui.ariaList}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingIdRef.current) {
                if (isDragOverPageWall) {
                  setIsDragOverPageWall(false);
                }
                return;
              }
              if (isExternalFileDrag(event) && !isDragOverPageWall) {
                setIsDragOverPageWall(true);
              }
            }}
            onDragLeave={(event) => {
              if (draggingIdRef.current) {
                return;
              }
              if (!isExternalFileDrag(event)) {
                return;
              }
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && event.currentTarget.contains(nextTarget)) {
                return;
              }
              setIsDragOverPageWall(false);
            }}
            onDrop={handlePageWallDrop}
          >
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
                  onClick={() => handleCardClick(page.id)}
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

      {passwordModal ? (
        <div className="password-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="organize-password-title">
          <form className="password-modal" onSubmit={handlePasswordModalSubmit}>
            <h3 id="organize-password-title">{ui.passwordTitle}</h3>
            <p>{ui.passwordDesc(passwordModal.fileName)}</p>
            <input
              type="password"
              value={passwordInput}
              placeholder={ui.passwordPlaceholder}
              onChange={(event) => {
                setPasswordInput(event.target.value);
                if (passwordModal.error) {
                  setPasswordModal((current) => (current ? { ...current, error: '' } : null));
                }
              }}
              autoFocus
            />
            {passwordModal.error ? <p className="error-text">{passwordModal.error}</p> : null}
            <div className="password-modal-actions">
              <button type="button" className="secondary-button" onClick={handlePasswordModalCancel}>
                {ui.passwordCancel}
              </button>
              <button type="submit" className="primary-button">
                {ui.passwordUnlock}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
