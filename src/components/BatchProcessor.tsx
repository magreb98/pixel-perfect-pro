import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, Loader2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { processImage, formatBytes, type ProcessingOptions, type ProcessingResult } from '@/lib/image-processing';

interface BatchItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  result?: ProcessingResult;
  error?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'];

export default function BatchProcessor() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [format, setFormat] = useState<'webp' | 'jpeg' | 'png'>('webp');
  const [quality, setQuality] = useState(80);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newItems: BatchItem[] = Array.from(files)
      .filter(f => ACCEPTED.includes(f.type))
      .map(f => ({
        id: crypto.randomUUID(),
        file: f,
        status: 'pending' as const,
        progress: 0,
      }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const processAll = async () => {
    setProcessing(true);
    const options: ProcessingOptions = {
      mode: 'compress',
      quality,
      format,
      maintainAspect: true,
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === 'done') continue;

      setItems(prev => prev.map(it =>
        it.id === item.id ? { ...it, status: 'processing' as const, progress: 0 } : it
      ));

      try {
        const result = await processImage(item.file, options, (p) => {
          setItems(prev => prev.map(it =>
            it.id === item.id ? { ...it, progress: p } : it
          ));
        });
        setItems(prev => prev.map(it =>
          it.id === item.id ? { ...it, status: 'done' as const, progress: 100, result } : it
        ));
      } catch (err) {
        setItems(prev => prev.map(it =>
          it.id === item.id ? { ...it, status: 'error' as const, error: err instanceof Error ? err.message : 'Erreur' } : it
        ));
      }
    }
    setProcessing(false);
  };

  const downloadAll = () => {
    items.forEach(item => {
      if (item.result) {
        const a = document.createElement('a');
        a.href = item.result.url;
        a.download = `pixelforge-${item.file.name.split('.')[0]}.${format}`;
        a.click();
      }
    });
  };

  const totalOriginal = items.reduce((s, i) => s + i.file.size, 0);
  const totalProcessed = items.reduce((s, i) => s + (i.result?.processedSize || 0), 0);
  const doneCount = items.filter(i => i.status === 'done').length;

  return (
    <div className="space-y-6">
      {/* Drop area */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="flex flex-col items-center gap-3 p-8 rounded-2xl cursor-pointer glass hover:border-primary/40 transition-all"
      >
        <input
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <Upload className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Glissez plusieurs images ou cliquez · Max 50 MB chacune</p>
      </label>

      {items.length > 0 && (
        <>
          {/* Settings row */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Format</label>
              <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webp">WebP</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {format !== 'png' && (
              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground">Qualité : {quality}%</label>
                <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={10} max={100} step={1} />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={processAll} disabled={processing || items.length === 0} className="gap-2">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <></>}
                {processing ? 'En cours…' : 'Tout compresser'}
              </Button>
              {doneCount > 0 && (
                <Button variant="outline" onClick={downloadAll} className="gap-2">
                  <Download className="w-4 h-4" /> Tout télécharger
                </Button>
              )}
            </div>
          </div>

          {/* Stats bar */}
          {doneCount > 0 && (
            <div className="flex gap-4 text-xs text-muted-foreground glass rounded-xl px-4 py-3">
              <span>{doneCount}/{items.length} traités</span>
              <span>Original: {formatBytes(totalOriginal)}</span>
              <span>Compressé: {formatBytes(totalProcessed)}</span>
              {totalOriginal > 0 && (
                <span className="text-primary font-semibold">
                  -{Math.max(0, Math.round((1 - totalProcessed / totalOriginal) * 100))}%
                </span>
              )}
            </div>
          )}

          {/* File list */}
          <div className="space-y-2">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 glass rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(item.file.size)}
                      {item.result && (
                        <span className="text-primary ml-2">
                          → {formatBytes(item.result.processedSize)} (-{item.result.savings}%)
                        </span>
                      )}
                    </p>
                  </div>

                  {item.status === 'processing' && (
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  )}
                  {item.status === 'done' && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                  {item.status === 'error' && (
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs">{item.error}</span>
                    </div>
                  )}
                  {item.status === 'pending' && (
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
