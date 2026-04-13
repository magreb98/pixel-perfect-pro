import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import DropZone from '@/components/DropZone';
import ProcessingPanel from '@/components/ProcessingPanel';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import ResultStats from '@/components/ResultStats';
import { processImage, type ProcessingOptions, type ProcessingResult } from '@/lib/image-processing';
import { useToast } from '@/hooks/use-toast';

export default function Index() {
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
      toast({ title: 'Traitement terminé', description: `Réduction de ${res.savings}%` });
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

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar />
      <main className="container pt-24 pb-16 px-4 sm:px-6">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div key="upload" className="max-w-2xl mx-auto space-y-8">
              <div className="text-center space-y-3">
                <h1 className="font-heading text-4xl sm:text-5xl font-bold">
                  <span className="text-gradient">PixelForge</span>
                </h1>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  Compression, redimensionnement et upscaling — directement dans votre navigateur.
                </p>
              </div>
              <DropZone onFileSelect={handleFileSelect} />
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { title: 'Compression', desc: 'WebP/JPEG intelligent' },
                  { title: 'Resize', desc: 'Interpolation haute qualité' },
                  { title: 'Upscale', desc: 'Amélioration par IA' },
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
            </motion.div>
          ) : (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-heading">
                  ← Nouvelle image
                </button>
                <span className="text-xs text-muted-foreground font-body truncate max-w-[200px]">{file.name}</span>
              </div>

              <div className="grid lg:grid-cols-[1fr_320px] gap-6">
                <div className="space-y-6">
                  {result ? (
                    <BeforeAfterSlider beforeSrc={originalUrl} afterSrc={result.url} />
                  ) : (
                    <div className="glass rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                      <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                  {result && <ResultStats result={result} />}
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
