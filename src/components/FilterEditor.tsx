import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Download, Sun, Contrast, Droplets, Palette, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export interface FilterValues {
  brightness: number;   // -100 to 100, default 0
  contrast: number;     // -100 to 100, default 0
  saturation: number;   // -100 to 100, default 0
  vibrance: number;     // -100 to 100, default 0
  sepia: number;        // 0 to 100, default 0
  grayscale: number;    // 0 to 100, default 0
  hueRotate: number;    // 0 to 360, default 0
  warmth: number;       // -100 to 100, default 0
}

const DEFAULT_FILTERS: FilterValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
  warmth: 0,
};

interface FilterSliderDef {
  key: keyof FilterValues;
  label: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  unit?: string;
}

const FILTER_SLIDERS: FilterSliderDef[] = [
  { key: 'brightness', label: 'Luminosité', icon: <Sun className="w-3.5 h-3.5" />, min: -100, max: 100 },
  { key: 'contrast', label: 'Contraste', icon: <Contrast className="w-3.5 h-3.5" />, min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', icon: <Droplets className="w-3.5 h-3.5" />, min: -100, max: 100 },
  { key: 'vibrance', label: 'Vibrance', icon: <Eye className="w-3.5 h-3.5" />, min: -100, max: 100 },
  { key: 'warmth', label: 'Chaleur', icon: <Sun className="w-3.5 h-3.5" />, min: -100, max: 100 },
  { key: 'sepia', label: 'Sépia', icon: <Palette className="w-3.5 h-3.5" />, min: 0, max: 100, unit: '%' },
  { key: 'grayscale', label: 'Noir & Blanc', icon: <Contrast className="w-3.5 h-3.5" />, min: 0, max: 100, unit: '%' },
  { key: 'hueRotate', label: 'Teinte', icon: <Palette className="w-3.5 h-3.5" />, min: 0, max: 360, unit: '°' },
];

const PRESETS: { label: string; values: Partial<FilterValues> }[] = [
  { label: 'Original', values: {} },
  { label: 'N&B', values: { grayscale: 100, contrast: 10 } },
  { label: 'Sépia', values: { sepia: 80, warmth: 20 } },
  { label: 'Vibrant', values: { vibrance: 60, saturation: 30, contrast: 15 } },
  { label: 'Cinéma', values: { contrast: 25, saturation: -20, warmth: 15, brightness: -10 } },
  { label: 'Froid', values: { warmth: -50, saturation: -15, contrast: 10 } },
  { label: 'Rétro', values: { sepia: 40, contrast: 20, brightness: 10, saturation: -30 } },
];

interface FilterEditorProps {
  file: File;
  onApply?: (blob: Blob) => void;
}

/**
 * Build a CSS filter string from FilterValues (used for real-time preview).
 */
export function buildCSSFilter(f: FilterValues): string {
  const parts: string[] = [];
  if (f.brightness !== 0) parts.push(`brightness(${1 + f.brightness / 100})`);
  if (f.contrast !== 0) parts.push(`contrast(${1 + f.contrast / 100})`);
  if (f.saturation !== 0) parts.push(`saturate(${1 + f.saturation / 100})`);
  if (f.sepia > 0) parts.push(`sepia(${f.sepia / 100})`);
  if (f.grayscale > 0) parts.push(`grayscale(${f.grayscale / 100})`);
  if (f.hueRotate > 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * Apply filters to a canvas using pixel manipulation for vibrance/warmth,
 * and CSS-compatible filters for the rest.
 */
export async function applyFiltersToBlob(blob: Blob, filters: FilterValues): Promise<Blob> {
  const img = await loadImg(blob);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Apply CSS-compatible filters
  ctx.filter = buildCSSFilter(filters);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = 'none';

  // Pixel-level: vibrance + warmth
  if (filters.vibrance !== 0 || filters.warmth !== 0) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    const vib = filters.vibrance / 100;
    const warm = filters.warmth / 100;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];

      // Vibrance: boost less-saturated colors more
      if (vib !== 0) {
        const max = Math.max(r, g, b);
        const avg = (r + g + b) / 3;
        const amt = ((max - avg) / 255) * (-vib * 3);
        r += (max - r) * amt;
        g += (max - g) * amt;
        b += (max - b) * amt;
      }

      // Warmth: shift R/B channels
      if (warm !== 0) {
        r = Math.min(255, Math.max(0, r + warm * 30));
        b = Math.min(255, Math.max(0, b - warm * 30));
      }

      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Filter export failed')), 'image/png');
  });
}

function loadImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export default function FilterEditor({ file, onApply }: FilterEditorProps) {
  const [filters, setFilters] = useState<FilterValues>({ ...DEFAULT_FILTERS });
  const [imgUrl, setImgUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const updateFilter = (key: keyof FilterValues, value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: Partial<FilterValues>) => {
    setFilters({ ...DEFAULT_FILTERS, ...preset });
  };

  const reset = () => setFilters({ ...DEFAULT_FILTERS });

  const handleApply = useCallback(async () => {
    const blob = await applyFiltersToBlob(file, filters);
    onApply?.(blob);
  }, [file, filters, onApply]);

  const handleDownload = useCallback(async () => {
    const blob = await applyFiltersToBlob(file, filters);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixelforge-filtered.png`;
    a.click();
  }, [file, filters]);

  const cssFilter = buildCSSFilter(filters);
  const hasChanges = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="space-y-5">
      {/* Live preview */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="aspect-video flex items-center justify-center bg-secondary/20 overflow-hidden">
          {imgUrl && (
            <img
              src={imgUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain transition-all duration-150"
              style={{ filter: cssFilter }}
            />
          )}
        </div>
      </div>

      {/* Presets */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.values)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-secondary/50 border border-transparent hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filter sliders */}
      <div className="space-y-3">
        {FILTER_SLIDERS.map((s) => (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {s.icon}
                <span>{s.label}</span>
              </div>
              <span className="text-primary font-semibold tabular-nums">
                {filters[s.key]}{s.unit || ''}
              </span>
            </div>
            <Slider
              value={[filters[s.key]]}
              onValueChange={([v]) => updateFilter(s.key, v)}
              min={s.min}
              max={s.max}
              step={1}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button size="sm" variant="outline" onClick={reset} disabled={!hasChanges} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
        </Button>
        <Button size="sm" onClick={handleApply} disabled={!hasChanges} className="flex-1 gap-1.5">
          Appliquer les filtres
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={!hasChanges} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Télécharger
        </Button>
      </div>
    </div>
  );
}
