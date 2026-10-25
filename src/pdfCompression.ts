import {
  decodePDFRawStream,
  PDFArray,
  PDFContext,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { savePdfWithOptionalEncryption } from './pdfEncryption';

export type CompressionPresetId = 'light' | 'balanced' | 'aggressive' | 'lossless' | 'extreme' | 'custom';

export interface CompressionSettings {
  preset: CompressionPresetId;
  imageQuality: number; // 10 - 95
  targetDpi: number; // 72, 96, 120, 150, 200, 300
  recompressImages: boolean;
  convertToGrayscale: boolean;
  cleanMetadata: boolean;
  deduplicateResources: boolean;
  rasterizePages: boolean;
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercent: number;
  pageCount: number;
  imagesInspectCount: number;
  imagesRecompressedCount: number;
  imagesDownsampledCount: number;
  duplicatesMergedCount: number;
  streamsCompressedCount: number;
  orphansRemovedCount: number;
  usedOriginalFallback: boolean;
}

export interface CompressionResult {
  bytes: Uint8Array;
  stats: CompressionStats;
}

export const PRESET_CONFIGS: Record<Exclude<CompressionPresetId, 'custom'>, Omit<CompressionSettings, 'preset'>> = {
  light: {
    imageQuality: 82,
    targetDpi: 200,
    recompressImages: true,
    convertToGrayscale: false,
    cleanMetadata: true,
    deduplicateResources: true,
    rasterizePages: false,
  },
  balanced: {
    imageQuality: 65,
    targetDpi: 150,
    recompressImages: true,
    convertToGrayscale: false,
    cleanMetadata: true,
    deduplicateResources: true,
    rasterizePages: false,
  },
  aggressive: {
    imageQuality: 42,
    targetDpi: 96,
    recompressImages: true,
    convertToGrayscale: false,
    cleanMetadata: true,
    deduplicateResources: true,
    rasterizePages: false,
  },
  lossless: {
    imageQuality: 90,
    targetDpi: 300,
    recompressImages: false,
    convertToGrayscale: false,
    cleanMetadata: true,
    deduplicateResources: true,
    rasterizePages: false,
  },
  extreme: {
    imageQuality: 50,
    targetDpi: 120,
    recompressImages: true,
    convertToGrayscale: false,
    cleanMetadata: true,
    deduplicateResources: true,
    rasterizePages: true,
  },
};

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value >= 100 || idx === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[idx]}`;
}

export function detectPresetFromSettings(settings: Omit<CompressionSettings, 'preset'>): CompressionPresetId {
  const keys = Object.keys(PRESET_CONFIGS) as Array<Exclude<CompressionPresetId, 'custom'>>;
  for (const key of keys) {
    const cfg = PRESET_CONFIGS[key];
    if (
      cfg.recompressImages === settings.recompressImages &&
      cfg.convertToGrayscale === settings.convertToGrayscale &&
      cfg.cleanMetadata === settings.cleanMetadata &&
      cfg.deduplicateResources === settings.deduplicateResources &&
      cfg.rasterizePages === settings.rasterizePages &&
      (!cfg.recompressImages && !cfg.rasterizePages
        ? true
        : cfg.imageQuality === settings.imageQuality && cfg.targetDpi === settings.targetDpi)
    ) {
      return key;
    }
  }
  return 'custom';
}

function hashBytes(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${bytes.length}:${hash.toString(16)}`;
}

function getStreamRawBytes(stream: PDFRawStream | PDFStream): Uint8Array | null {
  try {
    if (stream instanceof PDFRawStream) {
      return stream.contents;
    }
    return stream.getContents();
  } catch {
    return null;
  }
}

function isJpegFilter(dict: PDFDict): boolean {
  const filter = dict.get(PDFName.of('Filter'));
  if (filter instanceof PDFName) {
    return filter.toString() === '/DCTDecode';
  }
  if (filter instanceof PDFArray && filter.size() === 1) {
    const first = filter.get(0);
    return first instanceof PDFName && first.toString() === '/DCTDecode';
  }
  return false;
}

function isFlateOrUnfiltered(dict: PDFDict): boolean {
  const filter = dict.get(PDFName.of('Filter'));
  if (!filter) {
    return true;
  }
  if (filter instanceof PDFName) {
    return filter.toString() === '/FlateDecode';
  }
  if (filter instanceof PDFArray && filter.size() === 1) {
    const first = filter.get(0);
    return first instanceof PDFName && first.toString() === '/FlateDecode';
  }
  return false;
}

