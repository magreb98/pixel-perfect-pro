import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Download, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes } from '@/lib/image-processing';
import DropZone from '@/components/DropZone';

interface CompressionVariant {
  quality: number;
  blob: Blob;
  url: string;
  size: number;
  savings: number;
}

const QUALITY_PRESETS = [20, 40, 60, 75, 85, 95];

export default function QualityComparator() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [format, setFormat] = useState<'webp' | 'jpeg'>('webp');
  const [variants, setVariants] = useState<CompressionVariant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleFileSelect = useCallback((f: File) => {
    setFile(f);
    setOriginalUrl(URL.createObjectURL(f));
    setVariants([]);
    setSelected(null);
  }, []);

  const generateVariants = useCallback(async () => {
    if (!file) return;
    setGenerating(true);
    setVariants([]);

    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';
    const results: CompressionVariant[] = [];

    for (const q of QUALITY_PRESETS) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject()),
          mime,
          q / 100
        );
      });
      results.push({
        quality: q,
        blob,
        url: URL.createObjectURL(blob),
        size: blob.size,
        savings: Math.max(0, Math.round((1 - blob.size / file.size) * 100)),
      });
    }

    setVariants(results);
    setGenerating(false);
  }, [file, format]);

  useEffect(() => {
    if (file) generateVariants();
  }, [file, format, generateVariants]);

  const handleDownloadSelected = () => {
    if (selected === null) return;
    const v = variants[selected];
    if (!v) return;
    const a = document.createElement('a');
    a.href = v.url;
    a.download = `pixelforge-q${v.quality}.${format}`;
    a.click();
  };

  const reset = () => {
    setFile(null);
    setOriginalUrl('');
    setVariants([]);
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl font-bold text-foreground">Comparateur de qualité</h2>
        <p className="text-muted-foreground text-sm">
          Comparez 6 niveaux de compression pour trouver le meilleur compromis qualité/taille
        </p>
      </div>

      {!file ? (
        <div className="max-w-xl mx-auto">
          <DropZone onFileSelect={handleFileSelect} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-heading">
              ← Nouvelle image
            </button>
            <div className="flex items-center gap-3">
              <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <SelectTrigger className="w-[120px] bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webp">WebP</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              {selected !== null && (
                <Button size="sm" variant="outline" onClick={handleDownloadSelected} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Q{variants[selected]?.quality}
                </Button>
              )}
            </div>
          </div>

          {generating ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Génération des variantes…</span>
            </div>
          ) : (
            <>
              {/* Size comparison bar */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Original : {formatBytes(file.size)}</span>
                  <span>Cliquez pour sélectionner</span>
                </div>
                <div className="flex gap-1.5 h-10">
                  {variants.map((v, i) => {
                    const ratio = file.size > 0 ? v.size / file.size : 1;
                    return (
                      <button
                        key={v.quality}
                        onClick={() => setSelected(i)}
                        className={`relative rounded-lg transition-all flex items-center justify-center text-[10px] font-semibold ${
                          selected === i
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                            : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
                        }`}
                        style={{ flex: Math.max(0.2, ratio) }}
                        title={`${v.quality}% — ${formatBytes(v.size)} (-${v.savings}%)`}
                      >
                        {v.quality}%
                        {selected === i && <Check className="w-3 h-3 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid of previews */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence>
                  {variants.map((v, i) => (
                    <motion.button
                      key={v.quality}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelected(i)}
                      className={`glass rounded-xl overflow-hidden text-left transition-all ${
                        selected === i ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border'
                      }`}
                    >
                      <div className="overflow-hidden aspect-video relative">
                        <img
                          src={v.url}
                          alt={`Qualité ${v.quality}%`}
                          className="w-full h-full object-cover"
                          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                        />
                        {selected === i && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-heading font-semibold text-foreground">
                            {v.quality}%
                          </span>
                          <span className="text-xs text-primary font-semibold">-{v.savings}%</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatBytes(v.size)}</p>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
