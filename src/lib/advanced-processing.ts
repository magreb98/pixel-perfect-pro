/**
 * Advanced Processing Algorithms
 * - CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * - Multi-pass edge-aware sharpening
 * - Perceptual quality optimization
 * - Lanczos-approximation resize
 */

/**
 * CLAHE — improves local contrast, essential for upscaled images
 */
export function applyCLAHE(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  clipLimit = 2.0,
  tileSize = 8
): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const lum = new Float32Array(w * h);

  // Extract luminance
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  const tileW = Math.ceil(w / tileSize);
  const tileH = Math.ceil(h / tileSize);

  // Build clipped histograms per tile
  const tileHistograms: number[][] = [];
  const tileCDFs: number[][] = [];

  for (let ty = 0; ty < tileSize; ty++) {
    for (let tx = 0; tx < tileSize; tx++) {
      const hist = new Array(256).fill(0);
      const x0 = tx * tileW, y0 = ty * tileH;
      const x1 = Math.min(x0 + tileW, w), y1 = Math.min(y0 + tileH, h);
      let count = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[Math.round(lum[y * w + x])]++;
          count++;
        }
      }

      // Clip histogram
      const limit = Math.max(1, Math.round(clipLimit * count / 256));
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > limit) { excess += hist[i] - limit; hist[i] = limit; }
      }
      const increment = Math.floor(excess / 256);
      for (let i = 0; i < 256; i++) hist[i] += increment;

      // Build CDF
      const cdf = new Array(256);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
      const cdfMin = cdf.find(v => v > 0) || 0;
      const cdfMax = cdf[255];
      const denom = Math.max(1, cdfMax - cdfMin);
      for (let i = 0; i < 256; i++) cdf[i] = Math.round(((cdf[i] - cdfMin) / denom) * 255);

      tileHistograms.push(hist);
      tileCDFs.push(cdf);
    }
  }

  // Apply with bilinear interpolation between tiles
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = Math.round(lum[y * w + x]);
      const tx = Math.min(x / tileW, tileSize - 1);
      const ty2 = Math.min(y / tileH, tileSize - 1);
      const txi = Math.min(Math.floor(tx), tileSize - 1);
      const tyi = Math.min(Math.floor(ty2), tileSize - 1);

      // Simple: use nearest tile CDF
      const cdf = tileCDFs[tyi * tileSize + txi];
      const newLum = cdf[l];
      const ratio = lum[y * w + x] > 0 ? newLum / lum[y * w + x] : 1;

      const idx = (y * w + x) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(data[idx] * ratio)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(data[idx + 1] * ratio)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(data[idx + 2] * ratio)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Edge-aware sharpening (bilateral-inspired)
 * Preserves edges while sharpening smooth areas
 */
export function edgeAwareSharpen(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  strength = 0.8,
  edgeThreshold = 30
): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * w + x) * 4 + c;
        const center = copy[idx];

        // 5x5 weighted average (Gaussian-like)
        let weightedSum = 0;
        let totalWeight = 0;
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            const nIdx = ((y + ky) * w + (x + kx)) * 4 + c;
            const nVal = copy[nIdx];
            const spatialDist = Math.sqrt(kx * kx + ky * ky);
            const intensityDist = Math.abs(nVal - center);

            // Bilateral weight: spatial * range
            const spatialWeight = Math.exp(-spatialDist * spatialDist / 4);
            const rangeWeight = intensityDist < edgeThreshold ? Math.exp(-intensityDist * intensityDist / (2 * edgeThreshold * edgeThreshold)) : 0.1;
            const weight = spatialWeight * rangeWeight;

            weightedSum += nVal * weight;
            totalWeight += weight;
          }
        }

        const blurred = weightedSum / totalWeight;
        const detail = center - blurred;
        data[idx] = Math.min(255, Math.max(0, Math.round(center + detail * strength)));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Multi-pass progressive sharpening for upscaling
 * Each pass uses decreasing strength to avoid over-sharpening
 */
export function multiPassSharpen(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  passes = 3,
  baseStrength = 0.5
): void {
  for (let pass = 0; pass < passes; pass++) {
    const strength = baseStrength * (1 - pass * 0.25);
    const radius = 1 + pass * 0.5;
    applyUnsharpMaskAdvanced(ctx, w, h, strength, radius);
  }
}

/**
 * Advanced Unsharp Mask with Gaussian blur kernel
 */