function getColorSpaceInfo(
  dict: PDFDict,
  context: PDFContext,
): { name: string; components: number } {
  const cs = dict.get(PDFName.of('ColorSpace'));
  const resolved = cs instanceof PDFRef ? context.lookup(cs) : cs;
  if (resolved instanceof PDFName) {
    const name = resolved.toString().replace('/', '');
    const components = name === 'DeviceGray' || name === 'CalGray' ? 1 : name === 'DeviceCMYK' ? 4 : 3;
    return { name, components };
  }
  if (resolved instanceof PDFArray && resolved.size() > 0) {
    const first = resolved.get(0);
    const firstResolved = first instanceof PDFRef ? context.lookup(first) : first;
    if (firstResolved instanceof PDFName) {
      const name = firstResolved.toString().replace('/', '');
      if (name === 'ICCBased' && resolved.size() > 1) {
        const profileRef = resolved.get(1);
        const profileObj = profileRef instanceof PDFRef ? context.lookup(profileRef) : profileRef;
        if (profileObj instanceof PDFRawStream || profileObj instanceof PDFStream) {
          const nObj = profileObj.dict.get(PDFName.of('N'));
          const n = nObj instanceof PDFNumber ? nObj.asNumber() : Number(nObj?.toString() ?? 3);
          if (n === 1 || n === 3 || n === 4) {
            return { name: 'ICCBased', components: n };
          }
        }
        return { name: 'ICCBased', components: 3 };
      }
      const components = name === 'CalGray' ? 1 : 3;
      return { name, components };
    }
  }
  return { name: 'DeviceRGB', components: 3 };
}

function isHardMask(dict: PDFDict): boolean {
  return dict.has(PDFName.of('Mask')) || dict.has(PDFName.of('ImageMask'));
}

function isSmaskFullyOpaque(dict: PDFDict, context: PDFContext): boolean {
  const smaskRef = dict.get(PDFName.of('SMask'));
  const smaskObj = smaskRef instanceof PDFRef ? context.lookup(smaskRef) : smaskRef;
  if (!(smaskObj instanceof PDFRawStream)) return false;
  const { width, height } = getImageDimensions(smaskObj.dict);
  if (width <= 0 || height <= 0) return false;
  const pixels = decodeFlateImagePixels(smaskObj, width, height, 1);
  if (!pixels || pixels.length === 0) return false;
  for (let i = 0; i < pixels.length; i += 1) {
    if (pixels[i] < 254) return false;
  }
  return true;
}

function getImageDimensions(dict: PDFDict): { width: number; height: number } {
  const w = dict.get(PDFName.of('Width'));
  const h = dict.get(PDFName.of('Height'));
  return {
    width: w instanceof PDFNumber ? w.asNumber() : Number(w?.toString() ?? 0),
    height: h instanceof PDFNumber ? h.asNumber() : Number(h?.toString() ?? 0),
  };
}

function estimateImageDpi(width: number, height: number): number {
  const maxDim = Math.max(width, height);
  // Typical embedded image/figure span on a page is ~6.5 inches
  return Math.round(maxDim / 6.5);
}

