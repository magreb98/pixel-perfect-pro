import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Maximize, Sparkles, Scissors, Plus, Trash2, Play,
  GripVertical, ChevronDown, ChevronUp, Loader2, Download, CheckCircle, ArrowRight, Palette,
} from 'lucide-react';
import { applyFiltersToBlob, type FilterValues } from '@/components/FilterEditor';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { processImage, formatBytes, type ProcessingOptions, type ProcessingResult } from '@/lib/image-processing';

type StepType = 'crop' | 'compress' | 'resize' | 'upscale' | 'remove-bg' | 'filter';

interface PipelineStep {
  id: string;
  type: StepType;
  config: StepConfig;
  collapsed: boolean;
}

interface StepConfig {
  // Crop
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  // Compress
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  autoOptimize?: boolean;
  // Resize
  width?: number;
  maintainAspect?: boolean;
  // Upscale
  scale?: number;
  // Filters
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturation?: number;
  filterVibrance?: number;
  filterSepia?: number;
  filterGrayscale?: number;
  filterHueRotate?: number;
  filterWarmth?: number;
}

interface StepResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
}

const STEP_META: Record<StepType, { label: string; icon: React.ReactNode; color: string }> = {
  crop: { label: 'Recadrage', icon: <Scissors className="w-4 h-4" />, color: 'text-amber-400' },
  compress: { label: 'Compression', icon: <Zap className="w-4 h-4" />, color: 'text-emerald-400' },
  resize: { label: 'Redimensionner', icon: <Maximize className="w-4 h-4" />, color: 'text-sky-400' },
  upscale: { label: 'Upscale', icon: <Sparkles className="w-4 h-4" />, color: 'text-violet-400' },
  'remove-bg': { label: 'Supprimer fond', icon: <Scissors className="w-4 h-4" />, color: 'text-rose-400' },
  filter: { label: 'Filtres', icon: <Palette className="w-4 h-4" />, color: 'text-orange-400' },
};

function defaultConfig(type: StepType): StepConfig {
  switch (type) {
    case 'crop': return { cropX: 0, cropY: 0, cropW: 100, cropH: 100 };
    case 'compress': return { quality: 80, format: 'webp', autoOptimize: false };
    case 'resize': return { width: 1920, maintainAspect: true };
    case 'upscale': return { scale: 2 };
    case 'remove-bg': return {};
    case 'filter': return {
      filterBrightness: 0, filterContrast: 0, filterSaturation: 0,
      filterVibrance: 0, filterSepia: 0, filterGrayscale: 0,
      filterHueRotate: 0, filterWarmth: 0,
    };
  }
}

interface PipelineEditorProps {
  file: File;
  onPipelineComplete?: (blob: Blob, result: ProcessingResult) => void;
}

