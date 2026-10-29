import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { COMPRESS_COPY, translateStaticStatus, type Lang } from './i18n';
import { checkPasswordException } from './pdfEncryption';
import {
  compressPdfBytes,
  formatFileSize,
  PRESET_CONFIGS,
  type CompressionResult,
  type CompressionSettings,
} from './pdfCompression';

GlobalWorkerOptions.workerSrc = workerSrc;

type CompressSourceItem = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  isEncrypted: boolean;
  password?: string;
  result?: CompressionResult;
  appliedKey?: string;
};

type PreviewComparisonMode = 'compressed' | 'original';
type SimpleLevelId = 'light' | 'balanced' | 'aggressive';

const LEVEL_ITEMS: ReadonlyArray<{ id: SimpleLevelId; strength: 1 | 2 | 3 }> = [
  { id: 'light', strength: 1 },
  { id: 'balanced', strength: 2 },
  { id: 'aggressive', strength: 3 },
];

// Files >= 20 MB require clicking "Start Compression" instead of auto-compressing on upload/level change
const LARGE_FILE_THRESHOLD_BYTES = 20 * 1024 * 1024;

const COPY = COMPRESS_COPY;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

type CompressToolProps = {
  lang: Lang;
  onPdfLoadedChange: (loaded: boolean) => void;
};