function applyGrayscaleToContext(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const clampedQuality = Math.min(0.95, Math.max(0.1, quality / 100));
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', clampedQuality);
  });
  if (blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const dataUrl = canvas.toDataURL('image/jpeg', clampedQuality);
  const base64 = dataUrl.split(',')[1] ?? '';
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodeFlateImagePixels(
  rawStream: PDFRawStream,
  width: number,
  height: number,
  components: number,
): Uint8Array | null {
  try {
    const decoded = decodePDFRawStream(rawStream).decode();
    const rowBytes = width * components;
    const expectedWithoutPredictor = height * rowBytes;
    const expectedWithPredictor = height * (rowBytes + 1);

    if (decoded.length === expectedWithoutPredictor) {
      return decoded;
    }

    if (decoded.length === expectedWithPredictor) {
      const out = new Uint8Array(expectedWithoutPredictor);
      let srcOffset = 0;
      let dstOffset = 0;
      for (let y = 0; y < height; y += 1) {
        const filterType = decoded[srcOffset++];
        for (let x = 0; x < rowBytes; x += 1) {
          let val = decoded[srcOffset++];
          const left = x >= components ? out[dstOffset - components] : 0;
          const above = y > 0 ? out[dstOffset - rowBytes] : 0;
          const upperLeft = x >= components && y > 0 ? out[dstOffset - rowBytes - components] : 0;
          if (filterType === 1) {
            val = (val + left) & 0xff;
          } else if (filterType === 2) {
            val = (val + above) & 0xff;
          } else if (filterType === 3) {
            val = (val + ((left + above) >> 1)) & 0xff;
          } else if (filterType === 4) {
            val = (val + paethPredictor(left, above, upperLeft)) & 0xff;
          }
          out[dstOffset++] = val;
        }
      }
      return out;
    }

    return null;
  } catch {
    return null;
  }
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function recompressImageXObjects(
  pdfDoc: PDFDocument,
  settings: CompressionSettings,
  onProgress?: (progressRatio: number) => Promise<void> | void,
): Promise<{
  inspected: number;
  recompressed: number;
  downsampled: number;
}> {
  const context = pdfDoc.context;
  const candidates: Array<{ ref: PDFRef; stream: PDFRawStream }> = [];
  const maskRefs = new Set<string>();

  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    const smask = dict.get(PDFName.of('SMask'));
    if (smask instanceof PDFRef) {
      maskRefs.add(`${smask.objectNumber}-${smask.generationNumber}`);
    }
    const mask = dict.get(PDFName.of('Mask'));
    if (mask instanceof PDFRef) {
      maskRefs.add(`${mask.objectNumber}-${mask.generationNumber}`);
    }
  }

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    if (maskRefs.has(`${ref.objectNumber}-${ref.generationNumber}`)) continue;
    const dict = obj.dict;
    const subtype = dict.get(PDFName.of('Subtype'));
    if (!(subtype instanceof PDFName) || subtype.toString() !== '/Image') continue;
    candidates.push({ ref, stream: obj });
  }

  let recompressed = 0;
  let downsampled = 0;

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const { ref, stream } = candidates[idx];
    const dict = stream.dict;
    await onProgress?.((idx + 1) / Math.max(1, candidates.length));

    if (isHardMask(dict)) {
      continue;
    }

    const hasSmask = dict.has(PDFName.of('SMask'));
    const canDropSmask = hasSmask && isSmaskFullyOpaque(dict, context);

    const { width, height } = getImageDimensions(dict);
    if (width < 32 || height < 32 || width > 8192 || height > 8192) {
      continue;
    }

    const bpcObj = dict.get(PDFName.of('BitsPerComponent'));
    const bpc = bpcObj instanceof PDFNumber ? bpcObj.asNumber() : 8;
    if (bpc !== 8) {
      continue;
    }

    const rawBytes = stream.contents;
    if (!rawBytes || rawBytes.length < 2048) {
      continue;
    }

    const { name: csName, components } = getColorSpaceInfo(dict, context);
    if (csName === 'Indexed' || csName === 'Separation' || csName === 'DeviceN' || csName === 'Lab') {
      continue;
    }

    // Calculate target dimensions based on targetDpi (only downsample if no active non-opaque SMask)
    const estDpi = estimateImageDpi(width, height);
    let targetW = width;
    let targetH = height;
    let wasDownsampled = false;

    if ((!hasSmask || canDropSmask) && estDpi > settings.targetDpi * 1.12) {
      const scale = settings.targetDpi / estDpi;
      const nextW = Math.max(32, Math.round(width * scale));
      const nextH = Math.max(32, Math.round(height * scale));
      if (nextW < width && nextH < height) {
        targetW = nextW;
        targetH = nextH;
        wasDownsampled = true;
      }
    }

    try {
      if (isJpegFilter(dict)) {
        if (csName === 'DeviceCMYK' || components === 4) {
          continue;
        }
        const blob = new Blob([new Uint8Array(rawBytes)], { type: 'image/jpeg' });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          bitmap.close();
          continue;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        bitmap.close();

        if (settings.convertToGrayscale) {
          applyGrayscaleToContext(ctx, targetW, targetH);
        }

        const nextJpegBytes = await canvasToJpegBytes(canvas, settings.imageQuality);
        if (nextJpegBytes.length < rawBytes.length || settings.convertToGrayscale) {
          const newDict = dict.clone(context);
          newDict.set(PDFName.of('Length'), PDFNumber.of(nextJpegBytes.length));
          newDict.set(PDFName.of('Width'), PDFNumber.of(targetW));
          newDict.set(PDFName.of('Height'), PDFNumber.of(targetH));
          newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
          newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
          newDict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
          newDict.delete(PDFName.of('DecodeParms'));
          if (canDropSmask) {
            newDict.delete(PDFName.of('SMask'));
          }
          context.assign(ref, PDFRawStream.of(newDict, nextJpegBytes));
          recompressed += 1;
          if (wasDownsampled) downsampled += 1;
        }
      } else if (
        isFlateOrUnfiltered(dict) &&
        (components === 1 || components === 3) &&
        (csName === 'DeviceRGB' ||
          csName === 'DeviceGray' ||
          csName === 'CalRGB' ||
          csName === 'CalGray' ||
          csName === 'ICCBased')
      ) {
        const pixels = decodeFlateImagePixels(stream, width, height, components);
        if (!pixels) continue;

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width;
        srcCanvas.height = height;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) continue;

        const imgData = srcCtx.createImageData(width, height);
        const rgba = imgData.data;
        let srcIdx = 0;
        let dstIdx = 0;
        const totalPixels = width * height;
        for (let p = 0; p < totalPixels; p += 1) {
          if (components === 1) {
            const g = pixels[srcIdx++];
            rgba[dstIdx++] = g;
            rgba[dstIdx++] = g;
            rgba[dstIdx++] = g;
            rgba[dstIdx++] = 255;
          } else {
            rgba[dstIdx++] = pixels[srcIdx++];
            rgba[dstIdx++] = pixels[srcIdx++];
            rgba[dstIdx++] = pixels[srcIdx++];
            rgba[dstIdx++] = 255;
          }
        }
        srcCtx.putImageData(imgData, 0, 0);

        let targetCanvas = srcCanvas;
        let targetCtx = srcCtx;
        if (wasDownsampled) {
          targetCanvas = document.createElement('canvas');
          targetCanvas.width = targetW;
          targetCanvas.height = targetH;
          const ctx2 = targetCanvas.getContext('2d');
          if (!ctx2) continue;
          ctx2.imageSmoothingEnabled = true;
          ctx2.imageSmoothingQuality = 'high';
          ctx2.drawImage(srcCanvas, 0, 0, targetW, targetH);
          targetCtx = ctx2;
        }

        if (settings.convertToGrayscale) {
          applyGrayscaleToContext(targetCtx, targetW, targetH);
        }

        const nextJpegBytes = await canvasToJpegBytes(targetCanvas, settings.imageQuality);
        if (nextJpegBytes.length < rawBytes.length * 0.92) {
          const newDict = dict.clone(context);
          newDict.set(PDFName.of('Length'), PDFNumber.of(nextJpegBytes.length));
          newDict.set(PDFName.of('Width'), PDFNumber.of(targetW));
          newDict.set(PDFName.of('Height'), PDFNumber.of(targetH));
          newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
          newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
          newDict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
          newDict.delete(PDFName.of('DecodeParms'));
          if (canDropSmask) {
            newDict.delete(PDFName.of('SMask'));
          }
          context.assign(ref, PDFRawStream.of(newDict, nextJpegBytes));
          recompressed += 1;
          if (wasDownsampled) downsampled += 1;
        }
      }
    } catch {
      // Skip individual image if browser fails to decode it
    }
  }

  return {
    inspected: candidates.length,
    recompressed,
    downsampled,
  };
}

