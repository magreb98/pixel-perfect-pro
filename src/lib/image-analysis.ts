/**
 * Advanced Image Analysis Engine
 * Provides histogram, dominant colors, noise estimation, sharpness detection, and quality scoring.
 */

export interface ImageAnalysis {
  histogram: {
    r: number[];
    g: number[];
    b: number[];
    luminance: number[];
  };
  dominantColors: { color: string; percentage: number }[];
  sharpness: number; // 0-100
  noise: number; // 0-100
  brightness: number; // 0-255 avg
  contrast: number; // 0-100
  saturation: number; // 0-100
  dynamicRange: number; // 0-100
  qualityScore: number; // 0-100
  recommendations: string[];
  dimensions: { width: number; height: number };
  megapixels: number;
  aspectRatio: string;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Cannot load image'));
    img.src = url;
  });
}

function getImageData(img: HTMLImageElement, maxDim = 1024): { data: Uint8ClampedArray; w: number; h: number } {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

function computeHistogram(data: Uint8ClampedArray) {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  const luminance = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    luminance[lum]++;
  }
  return { r, g, b, luminance };
}

function computeDominantColors(data: Uint8ClampedArray, count = 5): { color: string; percentage: number }[] {
  // K-means simplified via color quantization (4-bit per channel)
  const buckets = new Map<string, number>();
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const rq = (data[i] >> 4) << 4;
    const gq = (data[i + 1] >> 4) << 4;
    const bq = (data[i + 2] >> 4) << 4;
    const key = `${rq},${gq},${bq}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key, cnt]) => {
      const [r, g, b] = key.split(',').map(Number);
      return {
        color: `rgb(${r}, ${g}, ${b})`,
        percentage: Math.round((cnt / totalPixels) * 100),
      };
    });
}

function computeSharpness(data: Uint8ClampedArray, w: number, h: number): number {
  // Laplacian variance — higher = sharper
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      const top = (y - 1) * w + x;
      const bot = (y + 1) * w + x;
      const left = y * w + (x - 1);
      const right = y * w + (x + 1);

      const lumTop = 0.299 * data[top * 4] + 0.587 * data[top * 4 + 1] + 0.114 * data[top * 4 + 2];
      const lumBot = 0.299 * data[bot * 4] + 0.587 * data[bot * 4 + 1] + 0.114 * data[bot * 4 + 2];
      const lumLeft = 0.299 * data[left * 4] + 0.587 * data[left * 4 + 1] + 0.114 * data[left * 4 + 2];
      const lumRight = 0.299 * data[right * 4] + 0.587 * data[right * 4 + 1] + 0.114 * data[right * 4 + 2];

      const laplacian = -4 * lum + lumTop + lumBot + lumLeft + lumRight;
      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // Normalize: typical sharp images have variance 200-2000+
  return Math.min(100, Math.round(Math.sqrt(variance) * 2));
}

function computeNoise(data: Uint8ClampedArray, w: number, h: number): number {
  // Median Absolute Deviation of Laplacian (robust noise estimator)
  const laplacians: number[] = [];

  const step = Math.max(1, Math.floor(w * h / 10000)); // sample for performance
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x += step) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      const neighbors = [
        (y - 1) * w + x, (y + 1) * w + x,
        y * w + (x - 1), y * w + (x + 1),
      ];
      let neighborSum = 0;
      for (const n of neighbors) {
        neighborSum += 0.299 * data[n * 4] + 0.587 * data[n * 4 + 1] + 0.114 * data[n * 4 + 2];
      }
      laplacians.push(Math.abs(-4 * lum + neighborSum));
    }
  }

  laplacians.sort((a, b) => a - b);
  const median = laplacians[Math.floor(laplacians.length / 2)];
  // Sigma estimate: MAD * 1.4826
  const sigma = median * 1.4826;
  // Normalize: 0-20 sigma range maps to 0-100
  return Math.min(100, Math.round(sigma * 5));
}

function computeBrightness(data: Uint8ClampedArray): number {
  let sum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return Math.round(sum / pixels);
}

function computeContrast(histogram: number[]): number {
  const total = histogram.reduce((s, v) => s + v, 0);
  let mean = 0;
  for (let i = 0; i < 256; i++) mean += i * histogram[i];
  mean /= total;

  let variance = 0;
  for (let i = 0; i < 256; i++) variance += histogram[i] * (i - mean) ** 2;
  variance /= total;

  // Normalize: stddev of 80 = perfect contrast
  return Math.min(100, Math.round(Math.sqrt(variance) * 1.25));
}

function computeSaturation(data: Uint8ClampedArray): number {
  let satSum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (max > 0) satSum += (max - min) / max;
  }
  return Math.round((satSum / pixels) * 100);
}

function computeDynamicRange(histogram: number[]): number {
  let lo = 0, hi = 255;
  const total = histogram.reduce((s, v) => s + v, 0);
  const threshold = total * 0.001;
  let acc = 0;
  for (let i = 0; i < 256; i++) { acc += histogram[i]; if (acc > threshold) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += histogram[i]; if (acc > threshold) { hi = i; break; } }
  return Math.round(((hi - lo) / 255) * 100);
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function getAspectRatio(w: number, h: number): string {
  const d = gcd(w, h);
  const rw = w / d, rh = h / d;
  if (rw > 50 || rh > 50) {
    const ratio = w / h;
    if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
    if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
    if (Math.abs(ratio - 3 / 2) < 0.05) return '3:2';
    if (Math.abs(ratio - 1) < 0.05) return '1:1';
    return `${ratio.toFixed(2)}:1`;
  }
  return `${rw}:${rh}`;
}

function generateRecommendations(analysis: Omit<ImageAnalysis, 'recommendations'>): string[] {
  const recs: string[] = [];

  if (analysis.sharpness < 30) recs.push('Image floue — essayez l\'upscaling avec renforcement des contours');
  if (analysis.noise > 50) recs.push('Bruit élevé détecté — la compression pourrait amplifier les artefacts');
  if (analysis.brightness < 60) recs.push('Image sous-exposée — envisagez un ajustement de luminosité');
  if (analysis.brightness > 200) recs.push('Image surexposée — détails potentiellement perdus dans les hautes lumières');
  if (analysis.contrast < 25) recs.push('Faible contraste — l\'image manque de profondeur tonale');
  if (analysis.dynamicRange < 30) recs.push('Plage dynamique limitée — l\'histogramme est concentré');
  if (analysis.saturation < 10) recs.push('Image quasi monochrome — le format PNG préservera mieux les nuances');
  if (analysis.megapixels > 20) recs.push('Résolution très élevée — un redimensionnement réduira significativement la taille');
  if (analysis.qualityScore > 80) recs.push('Excellente qualité source — une compression WebP à 85% est recommandée');
  if (analysis.qualityScore < 40) recs.push('Qualité source faible — évitez de re-compresser en lossy');

  return recs.length > 0 ? recs : ['Image de bonne qualité — aucune recommandation particulière'];
}

export async function analyzeImage(fileOrUrl: File | string): Promise<ImageAnalysis> {
  const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  const img = await loadImageFromUrl(url);
  const { data, w, h } = getImageData(img);

  const histogram = computeHistogram(data);
  const dominantColors = computeDominantColors(data);
  const sharpness = computeSharpness(data, w, h);
  const noise = computeNoise(data, w, h);
  const brightness = computeBrightness(data);
  const contrast = computeContrast(histogram.luminance);
  const saturation = computeSaturation(data);
  const dynamicRange = computeDynamicRange(histogram.luminance);

  const qualityScore = Math.round(
    sharpness * 0.35 +
    (100 - noise) * 0.25 +
    contrast * 0.15 +
    dynamicRange * 0.15 +
    Math.min(100, saturation * 2) * 0.10
  );

  const megapixels = Math.round((img.naturalWidth * img.naturalHeight) / 1_000_000 * 10) / 10;
  const aspectRatio = getAspectRatio(img.naturalWidth, img.naturalHeight);

  const partial = {
    histogram, dominantColors, sharpness, noise, brightness, contrast,
    saturation, dynamicRange, qualityScore,
    dimensions: { width: img.naturalWidth, height: img.naturalHeight },
    megapixels, aspectRatio,
  };

  return { ...partial, recommendations: generateRecommendations(partial) };
}