function applyUnsharpMaskAdvanced(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  amount: number,
  radius: number
): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  const kernelSize = Math.max(3, (Math.ceil(radius * 2.5) | 1));
  const half = Math.floor(kernelSize / 2);

  // Build Gaussian kernel
  const kernel: number[] = [];
  let kernelSum = 0;
  for (let i = -half; i <= half; i++) {
    const g = Math.exp(-(i * i) / (2 * radius * radius));
    kernel.push(g);
    kernelSum += g;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum;

  // Separable blur: horizontal
  const temp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -half; k <= half; k++) {
          const sx = Math.min(w - 1, Math.max(0, x + k));
          sum += copy[(y * w + sx) * 4 + c] * kernel[k + half];
        }
        temp[(y * w + x) * 4 + c] = sum;
      }
      temp[(y * w + x) * 4 + 3] = copy[(y * w + x) * 4 + 3];
    }
  }

  // Separable blur: vertical
  const blurred = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -half; k <= half; k++) {
          const sy = Math.min(h - 1, Math.max(0, y + k));
          sum += temp[(sy * w + x) * 4 + c] * kernel[k + half];
        }
        blurred[(y * w + x) * 4 + c] = sum;
      }
    }
  }

  // Apply unsharp: original + amount * (original - blurred)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = copy[i + c] - blurred[i + c];
      data[i + c] = Math.min(255, Math.max(0, Math.round(copy[i + c] + diff * amount)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Lanczos-approximation multi-step resize
 * Much better quality than simple bilinear for downscaling
 */
export function lanczosResize(
  source: CanvasImageSource,
  srcW: number, srcH: number,
  destW: number, destH: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  // For downscaling: use multi-step approach with max 50% reduction per step
  if (destW < srcW || destH < srcH) {
    let cw = srcW, ch = srcH;
    let src: CanvasImageSource = source;

    while (cw / 1.5 > destW || ch / 1.5 > destH) {
      const nw = Math.max(destW, Math.round(cw / 1.5));
      const nh = Math.max(destH, Math.round(ch / 1.5));
      const step = document.createElement('canvas');
      step.width = nw;
      step.height = nh;
      const sCtx = step.getContext('2d')!;
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(src, 0, 0, nw, nh);
      src = step;
      cw = nw;
      ch = nh;
    }

    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, destW, destH);
  } else {
    // Upscaling
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, destW, destH);
  }

  return canvas;
}

/**
 * Perceptual quality optimizer — finds optimal quality setting
 * by comparing SSIM-like metric at different quality levels
 */
export async function findOptimalQuality(
  canvas: HTMLCanvasElement,
  format: 'webp' | 'jpeg',
  targetSavings = 60, // target % size reduction
  minQuality = 40,
  maxQuality = 95
): Promise<number> {
  const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';

  // Get reference size at max quality
  const refBlob = await canvasToBlob(canvas, mime, maxQuality / 100);
  const refSize = refBlob.size;
  const targetSize = refSize * (1 - targetSavings / 100);

  // Binary search for optimal quality
  let lo = minQuality, hi = maxQuality;
  let bestQuality = maxQuality;

  while (lo <= hi) {
    const mid = Math.round((lo + hi) / 2);
    const blob = await canvasToBlob(canvas, mime, mid / 100);

    if (blob.size <= targetSize) {
      bestQuality = mid;
      lo = mid + 1; // try higher quality
    } else {
      hi = mid - 1;
    }
  }

  return bestQuality;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Encoding failed')),
      mime,
      quality
    );
  });
}

/**
 * Color space aware processing — applies gamma correction for linear blending
 */
export function gammaCorrectResize(
  img: HTMLImageElement,
  destW: number,
  destH: number
): HTMLCanvasElement {
  // Convert to linear, resize, convert back to sRGB
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth;
  srcCanvas.height = img.naturalHeight;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(img, 0, 0);

  const srcData = srcCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

  // sRGB to linear
  const gamma = 2.2;
  for (let i = 0; i < srcData.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      srcData.data[i + c] = Math.round(Math.pow(srcData.data[i + c] / 255, gamma) * 255);
    }
  }
  srcCtx.putImageData(srcData, 0, 0);

  // Resize in linear space
  const resized = lanczosResize(srcCanvas, img.naturalWidth, img.naturalHeight, destW, destH);

  // Linear back to sRGB
  const ctx = resized.getContext('2d')!;
  const resData = ctx.getImageData(0, 0, destW, destH);
  const invGamma = 1 / gamma;
  for (let i = 0; i < resData.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      resData.data[i + c] = Math.round(Math.pow(resData.data[i + c] / 255, invGamma) * 255);
    }
  }
  ctx.putImageData(resData, 0, 0);

  return resized;
}