function cleanDocumentStructureAndMetadata(pdfDoc: PDFDocument) {
  try {
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
  } catch {
    // ignore metadata errors
  }

  const catalog = pdfDoc.catalog;
  for (const key of ['Metadata', 'PieceInfo', 'SpiderInfo', 'IDS', 'URLS']) {
    if (catalog.has(PDFName.of(key))) {
      catalog.delete(PDFName.of(key));
    }
  }

  for (const page of pdfDoc.getPages()) {
    const node = page.node;
    for (const key of ['Thumb', 'PieceInfo', 'Metadata']) {
      if (node.has(PDFName.of(key))) {
        node.delete(PDFName.of(key));
      }
    }
  }
}

function deduplicateStreamsAndCompressUnfiltered(pdfDoc: PDFDocument): {
  duplicatesMerged: number;
  streamsCompressed: number;
} {
  const context = pdfDoc.context;
  let duplicatesMerged = 0;
  let streamsCompressed = 0;

  // 1. Compress any remaining unfiltered streams using pdf-lib's built-in flateStream
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.has(PDFName.of('Filter'))) continue;

    const rawBytes = getStreamRawBytes(obj);
    if (!rawBytes || rawBytes.length < 256) continue;

    try {
      const flate = context.flateStream(rawBytes);
      if (flate.contents.length + 16 < rawBytes.length) {
        const newDict = dict.clone(context);
        newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
        newDict.set(PDFName.of('Length'), PDFNumber.of(flate.contents.length));
        newDict.delete(PDFName.of('DecodeParms'));
        context.assign(ref, PDFRawStream.of(newDict, flate.contents));
        streamsCompressed += 1;
      }
    } catch {
      // ignore compression error on individual stream
    }
  }

  // 2. Deduplicate identical image & font streams
  const hashToCanonicalRef = new Map<string, PDFRef>();
  const remap = new Map<string, PDFRef>();

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    const rawBytes = obj.contents;
    if (!rawBytes || rawBytes.length < 1024) continue;

    const subtype = dict.get(PDFName.of('Subtype'))?.toString() ?? '';
    const filter = dict.get(PDFName.of('Filter'))?.toString() ?? '';
    const width = dict.get(PDFName.of('Width'))?.toString() ?? '';
    const height = dict.get(PDFName.of('Height'))?.toString() ?? '';
    const cs = dict.get(PDFName.of('ColorSpace'))?.toString() ?? '';
    const length1 = dict.get(PDFName.of('Length1'))?.toString() ?? '';

    const isImage = subtype === '/Image';
    const isFontStream = Boolean(length1) || subtype.includes('Font') || subtype === '/Type1C' || subtype === '/CIDFontType0C';
    if (!isImage && !isFontStream) continue;

    if (isImage && isHardMask(dict)) continue;

    const signature = `${subtype}|${filter}|${width}x${height}|${cs}|${length1}|${hashBytes(rawBytes)}`;
    const existing = hashToCanonicalRef.get(signature);
    if (existing) {
      remap.set(`${ref.objectNumber}-${ref.generationNumber}`, existing);
      duplicatesMerged += 1;
    } else {
      hashToCanonicalRef.set(signature, ref);
    }
  }

  if (remap.size > 0) {
    const remapObjectRefs = (obj: PDFObject, visited = new Set<string>()) => {
      if (obj instanceof PDFDict) {
        for (const [k, v] of obj.entries()) {
          if (v instanceof PDFRef) {
            const key = `${v.objectNumber}-${v.generationNumber}`;
            const replacement = remap.get(key);
            if (replacement) {
              obj.set(k, replacement);
            }
          } else if (v instanceof PDFDict || v instanceof PDFArray) {
            remapObjectRefs(v, visited);
          }
        }
      } else if (obj instanceof PDFArray) {
        for (let i = 0; i < obj.size(); i += 1) {
          const v = obj.get(i);
          if (v instanceof PDFRef) {
            const key = `${v.objectNumber}-${v.generationNumber}`;
            const replacement = remap.get(key);
            if (replacement) {
              obj.set(i, replacement);
            }
          } else if (v instanceof PDFDict || v instanceof PDFArray) {
            remapObjectRefs(v, visited);
          }
        }
      }
    };

    for (const [, obj] of context.enumerateIndirectObjects()) {
      if (obj instanceof PDFDict || obj instanceof PDFArray) {
        remapObjectRefs(obj);
      } else if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
        remapObjectRefs(obj.dict);
      }
    }
  }

  return { duplicatesMerged, streamsCompressed };
}