export default function CompressTool({ lang, onPdfLoadedChange }: CompressToolProps) {
  const ui = COPY[lang];
  const [items, setItems] = useState<CompressSourceItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [level, setLevel] = useState<SimpleLevelId>('balanced');
  const [comparisonMode, setComparisonMode] = useState<PreviewComparisonMode>('compressed');
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [status, setStatus] = useState<string>(() => COPY[lang].statusWaiting);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isDragOverPreview, setIsDragOverPreview] = useState(false);
  const [keepEncryption, setKeepEncryption] = useState(true);
  const [passwordModal, setPasswordModal] = useState<{
    fileName: string;
    error: string;
    resolve: (password: string | null) => void;
  } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [previewViewportSize, setPreviewViewportSize] = useState({ width: 0, height: 0 });
  const compressionJobRef = useRef(0);

  const settings = useMemo<CompressionSettings>(
    () => ({
      preset: level,
      ...PRESET_CONFIGS[level],
    }),
    [level],
  );

  const activeConfigKey = `${level}:${keepEncryption ? 'enc' : 'plain'}`;

  const prevLangRef = useRef<Lang>(lang);

  useEffect(() => {
    onPdfLoadedChange(items.length > 0);
  }, [items.length, onPdfLoadedChange]);

  useEffect(() => {
    const node = previewWrapRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const updateSize = () => {
      if (node.clientWidth === 0 || node.clientHeight === 0) return;
      const style = window.getComputedStyle(node);
      const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      setPreviewViewportSize({
        width: Math.max(0, node.clientWidth - padX),
        height: Math.max(0, node.clientHeight - padY),
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const selectedItem = useMemo(() => {
    if (items.length === 0) return null;
    return items.find((item) => item.id === selectedItemId) ?? items[0];
  }, [items, selectedItemId]);

  const totalPages = useMemo(
    () => items.reduce((sum, item) => sum + item.pageCount, 0),
    [items],
  );

  const hasEncryptedItem = useMemo(
    () => items.some((item) => item.isEncrypted),
    [items],
  );

  const totalOriginalBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.bytes.byteLength, 0),
    [items],
  );

  const isLargeBatch = totalOriginalBytes >= LARGE_FILE_THRESHOLD_BYTES;

  const hasPendingCompression = useMemo(
    () => items.length > 0 && items.some((item) => item.appliedKey !== activeConfigKey),
    [items, activeConfigKey],
  );

  const aggregateStats = useMemo(() => {
    let originalTotal = 0;
    let compressedTotal = 0;
    let anyCompressed = false;

    for (const item of items) {
      originalTotal += item.bytes.byteLength;
      if (item.result && item.appliedKey === activeConfigKey) {
        compressedTotal += item.result.stats.compressedSize;
        anyCompressed = true;
      } else {
        compressedTotal += item.bytes.byteLength;
      }
    }

    const savedBytes = Math.max(0, originalTotal - compressedTotal);
    const savedPercent =
      originalTotal > 0 ? Math.max(0, ((originalTotal - compressedTotal) / originalTotal) * 100) : 0;

    return {
      originalTotal,
      compressedTotal,
      savedBytes,
      savedPercent,
      anyCompressed,
    };
  }, [items, activeConfigKey]);

  useLayoutEffect(() => {
    const prevLang = prevLangRef.current;
    if (prevLang === lang) return;
    prevLangRef.current = lang;
    setStatus((current) => {
      const translated = translateStaticStatus(COPY, prevLang, lang, current);
      if (translated !== current) {
        return translated;
      }
      if (items.length > 0 && aggregateStats.anyCompressed) {
        return aggregateStats.savedPercent > 0.1
          ? COPY[lang].statusDone(aggregateStats.savedPercent.toFixed(1))
          : COPY[lang].statusNoSavings;
      }
      if (items.length === 0) {
        return COPY[lang].statusWaiting;
      }
      return current;
    });
  }, [lang, items.length, aggregateStats.anyCompressed, aggregateStats.savedPercent]);

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
    if (!passwordModal) return;
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
    if (!passwordModal) return;
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
        const pageCount = previewDoc.numPages;
        await previewDoc.destroy();
        return { pageCount, password, isEncrypted };
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

  async function runCompressionBatch(
    targetItems: CompressSourceItem[],
    activeSettings: CompressionSettings,
    encryptFlag: boolean,
    configKey: string,
  ) {
    if (targetItems.length === 0) return;

    const jobId = ++compressionJobRef.current;
    setIsProcessing(true);
    setProgressPercent(2);
    setError('');

    try {
      const updated: CompressSourceItem[] = [...targetItems];
      const totalFiles = updated.length;

      for (let i = 0; i < totalFiles; i += 1) {
        if (compressionJobRef.current !== jobId) return;
        const item = updated[i];

        const result = await compressPdfBytes(item.bytes, activeSettings, {
          isEncrypted: item.isEncrypted,
          password: item.password,
          encryptPassword: item.isEncrypted && encryptFlag ? (item.password ?? '') : undefined,
          onProgress: (fileRatio) => {
            if (compressionJobRef.current !== jobId) return;
            const overallRatio = (i + Math.min(1, Math.max(0, fileRatio))) / totalFiles;
            const pct = Math.min(99, Math.max(1, Math.round(overallRatio * 100)));
            setProgressPercent(pct);
            setStatus(ui.statusCompressing(pct));
          },
        });

        if (compressionJobRef.current !== jobId) return;
        updated[i] = {
          ...item,
          result,
          appliedKey: configKey,
        };
        setItems([...updated]);
      }

      if (compressionJobRef.current !== jobId) return;
      setProgressPercent(100);

      const origSum = updated.reduce((s, it) => s + it.bytes.byteLength, 0);
      const compSum = updated.reduce(
        (s, it) => s + (it.result?.stats.compressedSize ?? it.bytes.byteLength),
        0,
      );
      const pct = origSum > 0 ? Math.max(0, ((origSum - compSum) / origSum) * 100) : 0;

      if (pct > 0.05) {
        setStatus(ui.statusDone(pct.toFixed(1)));
      } else {
        setStatus(ui.statusNoSavings);
      }
    } catch (err) {
      if (compressionJobRef.current !== jobId) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(ui.compressFail(message));
      setStatus(ui.statusFail);
    } finally {
      if (compressionJobRef.current === jobId) {
        setIsProcessing(false);
      }
    }
  }

  async function loadFiles(fileList: File[]) {
    if (fileList.length === 0) return;
    setIsProcessing(true);
    setProgressPercent(0);
    setError('');
    setStatus(ui.statusReading);

    try {
      const newItems: CompressSourceItem[] = [];
      for (const file of fileList) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const opened = await openPdfWithPassword(file.name, bytes);
        if (!opened) continue;

        newItems.push({
          id: createId('compress'),
          name: file.name,
          bytes,
          pageCount: opened.pageCount,
          isEncrypted: opened.isEncrypted,
          ...(opened.password ? { password: opened.password } : {}),
        });
      }

      if (newItems.length === 0) {
        setIsProcessing(false);
        setStatus(
          items.length > 0 ? ui.statusDone(aggregateStats.savedPercent.toFixed(1)) : ui.statusWaiting,
        );
        return;
      }

      const nextKeepEncryption =
        newItems.some((s) => s.isEncrypted) && !items.some((s) => s.isEncrypted)
          ? true
          : keepEncryption;
      if (nextKeepEncryption !== keepEncryption) {
        setKeepEncryption(nextKeepEncryption);
      }

      const combined = [...items, ...newItems];
      setItems(combined);
      setSelectedItemId(newItems[newItems.length - 1].id);
      setPreviewPageIndex(0);

      const combinedBytes = combined.reduce((sum, it) => sum + it.bytes.byteLength, 0);
      const nextConfigKey = `${level}:${nextKeepEncryption ? 'enc' : 'plain'}`;

      if (combinedBytes >= LARGE_FILE_THRESHOLD_BYTES) {
        setIsProcessing(false);
        setStatus(ui.statusReadyToStart);
      } else {
        await runCompressionBatch(combined, settings, nextKeepEncryption, nextConfigKey);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(ui.readFail(message));
      setStatus(ui.statusFail);
      setIsProcessing(false);
    }
  }

  // Auto-compress when level, thumbnailMode, or keepEncryption changes ONLY for small files (< 20 MB)
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (items.length === 0) return;

    if (isLargeBatch) {
      setStatus(ui.statusReadyToStart);
      return;
    }

    const timer = window.setTimeout(() => {
      void runCompressionBatch(items, settings, keepEncryption, activeConfigKey);
    }, 120);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, keepEncryption]);

  useEffect(() => {
    let cancelled = false;
    async function renderPreview() {
      const canvas = canvasRef.current;
      if (!canvas || !selectedItem) return;

      const hasCurrentResult =
        selectedItem.result && selectedItem.appliedKey === activeConfigKey;

      const bytesToRender =
        comparisonMode === 'compressed' && hasCurrentResult
          ? selectedItem.result!.bytes
          : selectedItem.bytes;

      const usePassword =
        comparisonMode === 'original' || !hasCurrentResult
          ? selectedItem.password
          : selectedItem.isEncrypted && keepEncryption
            ? selectedItem.password
            : undefined;

      try {
        const previewDoc = await getDocument({
          data: new Uint8Array(bytesToRender),
          ...(usePassword ? { password: usePassword } : {}),
        }).promise;

        if (cancelled) {
          await previewDoc.destroy();
          return;
        }

        const safePageIndex = Math.min(Math.max(0, previewPageIndex), previewDoc.numPages - 1);
        const page = await previewDoc.getPage(safePageIndex + 1);
        const baseViewport = page.getViewport({ scale: 1 });

        const maxW = previewViewportSize.width > 40 ? previewViewportSize.width : 640;
        const maxH = previewViewportSize.height > 40 ? previewViewportSize.height : 620;
        const cssScale = Math.min(maxW / baseViewport.width, maxH / baseViewport.height);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const renderViewport = page.getViewport({ scale: Math.max(0.2, cssScale * dpr) });

        canvas.width = Math.max(1, Math.floor(renderViewport.width));
        canvas.height = Math.max(1, Math.floor(renderViewport.height));
        canvas.style.width = `${Math.max(1, Math.floor(baseViewport.width * cssScale))}px`;
        canvas.style.height = `${Math.max(1, Math.floor(baseViewport.height * cssScale))}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({
            canvasContext: ctx,
            viewport: renderViewport,
          } as Parameters<typeof page.render>[0]).promise;
        }

        await previewDoc.destroy();
      } catch {
        // Ignore transient preview errors
      }
    }

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [selectedItem, comparisonMode, previewPageIndex, previewViewportSize, keepEncryption, activeConfigKey]);

  function downloadFileItem(item: CompressSourceItem) {
    const outBytes = item.result?.bytes ?? item.bytes;
    const buffer = new ArrayBuffer(outBytes.byteLength);
    new Uint8Array(buffer).set(outBytes);
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const baseName = item.name.replace(/\.pdf$/i, '');
    anchor.download = `${baseName}-compressed.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(ui.statusExportDone);
  }

  function handlePrimaryAction() {
    if (items.length === 0 || isProcessing) return;
    if (isLargeBatch && hasPendingCompression) {
      void runCompressionBatch(items, settings, keepEncryption, activeConfigKey);
      return;
    }
    if (items.length === 1) {
      downloadFileItem(items[0]);
      return;
    }
    items.forEach((item, idx) => {
      window.setTimeout(() => {
        downloadFileItem(item);
      }, idx * 180);
    });
  }

  async function handlePrint() {
    if (!selectedItem) return;
    setIsProcessing(true);
    setError('');
    try {
      let printBytes = selectedItem.result?.bytes ?? selectedItem.bytes;
      if (selectedItem.isEncrypted && keepEncryption) {
        const unencryptedRes = await compressPdfBytes(selectedItem.bytes, settings, {
          isEncrypted: selectedItem.isEncrypted,
          password: selectedItem.password,
          encryptPassword: undefined,
        });
        printBytes = unencryptedRes.bytes;
      }
      const buffer = new ArrayBuffer(printBytes.byteLength);
      new Uint8Array(buffer).set(printBytes);
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.focus();
          printWindow.print();
        });
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(ui.statusPrintReady);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(ui.compressFail(message));
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemoveItem(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    if (selectedItemId === id) {
      setSelectedItemId(next[0]?.id ?? null);
      setPreviewPageIndex(0);
    }
    if (next.length === 0) {
      setStatus(ui.statusCleared);
    }
  }

  function handleClearAll() {
    compressionJobRef.current += 1;
    setItems([]);
    setSelectedItemId(null);
    setPreviewPageIndex(0);
    setIsProcessing(false);
    setProgressPercent(0);
    setError('');
    setStatus(ui.statusCleared);
  }

  async function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    event.target.value = '';
    await loadFiles(files);
  }

  async function handlePreviewDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOverPreview(false);
    if (isProcessing) return;
    const dropped = Array.from(event.dataTransfer.files ?? []).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (dropped.length > 0) {
      await loadFiles(dropped);
    }
  }

  const showStartCompressButton = isLargeBatch && hasPendingCompression;

  return (
    <div>
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">{ui.eyebrow}</p>
          <h1>{ui.heroTitle}</h1>
          <p className="subtitle">{ui.heroSubtitle}</p>
        </div>
        <div className={`hero-card ${items.length > 0 ? 'is-ready' : ''}`} role="status">
          <span className="hero-card-dot" aria-hidden="true" />
          <div className="hero-card-text">
            <span>{status}</span>
            <strong>{items.length > 0 ? ui.filesLoaded(items.length, totalPages) : ui.filesNotLoaded}</strong>
          </div>
        </div>
      </header>

      <main className="layout compress-layout">
        <section className="panel controls-panel compress-controls-panel">
          <div className="panel-header">
            <h2>{ui.panelTitle}</h2>
            <p>{ui.panelDesc}</p>
          </div>

          <label className={`file-dropzone ${items.length > 0 ? 'has-file' : ''}`}>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={handleFileInputChange}
              disabled={isProcessing}
            />
            <span className="file-dropzone-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.5 14.5v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <strong>{ui.choosePdf}</strong>
            </div>
          </label>

          <div className="compress-queue-section">
            <div className="compress-queue-header">
              <span className="compress-section-label">
                {ui.fileListTitle}
                <span className="compress-queue-count">{items.length}</span>
              </span>
              {items.length > 0 ? (
                <button
                  type="button"
                  className="range-chip compress-clear-chip"
                  onClick={handleClearAll}
                  disabled={isProcessing}
                >
                  {ui.clearAllBtn}
                </button>
              ) : null}
            </div>

            {items.length > 0 ? (
              <div className="compress-file-list" role="list" aria-label={ui.fileListTitle}>
                {items.map((item) => {
                  const origBytes = item.bytes.byteLength;
                  const isUpToDate = item.result && item.appliedKey === activeConfigKey;
                  const compBytes = isUpToDate ? item.result!.stats.compressedSize : origBytes;
                  const savedPct = isUpToDate ? item.result!.stats.savedPercent : 0;
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      role="listitem"
                      className={`compress-file-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setPreviewPageIndex(0);
                      }}
                    >
                      <div className="compress-file-info">
                        <strong>{item.name}</strong>
                        <div className="compress-file-meta">
                          <span>
                            {isUpToDate
                              ? `${formatFileSize(origBytes)} → ${formatFileSize(compBytes)}`
                              : formatFileSize(origBytes)}
                          </span>
                        </div>
                      </div>
                      <div className="compress-file-actions">
                        <span
                          className={`compress-badge ${
                            !isUpToDate ? '' : savedPct > 0.1 ? 'is-saved' : ''
                          }`}
                        >
                          {!isUpToDate
                            ? ui.pendingBadge
                            : savedPct > 0.1
                              ? ui.savedBadge(savedPct.toFixed(1))
                              : ui.alreadyOptimal}
                        </span>
                        {items.length > 1 && isUpToDate ? (
                          <button
                            type="button"
                            className="range-chip"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFileItem(item);
                            }}
                            disabled={isProcessing}
                          >
                            {ui.downloadItem}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="range-chip danger-confirm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item.id);
                          }}
                          disabled={isProcessing}
                        >
                          {ui.removeItem}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="compress-queue-empty">{ui.filesNotLoaded}</div>
            )}
          </div>

          <div className="compress-bottom-controls">
            <div className="compress-level-section">
              <span className="compress-section-label">{ui.levelLabel}</span>
              <div className="compress-level-grid" role="radiogroup" aria-label={ui.levelLabel}>
                {LEVEL_ITEMS.map(({ id, strength }) => {
                  const isActive = level === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`compress-level-card ${isActive ? 'active' : ''}`}
                      onClick={() => setLevel(id)}
                      disabled={isProcessing}
                    >
                      <span className="compress-level-title">{ui.levels[id]}</span>
                      <span className="compress-meter" aria-hidden="true">
                        {[1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            className={`compress-meter-bar bar-${bar} ${bar <= strength ? 'is-filled' : ''}`}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isProcessing ? (
              <div className="compress-progress-wrap" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                <div className="compress-progress-header">
                  <span>{ui.compressingProgress(progressPercent)}</span>
                  <strong>{progressPercent}%</strong>
                </div>
                <div className="compress-progress-track">
                  <div
                    className="compress-progress-fill"
                    style={{ width: `${Math.max(4, progressPercent)}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="summary-card compress-summary-card">
              <div className="compress-summary-row">
                <span>{ui.summaryOriginal}</span>
                <strong>{formatFileSize(aggregateStats.originalTotal)}</strong>
              </div>
              <div className="compress-summary-row">
                <span>{ui.summaryCompressed}</span>
                <strong>
                  {aggregateStats.anyCompressed ? formatFileSize(aggregateStats.compressedTotal) : '—'}
                </strong>
              </div>
              <div className="compress-summary-row">
                <span>{ui.summarySaved}</span>
                <strong className={aggregateStats.savedPercent > 0.1 ? 'compress-saved-highlight' : ''}>
                  {aggregateStats.anyCompressed
                    ? `${formatFileSize(aggregateStats.savedBytes)} (${aggregateStats.savedPercent.toFixed(1)}%)`
                    : '—'}
                </strong>
              </div>
            </div>

            {items.length > 0 && hasEncryptedItem ? (
              <label className="encryption-checkbox-row">
                <input
                  type="checkbox"
                  checked={keepEncryption}
                  onChange={(event) => setKeepEncryption(event.target.checked)}
                  disabled={isProcessing}
                />
                <span>{ui.keepEncryptionLabel}</span>
              </label>
            ) : null}

            <div className="action-row compress-action-row">
              <button
                className="primary-button"
                type="button"
                onClick={handlePrimaryAction}
                disabled={isProcessing || items.length === 0}
              >
                {isProcessing
                  ? ui.compressingProgress(progressPercent)
                  : showStartCompressButton
                    ? ui.startCompressBtn
                    : items.length > 1
                      ? ui.downloadAll(items.length)
                      : ui.downloadSingle}
              </button>
              <button
                className="secondary-button print-button"
                type="button"
                onClick={handlePrint}
                disabled={isProcessing || !selectedItem || showStartCompressButton}
                title={ui.print}
              >
                <svg viewBox="0 0 24 24" className="print-icon" aria-hidden="true">
                  <path
                    d="M7 3h10a1 1 0 0 1 1 1v4H6V4a1 1 0 0 1 1-1zm0 14h10v4a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-4zm-2-7h14a3 3 0 0 1 3 3v4a1 1 0 0 1-1 1h-2v-3H5v3H3a1 1 0 0 1-1-1v-4a3 3 0 0 1 3-3zm13 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
                    fill="currentColor"
                  />
                </svg>
                <span className="print-label">{ui.print}</span>
              </button>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
          </div>
        </section>

        <section className="panel preview-panel margin-preview-panel compress-preview-panel">
          <div className="panel-header">
            <div className="preview-header-row">
              <h2>{ui.previewTitle}</h2>
              <div className="preview-nav">
                <div className="range-chip-row" role="group" aria-label="Comparison mode">
                  <button
                    type="button"
                    className={`range-chip ${comparisonMode === 'compressed' ? 'active' : ''}`}
                    onClick={() => setComparisonMode('compressed')}
                    disabled={!selectedItem}
                  >
                    {ui.viewCompressed}
                  </button>
                  <button
                    type="button"
                    className={`range-chip ${comparisonMode === 'original' ? 'active' : ''}`}
                    onClick={() => setComparisonMode('original')}
                    disabled={!selectedItem}
                  >
                    {ui.viewOriginal}
                  </button>
                </div>
                <button
                  type="button"
                  className="range-chip"
                  onClick={() => setPreviewPageIndex((p) => Math.max(0, p - 1))}
                  disabled={!selectedItem || previewPageIndex <= 0}
                >
                  {ui.previewPrev}
                </button>
                <span className="preview-counter">
                  {selectedItem
                    ? ui.previewPageCounter(previewPageIndex + 1, selectedItem.pageCount)
                    : ui.previewPageCounter(0, 0)}
                </span>
                <button
                  type="button"
                  className="range-chip"
                  onClick={() =>
                    setPreviewPageIndex((p) =>
                      selectedItem ? Math.min(selectedItem.pageCount - 1, p + 1) : 0,
                    )
                  }
                  disabled={!selectedItem || previewPageIndex >= selectedItem.pageCount - 1}
                >
                  {ui.previewNext}
                </button>
              </div>
            </div>
            <p>{ui.previewDesc}</p>
          </div>

          <div
            ref={previewWrapRef}
            className={`preview-wrap margin-preview-wrap compress-preview-wrap ${isDragOverPreview ? 'is-drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isDragOverPreview) setIsDragOverPreview(true);
            }}
            onDragLeave={(e) => {
              const nextTarget = e.relatedTarget as Node | null;
              if (nextTarget && e.currentTarget.contains(nextTarget)) return;
              setIsDragOverPreview(false);
            }}
            onDrop={handlePreviewDrop}
          >
            {selectedItem ? (
              <canvas ref={canvasRef} />
            ) : (
              <div className="empty-state">{ui.previewEmpty}</div>
            )}
          </div>
        </section>
      </main>

      {passwordModal ? (
        <div
          className="password-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compress-password-title"
        >
          <form className="password-modal" onSubmit={handlePasswordModalSubmit}>
            <h3 id="compress-password-title">{ui.passwordTitle}</h3>
            <p>{ui.passwordDesc(passwordModal.fileName)}</p>
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              placeholder={ui.passwordPlaceholder}
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