export default function PipelineEditor({ file, onPipelineComplete }: PipelineEditorProps) {
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: crypto.randomUUID(), type: 'crop', config: defaultConfig('crop'), collapsed: false },
    { id: crypto.randomUUID(), type: 'compress', config: defaultConfig('compress'), collapsed: false },
  ]);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepResults, setStepResults] = useState<Map<string, StepResult>>(new Map());
  const [finalResult, setFinalResult] = useState<{ blob: Blob; url: string } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const addStep = (type: StepType) => {
    setSteps(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      config: defaultConfig(type),
      collapsed: false,
    }]);
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const updateConfig = (id: string, patch: Partial<StepConfig>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, config: { ...s.config, ...patch } } : s));
  };

  const toggleCollapse = (id: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s));
  };

  const moveStep = (from: number, to: number) => {
    setSteps(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const runPipeline = useCallback(async () => {
    if (steps.length === 0) return;
    setRunning(true);
    setStepResults(new Map());
    setFinalResult(null);

    let currentBlob: Blob = file;
    let currentFile: File = file;

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        setCurrentStep(i);

        if (step.type === 'crop') {
          // Crop step: use canvas
          const img = await loadImage(currentBlob);
          const { cropX = 0, cropY = 0, cropW = img.naturalWidth, cropH = img.naturalHeight } = step.config;
          // Convert percentage to pixels if values are small (< image size heuristic)
          const isPercent = cropW <= 100 && cropH <= 100 && cropX <= 100 && cropY <= 100;
          const px = isPercent ? cropX / 100 * img.naturalWidth : cropX;
          const py = isPercent ? cropY / 100 * img.naturalHeight : cropY;
          const pw = isPercent ? cropW / 100 * img.naturalWidth : cropW;
          const ph = isPercent ? cropH / 100 * img.naturalHeight : cropH;

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(pw);
          canvas.height = Math.round(ph);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);

          currentBlob = await canvasToBlob(canvas, 'image/png');
          currentFile = new File([currentBlob], 'pipeline.png', { type: 'image/png' });

          setStepResults(prev => new Map(prev).set(step.id, {
            blob: currentBlob,
            url: URL.createObjectURL(currentBlob),
            width: canvas.width,
            height: canvas.height,
            size: currentBlob.size,
          }));
        } else if (step.type === 'filter') {
          // Filter step: use applyFiltersToBlob
          const filterVals: FilterValues = {
            brightness: step.config.filterBrightness ?? 0,
            contrast: step.config.filterContrast ?? 0,
            saturation: step.config.filterSaturation ?? 0,
            vibrance: step.config.filterVibrance ?? 0,
            sepia: step.config.filterSepia ?? 0,
            grayscale: step.config.filterGrayscale ?? 0,
            hueRotate: step.config.filterHueRotate ?? 0,
            warmth: step.config.filterWarmth ?? 0,
          };
          currentBlob = await applyFiltersToBlob(currentBlob, filterVals);
          currentFile = new File([currentBlob], 'pipeline.png', { type: 'image/png' });
          const fImg = await loadImage(currentBlob);

          setStepResults(prev => new Map(prev).set(step.id, {
            blob: currentBlob,
            url: URL.createObjectURL(currentBlob),
            width: fImg.naturalWidth,
            height: fImg.naturalHeight,
            size: currentBlob.size,
          }));
        } else {
          // Use processImage for compress/resize/upscale/remove-bg
          const options: ProcessingOptions = {
            mode: step.type as ProcessingOptions['mode'],
            quality: step.config.quality ?? 80,
            format: step.type === 'remove-bg' ? 'png' : (step.config.format ?? 'webp'),
            width: step.config.width,
            maintainAspect: step.config.maintainAspect ?? true,
            scale: step.config.scale,
            autoOptimize: step.config.autoOptimize ?? false,
          };

          const res = await processImage(currentFile, options);

          currentBlob = res.blob;
          currentFile = new File([currentBlob], `pipeline.${res.format}`, { type: `image/${res.format}` });

          setStepResults(prev => new Map(prev).set(step.id, {
            blob: currentBlob,
            url: res.url,
            width: res.width,
            height: res.height,
            size: res.processedSize,
          }));
        }
      }

      setCurrentStep(-1);
      const url = URL.createObjectURL(currentBlob);
      setFinalResult({ blob: currentBlob, url });

      // Build a ProcessingResult for the callback
      const img = await loadImage(currentBlob);
      const pipelineResult: ProcessingResult = {
        blob: currentBlob,
        url,
        originalSize: file.size,
        processedSize: currentBlob.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: currentBlob.type.split('/')[1] || 'png',
        savings: Math.max(0, Math.round((1 - currentBlob.size / file.size) * 100)),
        mode: 'compress',
      };
      onPipelineComplete?.(currentBlob, pipelineResult);
    } catch (err) {
      console.error('Pipeline error:', err);
    } finally {
      setRunning(false);
      setCurrentStep(-1);
    }
  }, [steps, file, onPipelineComplete]);

  const handleDownload = () => {
    if (!finalResult) return;
    const a = document.createElement('a');
    a.href = finalResult.url;
    a.download = `pixelforge-pipeline.${finalResult.blob.type.split('/')[1] || 'png'}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl font-bold text-foreground">Pipeline</h2>
        <p className="text-muted-foreground text-sm">
          Chaînez les opérations : chaque étape utilise le résultat de la précédente
        </p>
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        <AnimatePresence>
          {steps.map((step, idx) => {
            const meta = STEP_META[step.type];
            const result = stepResults.get(step.id);
            const isActive = currentStep === idx;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                layout
                className={`glass rounded-xl overflow-hidden transition-all ${
                  isActive ? 'ring-2 ring-primary' : ''
                }`}
              >
                {/* Step header */}
                <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 flex-wrap">
                  <button
                    className="cursor-grab text-muted-foreground hover:text-foreground"
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveStep(dragIdx, idx); setDragIdx(null); }}
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>

                  <div className={`flex items-center gap-2 ${meta.color}`}>
                    {meta.icon}
                    <span className="font-heading font-semibold text-sm">{meta.label}</span>
                  </div>

                  <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                    Étape {idx + 1}
                  </span>

                  {result && !isActive && (
                    <span className="text-[10px] text-primary flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {formatBytes(result.size)}
                    </span>
                  )}

                  {isActive && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}

                  <div className="flex-1" />

                  <button onClick={() => toggleCollapse(step.id)} className="text-muted-foreground hover:text-foreground">
                    {step.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  <button onClick={() => removeStep(step.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Step config */}
                {!step.collapsed && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="px-4 pb-4 space-y-3 border-t border-border pt-3"
                  >
                    <StepConfigEditor step={step} onChange={(patch) => updateConfig(step.id, patch)} />
                  </motion.div>
                )}

                {/* Step result preview */}
                {result && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-3">
                      <img src={result.url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                      <div className="text-xs text-muted-foreground">
                        <span>{result.width} × {result.height} px</span>
                        <span className="mx-2">·</span>
                        <span>{formatBytes(result.size)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Arrow between steps */}
        {steps.length > 0 && (
          <div className="flex justify-center">
            <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
          </div>
        )}
      </div>

      {/* Add step */}
      <div className="glass rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-3">Ajouter une étape</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STEP_META) as StepType[]).map((type) => {
            const meta = STEP_META[type];
            return (
              <button
                key={type}
                onClick={() => addStep(type)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-secondary/50 border border-transparent hover:border-primary/30 transition-all ${meta.color}`}
              >
                <Plus className="w-3 h-3" />
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={runPipeline}
          disabled={running || steps.length === 0}
          className="flex-1 gap-2"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? `Étape ${currentStep + 1}/${steps.length}…` : `Exécuter le pipeline (${steps.length} étape${steps.length > 1 ? 's' : ''})`}
        </Button>
        {finalResult && (
          <Button variant="outline" onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" /> Télécharger
          </Button>
        )}
      </div>

      {/* Final result */}
      {finalResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl overflow-hidden"
        >
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h4 className="text-sm font-heading font-semibold text-foreground">Résultat final</h4>
            <div className="text-xs text-muted-foreground">
              {formatBytes(file.size)} → {formatBytes(finalResult.blob.size)}
              <span className="text-primary font-semibold ml-2">
                {file.size > 0 ? `-${Math.max(0, Math.round((1 - finalResult.blob.size / file.size) * 100))}%` : ''}
              </span>
            </div>
          </div>
          <div className="p-4 flex items-center justify-center bg-secondary/20">
            <img src={finalResult.url} alt="Pipeline result" className="max-w-full max-h-[50vh] object-contain rounded" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Sub-component for per-step configuration
function StepConfigEditor({ step, onChange }: { step: PipelineStep; onChange: (patch: Partial<StepConfig>) => void }) {
  const { type, config } = step;

  if (type === 'crop') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">X (%)</label>
          <Input type="number" value={config.cropX ?? 0} onChange={(e) => onChange({ cropX: Number(e.target.value) })} className="bg-secondary/50 h-8 text-xs" min={0} max={100} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Y (%)</label>
          <Input type="number" value={config.cropY ?? 0} onChange={(e) => onChange({ cropY: Number(e.target.value) })} className="bg-secondary/50 h-8 text-xs" min={0} max={100} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Largeur (%)</label>
          <Input type="number" value={config.cropW ?? 100} onChange={(e) => onChange({ cropW: Number(e.target.value) })} className="bg-secondary/50 h-8 text-xs" min={1} max={100} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Hauteur (%)</label>
          <Input type="number" value={config.cropH ?? 100} onChange={(e) => onChange({ cropH: Number(e.target.value) })} className="bg-secondary/50 h-8 text-xs" min={1} max={100} />
        </div>
        <p className="col-span-2 text-[10px] text-muted-foreground">Valeurs en pourcentage de l'image d'entrée</p>
      </div>
    );
  }

  if (type === 'compress') {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">Format</label>
          <Select value={config.format ?? 'webp'} onValueChange={(v) => onChange({ format: v as StepConfig['format'] })}>
            <SelectTrigger className="bg-secondary/50 border-border h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="webp">WebP</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="avif">AVIF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {config.format !== 'png' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Qualité</span>
              <span className="text-primary font-semibold">{config.quality ?? 80}%</span>
            </div>
            <Slider value={[config.quality ?? 80]} onValueChange={([v]) => onChange({ quality: v })} min={10} max={100} step={1} />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Optimisation perceptuelle</span>
          <Switch checked={config.autoOptimize ?? false} onCheckedChange={(v) => onChange({ autoOptimize: v })} />
        </div>
      </div>
    );
  }

  if (type === 'resize') {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">Largeur (px)</label>
          <Input type="number" value={config.width ?? 1920} onChange={(e) => onChange({ width: Number(e.target.value) })} className="bg-secondary/50 h-8 text-xs" min={1} max={8000} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Conserver ratio</span>
          <Switch checked={config.maintainAspect ?? true} onCheckedChange={(v) => onChange({ maintainAspect: v })} />
        </div>
      </div>
    );
  }

  if (type === 'upscale') {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Facteur</label>
        <div className="flex gap-2">
          {[2, 3, 4].map((s) => (
            <button
              key={s}
              onClick={() => onChange({ scale: s })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                (config.scale ?? 2) === s ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'remove-bg') {
    return (
      <p className="text-[11px] text-muted-foreground">
        Suppression automatique par IA — modèle téléchargé localement (~40 MB).
      </p>
    );
  }

  if (type === 'filter') {
    const filterSliders: { key: string; configKey: keyof StepConfig; label: string; min: number; max: number; unit?: string }[] = [
      { key: 'br', configKey: 'filterBrightness', label: 'Luminosité', min: -100, max: 100 },
      { key: 'ct', configKey: 'filterContrast', label: 'Contraste', min: -100, max: 100 },
      { key: 'sa', configKey: 'filterSaturation', label: 'Saturation', min: -100, max: 100 },
      { key: 'vi', configKey: 'filterVibrance', label: 'Vibrance', min: -100, max: 100 },
      { key: 'wa', configKey: 'filterWarmth', label: 'Chaleur', min: -100, max: 100 },
      { key: 'se', configKey: 'filterSepia', label: 'Sépia', min: 0, max: 100, unit: '%' },
      { key: 'gs', configKey: 'filterGrayscale', label: 'N&B', min: 0, max: 100, unit: '%' },
      { key: 'hu', configKey: 'filterHueRotate', label: 'Teinte', min: 0, max: 360, unit: '°' },
    ];
    return (
      <div className="space-y-2">
        {filterSliders.map((s) => (
          <div key={s.key} className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="text-primary font-semibold tabular-nums">{(config[s.configKey] as number) ?? 0}{s.unit || ''}</span>
            </div>
            <Slider
              value={[(config[s.configKey] as number) ?? 0]}
              onValueChange={([v]) => onChange({ [s.configKey]: v })}
              min={s.min}
              max={s.max}
              step={1}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob conversion failed')), mime, quality);
  });
}