function collectReachableRefs(
  obj: PDFObject | undefined,
  context: PDFContext,
  reachable: Set<string>,
) {
  if (!obj) return;
  if (obj instanceof PDFRef) {
    const key = `${obj.objectNumber}-${obj.generationNumber}`;
    if (reachable.has(key)) return;
    reachable.add(key);
    const target = context.lookup(obj);
    if (target) {
      collectReachableRefs(target, context, reachable);
    }
    return;
  }
  if (obj instanceof PDFDict) {
    for (const [, val] of obj.entries()) {
      collectReachableRefs(val, context, reachable);
    }
    return;
  }
  if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i += 1) {
      collectReachableRefs(obj.get(i), context, reachable);
    }
    return;
  }
  if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
    collectReachableRefs(obj.dict, context, reachable);
  }
}

function removeOrphanObjects(pdfDoc: PDFDocument): number {
  const context = pdfDoc.context;
  const reachable = new Set<string>();

  collectReachableRefs(pdfDoc.catalog, context, reachable);
  if (context.trailerInfo.Root) {
    collectReachableRefs(context.trailerInfo.Root, context, reachable);
  }
  if (context.trailerInfo.Info) {
    collectReachableRefs(context.trailerInfo.Info, context, reachable);
  }

  const orphans: PDFRef[] = [];
  for (const [ref] of context.enumerateIndirectObjects()) {
    const key = `${ref.objectNumber}-${ref.generationNumber}`;
    if (!reachable.has(key)) {
      orphans.push(ref);
    }
  }

  for (const ref of orphans) {
    try {
      context.delete(ref);
    } catch {
      // ignore protected ref
    }
  }

  return orphans.length;
}

