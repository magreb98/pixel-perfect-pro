import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import DropZone from '@/components/DropZone';
import ProcessingPanel from '@/components/ProcessingPanel';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import ResultStats from '@/components/ResultStats';
import BatchProcessor from '@/components/BatchProcessor';
import HistoryPanel from '@/components/HistoryPanel';
import ImageAnalysisPanel from '@/components/ImageAnalysisPanel';
import {
  processImage,
  addToHistory,
  createThumbnail,
  type ProcessingOptions,
  type ProcessingResult,
} from '@/lib/image-processing';
import { useToast } from '@/hooks/use-toast';

export default function Index() {
  const [tab, setTab] = useState('editor');
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileSelect = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    const url = URL.createObjectURL(f);
    setOriginalUrl(url);
    const img = new Image();
    img.onload = () => setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, []);

  const handleProcess = useCallback(async (options: ProcessingOptions) => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    try {
      const res = await processImage(file, options, setProgress);
      setResult(res);

      // Save to history
      const thumbnail = await createThumbnail(res.blob);
      addToHistory({
        id: crypto.randomUUID(),
        filename: file.name,
        mode: options.mode,
        originalSize: res.originalSize,
        processedSize: res.processedSize,
        savings: res.savings,
        width: res.width,
        height: res.height,
        format: res.format,
        timestamp: Date.now(),
        thumbnail,
      });

      const desc = options.mode === 'remove-bg'
        ? 'Fond supprimé avec succès'
        : `Réduction de ${res.savings}%`;
      toast({ title: 'Traitement terminé', description: desc });
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [file, toast]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `pixelforge-output.${result.format}`;
    a.click();
  }, [result]);

  const handleReset = () => {
    setFile(null);
    setOriginalUrl('');
    setResult(null);
    setOriginalDims(null);
  };

  // Checkerboard bg for transparent images
  const showCheckerboard = result?.mode === 'remove-bg';

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar activeTab={tab} onTabChange={setTab} />
      <main className="container pt-24 pb-16 px-4 sm:px-6">
        <AnimatePresence mode="wait">
          {tab === 'editor' && (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!file ? (
                <div className="max-w-2xl mx-auto space-y-8">
                  <div className="text-center space-y-3">
                    <h1 className="font-heading text-4xl sm:text-5xl font-bold">
                      <span className="text-gradient">PixelForge</span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                      Compression, redimensionnement, upscaling et suppression de fond — 100% dans votre navigateur.
                    </p>
                  </div>
                  <DropZone onFileSelect={handleFileSelect} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[
                      { title: 'Compression', desc: 'WebP/JPEG intelligent' },
                      { title: 'Resize', desc: 'Haute qualité' },
                      { title: 'Upscale', desc: 'Amélioration IA' },
                      { title: 'Fond', desc: 'Suppression IA' },
                    ].map((f, i) => (
                      <motion.div
                        key={f.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="glass rounded-xl p-4"
                      >
                        <h3 className="font-heading font-semibold text-sm text-foreground">{f.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-heading">
                      ← Nouvelle image
                    </button>
                    <span className="text-xs text-muted-foreground font-body truncate max-w-[200px]">{file.name}</span>
                  </div>

                  <div className="grid lg:grid-cols-[1fr_320px] gap-6">
                    <div className="space-y-6">
                      {result ? (
                        showCheckerboard ? (
                          <div className="glass rounded-xl overflow-hidden aspect-video flex items-center justify-center"
                            style={{ backgroundImage: 'repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%)', backgroundSize: '20px 20px' }}
                          >
                            <img src={result.url} alt="Résultat" className="max-w-full max-h-full object-contain" />
                          </div>
                        ) : (
                          <BeforeAfterSlider beforeSrc={originalUrl} afterSrc={result.url} />
                        )
                      ) : (
                        <div className="glass rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                          <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                      {result && <ResultStats result={result} />}
                      <ImageAnalysisPanel file={file} />
                    </div>

                    <ProcessingPanel
                      onProcess={handleProcess}
                      onDownload={handleDownload}
                      processing={processing}
                      progress={progress}
                      hasResult={!!result}
                      originalWidth={originalDims?.w}
                      originalHeight={originalDims?.h}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'batch' && (
            <motion.div key="batch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-heading text-2xl font-bold text-foreground">Traitement par lot</h2>
                <p className="text-muted-foreground text-sm">Compressez plusieurs images en une seule opération</p>
              </div>
              <BatchProcessor />
            </motion.div>
          )}

          {tab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-heading text-2xl font-bold text-foreground">Historique</h2>
                <p className="text-muted-foreground text-sm">Vos 20 derniers traitements</p>
              </div>
              <HistoryPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
