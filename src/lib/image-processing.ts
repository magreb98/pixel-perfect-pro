import { removeBackground } from '@imgly/background-removal';
import {
  applyCLAHE,
  edgeAwareSharpen,
  multiPassSharpen,
  lanczosResize,
  findOptimalQuality,
  gammaCorrectResize,
} from './advanced-processing';

export interface ProcessingOptions {
  mode: 'compress' | 'resize' | 'upscale' | 'remove-bg';
  quality: number;
  format: 'webp' | 'jpeg' | 'png' | 'avif';
  width?: number;
  height?: number;
  maintainAspect: boolean;
  scale?: number;
  autoOptimize?: boolean; // perceptual quality optimization
}

export interface ProcessingResult {
  blob: Blob;
  url: string;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
  format: string;
  savings: number;
  mode: ProcessingOptions['mode'];
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Format non supporté ou fichier corrompu'));
    img.src = URL.createObjectURL(file);
  });
}

export async function processImage(
  file: File,
  options: ProcessingOptions,
  onProgress?: (p: number) => void
): Promise<ProcessingResult> {
  if (options.mode === 'remove-bg') {
    return removeBackgroundProcess(file, options, onProgress);
  }

  onProgress?.(5);
  const img = await loadImage(file);
  onProgress?.(15);

  let targetW = img.naturalWidth;
  let targetH = img.naturalHeight;

  if (options.mode === 'resize' && options.width) {
    targetW = options.width;
    targetH = options.maintainAspect
      ? Math.round((options.width / img.naturalWidth) * img.naturalHeight)
      : (options.height || targetH);
  }

  if (options.mode === 'upscale' && options.scale) {
    targetW = Math.round(img.naturalWidth * options.scale);
    targetH = Math.round(img.naturalHeight * options.scale);
  }

  onProgress?.(25);

  let canvas: HTMLCanvasElement;

  if (options.mode === 'resize') {
    // Gamma-correct resize for superior color accuracy
    canvas = gammaCorrectResize(img, targetW, targetH);
    onProgress?.(60);

    // Light sharpening after downscale to restore detail
    if (targetW < img.naturalWidth) {
      const ctx = canvas.getContext('2d')!;
      edgeAwareSharpen(ctx, targetW, targetH, 0.3, 25);
    }
  } else if (options.mode === 'upscale') {
    // Lanczos-approximation upscale
    canvas = lanczosResize(img, img.naturalWidth, img.naturalHeight, targetW, targetH);
    onProgress?.(40);

    const ctx = canvas.getContext('2d')!;

    // CLAHE for enhanced local contrast
    applyCLAHE(ctx, targetW, targetH, 1.5, 8);
    onProgress?.(55);

    // Multi-pass progressive sharpening (edge-aware)
    multiPassSharpen(ctx, targetW, targetH, 3, 0.5);
    onProgress?.(70);

    // Final edge-aware refinement
    edgeAwareSharpen(ctx, targetW, targetH, 0.4, 20);
    onProgress?.(80);
  } else {
    // Compress mode: just draw
    canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);
  }

  onProgress?.(85);

  // Encoding
  const mimeMap: Record<string, string> = {
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    png: 'image/png',
    avif: 'image/avif',
  };
  const mime = mimeMap[options.format] || 'image/webp';

  let quality: number | undefined;
  if (options.format !== 'png') {
    if (options.autoOptimize && (options.format === 'webp' || options.format === 'jpeg')) {
      // Perceptual quality optimization
      quality = (await findOptimalQuality(canvas, options.format, 100 - options.quality)) / 100;
    } else {
      quality = options.quality / 100;
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec de l'encodage — le format n'est peut-être pas supporté par ce navigateur"))),
      mime,
      quality
    );
  });

  onProgress?.(100);

  const url = URL.createObjectURL(blob);
  const savings = Math.round((1 - blob.size / file.size) * 100);

  return {
    blob, url,
    originalSize: file.size,
    processedSize: blob.size,
    width: targetW,
    height: targetH,
    format: options.format,
    savings: Math.max(0, savings),
    mode: options.mode,
  };
}

async function removeBackgroundProcess(
  file: File,
  options: ProcessingOptions,
  onProgress?: (p: number) => void
): Promise<ProcessingResult> {
  onProgress?.(5);

  const resultBlob = await removeBackground(file, {
    progress: (key, current, total) => {
      if (total > 0) {
        const pct = Math.round((current / total) * 80) + 10;
        onProgress?.(Math.min(90, pct));
      }
    },
  });

  onProgress?.(90);

  const img = await loadImage(resultBlob);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const mime = options.format === 'png' ? 'image/png' : `image/${options.format}`;
  const quality = options.format === 'png' ? undefined : options.quality / 100;

  const finalBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec de l'encodage"))),
      mime,
      quality
    );
  });

  onProgress?.(100);

  return {
    blob: finalBlob,
    url: URL.createObjectURL(finalBlob),
    originalSize: file.size,
    processedSize: finalBlob.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
    format: options.format,
    savings: Math.max(0, Math.round((1 - finalBlob.size / file.size) * 100)),
    mode: 'remove-bg',
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// History management
export interface HistoryEntry {
  id: string;
  filename: string;
  mode: ProcessingOptions['mode'];
  originalSize: number;
  processedSize: number;
  savings: number;
  width: number;
  height: number;
  format: string;
  timestamp: number;
  thumbnail: string;
}

const HISTORY_KEY = 'pixelforge-history';
const MAX_HISTORY = 20;

export function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

export function addToHistory(entry: HistoryEntry) {
  const history = getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export async function createThumbnail(blob: Blob, maxSize = 80): Promise<string> {
  const img = await loadImage(blob);
  const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.5);
}