async function compressViaRasterization(
  sourceBytes: Uint8Array,
  settings: CompressionSettings,
  options?: {
    password?: string;
    encryptPassword?: string;
    onProgress?: (progressRatio: number) => void;
  },
): Promise<CompressionResult> {
  const originalSize = sourceBytes.byteLength;
  options?.onProgress?.(0.05);
  await yieldToMain();
  const pdfjsDoc = await getDocument({
    data: new Uint8Array(sourceBytes),
    ...(options?.password ? { password: options.password } : {}),
  }).promise;

  try {
    const numPages = pdfjsDoc.numPages;
    const outputDoc = await PDFDocument.create();
    const scale = Math.max(0.5, settings.targetDpi / 72);

    for (let i = 1; i <= numPages; i += 1) {
      options?.onProgress?.(0.08 + ((i - 1) / Math.max(1, numPages)) * 0.8);
      await yieldToMain();
      const page = await pdfjsDoc.getPage(i);
      const renderViewport = page.getViewport({ scale });
      const baseViewport = page.getViewport({ scale: 1 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Unable to create 2D canvas context for rasterization');
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: renderViewport,
      } as Parameters<typeof page.render>[0]).promise;

      if (settings.convertToGrayscale) {
        applyGrayscaleToContext(ctx, canvas.width, canvas.height);
      }

      const jpegBytes = await canvasToJpegBytes(canvas, settings.imageQuality);
      const embeddedJpg = await outputDoc.embedJpg(jpegBytes);
      const outPage = outputDoc.addPage([baseViewport.width, baseViewport.height]);
      outPage.drawImage(embeddedJpg, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      });
      page.cleanup();
    }

    options?.onProgress?.(0.92);
    await yieldToMain();

    let finalBytes: Uint8Array;
    if (options?.encryptPassword !== undefined) {
      finalBytes = await savePdfWithOptionalEncryption(outputDoc, {
        encryptPassword: options.encryptPassword,
      });
    } else {
      finalBytes = await outputDoc.save({ useObjectStreams: true });
    }
    options?.onProgress?.(1);

    let usedOriginalFallback = false;
    if (
      finalBytes.byteLength >= originalSize &&
      !settings.convertToGrayscale &&
      Boolean(options?.password) === Boolean(options?.encryptPassword !== undefined)
    ) {
      finalBytes = new Uint8Array(sourceBytes);
      usedOriginalFallback = true;
    }

    const compressedSize = finalBytes.byteLength;
    const savedBytes = Math.max(0, originalSize - compressedSize);
    const savedPercent = originalSize > 0 ? Math.max(0, ((originalSize - compressedSize) / originalSize) * 100) : 0;

    return {
      bytes: finalBytes,
      stats: {
        originalSize,
        compressedSize,
        savedBytes,
        savedPercent,
        pageCount: numPages,
        imagesInspectCount: numPages,
        imagesRecompressedCount: usedOriginalFallback ? 0 : numPages,
        imagesDownsampledCount: usedOriginalFallback ? 0 : numPages,
        duplicatesMergedCount: 0,
        streamsCompressedCount: 0,
        orphansRemovedCount: 0,
        usedOriginalFallback,
      },
    };
  } finally {
    try {
      await pdfjsDoc.destroy();
    } catch {
      // ignore destroy error
    }
  }
}

