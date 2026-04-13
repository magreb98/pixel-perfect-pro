import { useState } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Zap, Maximize, Sparkles, Scissors, Download, Loader2 } from 'lucide-react';
import type { ProcessingOptions } from '@/lib/image-processing';

type Mode = ProcessingOptions['mode'];

interface ProcessingPanelProps {
  onProcess: (options: ProcessingOptions) => void;
  onDownload: () => void;
  processing: boolean;
  progress: number;
  hasResult: boolean;
  originalWidth?: number;
  originalHeight?: number;
}

const modes: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: 'compress', label: 'Compresser', icon: <Zap className="w-4 h-4" /> },
  { value: 'resize', label: 'Resize', icon: <Maximize className="w-4 h-4" /> },
  { value: 'upscale', label: 'Upscale', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'remove-bg', label: 'Fond', icon: <Scissors className="w-4 h-4" /> },
];

export default function ProcessingPanel({ onProcess, onDownload, processing, progress, hasResult, originalWidth, originalHeight }: ProcessingPanelProps) {
  const [mode, setMode] = useState<Mode>('compress');
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<'webp' | 'jpeg' | 'png'>('webp');
  const [width, setWidth] = useState(originalWidth || 1920);
  const [scale, setScale] = useState(2);

  const handleProcess = () => {
    const opts: ProcessingOptions = {
      mode, quality,
      format: mode === 'remove-bg' ? 'png' : format,
      width: mode === 'resize' ? width : undefined,
      maintainAspect: true,
      scale: mode === 'upscale' ? scale : undefined,
    };
    onProcess(opts);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass rounded-2xl p-6 space-y-6"
    >
      <h3 className="font-heading font-semibold text-lg text-foreground">Paramètres</h3>

      {/* Mode selector */}
      <div className="grid grid-cols-4 gap-2">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all text-xs ${
              mode === m.value
                ? 'bg-primary/15 border border-primary/40 text-primary'
                : 'bg-secondary/50 border border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.icon}
            <span className="font-medium">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Remove BG info */}
      {mode === 'remove-bg' && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
          <p className="text-xs text-primary">
            Suppression de fond par IA — le modèle est téléchargé lors de la première utilisation (~40 MB). Le traitement est 100% local.
          </p>
        </div>
      )}

      {/* Format (hidden for remove-bg, always PNG) */}
      {mode !== 'remove-bg' && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Format de sortie</label>
          <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="webp">WebP (recommandé)</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="png">PNG (sans perte)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Quality slider */}
      {mode !== 'remove-bg' && format !== 'png' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Qualité</span>
            <span className="text-primary font-semibold">{quality}%</span>
          </div>
          <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={10} max={100} step={1} />
        </div>
      )}

      {/* Resize options */}
      {mode === 'resize' && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Largeur (px)</label>
          <Input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="bg-secondary/50"
            min={1}
            max={8000}
          />
          {originalWidth && originalHeight && (
            <p className="text-xs text-muted-foreground">
              Original : {originalWidth} × {originalHeight}
            </p>
          )}
        </div>
      )}

      {/* Upscale options */}
      {mode === 'upscale' && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Facteur d'agrandissement</label>
          <div className="flex gap-2">
            {[2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  scale === s ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      {processing && (
        <div className="space-y-2">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {mode === 'remove-bg' && progress < 30 ? 'Chargement du modèle IA…' : 'Traitement en cours…'} {progress}%
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleProcess} disabled={processing} className="flex-1 gap-2">
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {processing ? 'Traitement…' : 'Traiter'}
        </Button>
        {hasResult && (
          <Button variant="outline" onClick={onDownload} className="gap-2">
            <Download className="w-4 h-4" /> Télécharger
          </Button>
        )}
      </div>
    </motion.div>
  );
}
