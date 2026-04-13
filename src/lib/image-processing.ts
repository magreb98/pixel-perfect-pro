import { removeBackground } from '@imgly/background-removal';

export interface ProcessingOptions {
  mode: 'compress' | 'resize' | 'upscale' | 'remove-bg';
  quality: number;
  format: 'webp' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  maintainAspect: boolean;
  scale?: number;
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

  onProgress?.(10);
  const img = await loadImage(file);
  onProgress?.(30);

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

  onProgress?.(50);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (options.mode === 'upscale') {
    ctx.drawImage(img, 0, 0, targetW, targetH);
    applyUnsharpMask(ctx, targetW, targetH, 0.6, 1.2);
  } else {
    if (targetW < img.naturalWidth / 2) {
      stepDownResize(img, canvas, ctx, targetW, targetH);
    } else {
      ctx.drawImage(img, 0, 0, targetW, targetH);
    }
  }

  onProgress?.(75);

  const mimeMap = { webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' };
  const mime = mimeMap[options.format];
  const quality = options.format === 'png' ? undefined : options.quality / 100;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Échec de l\'encodage'))),
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

  // Re-encode to desired format
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
      (b) => (b ? resolve(b) : reject(new Error('Échec de l\'encodage'))),
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

function stepDownResize(
  img: HTMLImageElement,
  _target: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  tw: number,
  th: number
) {
  let cw = img.naturalWidth;
  let ch = img.naturalHeight;
  let src: CanvasImageSource = img;

  while (cw / 2 > tw) {
    cw = Math.round(cw / 2);
    ch = Math.round(ch / 2);
    const step = document.createElement('canvas');
    step.width = cw;
    step.height = ch;
    const sCtx = step.getContext('2d')!;
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.drawImage(src, 0, 0, cw, ch);
    src = step;
  }

  ctx.drawImage(src, 0, 0, tw, th);
}

function applyUnsharpMask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
  radius: number
) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  const kernelSize = Math.ceil(radius * 3) | 1;
  const half = Math.floor(kernelSize / 2);

  for (let y = half; y < h - half; y++) {
    for (let x = half; x < w - half; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0, count = 0;
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            sum += copy[((y + ky) * w + (x + kx)) * 4 + c];
            count++;
          }
        }
        const blurred = sum / count;
        const idx = (y * w + x) * 4 + c;
        data[idx] = Math.min(255, Math.max(0, Math.round(data[idx] + (data[idx] - blurred) * amount)));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
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
  thumbnail: string; // base64 data url
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