export async function compressPdfBytes(
  sourceBytes: Uint8Array,
  settings: CompressionSettings,
  options?: {
    isEncrypted?: boolean;
    password?: string;
    encryptPassword?: string;
    onProgress?: (progressRatio: number) => void;
  },
): Promise<CompressionResult> {
  const originalSize = sourceBytes.byteLength;

  // Encrypted PDFs or explicit full-page rasterization mode use PDF.js rasterization pipeline
  if (settings.rasterizePages || options?.isEncrypted) {
    return compressViaRasterization(sourceBytes, settings, {
      password: options?.password,
      encryptPassword: options?.encryptPassword,
      onProgress: options?.onProgress,
    });
  }

  options?.onProgress?.(0.06);
  await yieldToMain();

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(new Uint8Array(sourceBytes), {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch {
    // Fallback to rasterization if pdf-lib cannot parse the structure directly
    return compressViaRasterization(sourceBytes, settings, {
      password: options?.password,
      encryptPassword: options?.encryptPassword,
      onProgress: options?.onProgress,
    });
  }

  const pageCount = pdfDoc.getPageCount();
  let imagesInspectCount = 0;
  let imagesRecompressedCount = 0;
  let imagesDownsampledCount = 0;
  let duplicatesMergedCount = 0;
  let streamsCompressedCount = 0;
  let orphansRemovedCount = 0;

  options?.onProgress?.(0.18);
  await yieldToMain();

  if (settings.recompressImages || settings.convertToGrayscale) {
    const imgResult = await recompressImageXObjects(pdfDoc, settings, async (ratio) => {
      options?.onProgress?.(0.18 + ratio * 0.52);
      await yieldToMain();
    });
    imagesInspectCount = imgResult.inspected;
    imagesRecompressedCount = imgResult.recompressed;
    imagesDownsampledCount = imgResult.downsampled;
  }

  options?.onProgress?.(0.74);
  await yieldToMain();

  if (settings.deduplicateResources) {
    const dedupResult = deduplicateStreamsAndCompressUnfiltered(pdfDoc);
    duplicatesMergedCount = dedupResult.duplicatesMerged;
    streamsCompressedCount = dedupResult.streamsCompressed;
  }

  options?.onProgress?.(0.84);
  await yieldToMain();

  if (settings.cleanMetadata) {
    cleanDocumentStructureAndMetadata(pdfDoc);
  }

  if (settings.cleanMetadata || settings.deduplicateResources || imagesRecompressedCount > 0) {
    orphansRemovedCount = removeOrphanObjects(pdfDoc);
  }

  options?.onProgress?.(0.92);
  await yieldToMain();

  let finalBytes: Uint8Array;
  if (options?.encryptPassword !== undefined) {
    finalBytes = await savePdfWithOptionalEncryption(pdfDoc, {
      encryptPassword: options.encryptPassword,
    });
  } else {
    finalBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
  }

  options?.onProgress?.(1);

  // Monotonic guarantee: never return a larger file unless grayscale was explicitly applied
  let usedOriginalFallback = false;
  if (finalBytes.byteLength >= originalSize && !settings.convertToGrayscale && options?.encryptPassword === undefined) {
    finalBytes = new Uint8Array(sourceBytes);
    usedOriginalFallback = true;
  }

  const compressedSize = finalBytes.byteLength;
  const savedBytes = Math.max(0, originalSize - compressedSize);
  const savedPercent = originalSize > 0 ? Math.max(0, ((originalSize - compressedSize) / originalSize) * 100) : 0;

  return {
    bytes: finalBytes,
    stats: {
      originalSize,
      compressedSize,
      savedBytes,
      savedPercent,
      pageCount,
      imagesInspectCount,
      imagesRecompressedCount: usedOriginalFallback ? 0 : imagesRecompressedCount,
      imagesDownsampledCount: usedOriginalFallback ? 0 : imagesDownsampledCount,
      duplicatesMergedCount: usedOriginalFallback ? 0 : duplicatesMergedCount,
      streamsCompressedCount: usedOriginalFallback ? 0 : streamsCompressedCount,
      orphansRemovedCount: usedOriginalFallback ? 0 : orphansRemovedCount,
      usedOriginalFallback,
    },
  };
}
