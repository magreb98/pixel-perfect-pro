import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import Navbar from '@/components/Navbar';
import ImageGrid, { type ImageItem } from '@/components/ImageGrid';
import ProcessingPanel from '@/components/ProcessingPanel';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import ResultStats from '@/components/ResultStats';
import HistoryPanel from '@/components/HistoryPanel';
import QualityComparator from '@/components/QualityComparator';
import CropTool from '@/components/CropTool';
import PipelineEditor from '@/components/PipelineEditor';
import FilterEditor from '@/components/FilterEditor';
import ImageAnalysisPanel from '@/components/ImageAnalysisPanel';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Download, Archive, Undo2, Redo2 } from 'lucide-react';
import {
  processImage,
  addToHistory,
  createThumbnail,
  formatBytes,
  type ProcessingOptions,
  type ProcessingResult,
} from '@/lib/image-processing';
import { useToast } from '@/hooks/use-toast';
import { useUndoRedo } from '@/hooks/use-undo-redo';

interface EditedResult {
  imageId: string;
  result: ProcessingResult;
  filename: string;
}

// Serializable snapshot of all results
type ResultsSnapshot = Map<string, ProcessingResult>;

export default function Index() {
  const [tab, setTab] = useState('editor');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Undo/redo on results map
  const undoRedo = useUndoRedo<ResultsSnapshot>(new Map());
  const results = undoRedo.current;

  const setResults = useCallback((updater: (prev: ResultsSnapshot) => ResultsSnapshot) => {
    undoRedo.set(updater(undoRedo.current));
  }, [undoRedo]);

  const selectedImage = images.find(i => i.id === selectedId) || null;
  const selectedResult = selectedId ? results.get(selectedId) || null : null;
  const selectedUrl = selectedImage ? selectedImage.url : '';

  // Track original dimensions per image
  const [dimsMap, setDimsMap] = useState<Map<string, { w: number; h: number }>>(new Map());
  const selectedDims = selectedId ? dimsMap.get(selectedId) || null : null;

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          undoRedo.redo();
        } else {
          undoRedo.undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        undoRedo.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoRedo]);

  const handleAddImages = useCallback((files: File[]) => {
    const newItems: ImageItem[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      url: URL.createObjectURL(f),
    }));
    setImages(prev => [...prev, ...newItems]);

    newItems.forEach(item => {
      const img = new Image();
      img.onload = () => {
        setDimsMap(prev => new Map(prev).set(item.id, { w: img.naturalWidth, h: img.naturalHeight }));
      };
      img.src = item.url;
    });

    if (!selectedId && newItems.length > 0) {
      setSelectedId(newItems[0].id);
    }
  }, [selectedId]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => prev.filter(i => i.id !== id));
    setResults(prev => { const n = new Map(prev); n.delete(id); return n; });
    setDimsMap(prev => { const n = new Map(prev); n.delete(id); return n; });
    if (selectedId === id) {
      setSelectedId(prev => {
        const remaining = images.filter(i => i.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    }
  }, [selectedId, images, setResults]);

  const handleProcess = useCallback(async (options: ProcessingOptions) => {
    if (!selectedImage) return;
    setProcessing(true);
    setProgress(0);
    try {
      const res = await processImage(selectedImage.file, options, setProgress);

      setResults(prev => new Map(prev).set(selectedImage.id, res));
      setImages(prev => prev.map(i => i.id === selectedImage.id ? { ...i, edited: true } : i));

      const thumbnail = await createThumbnail(res.blob);
      addToHistory({
        id: crypto.randomUUID(),
        filename: selectedImage.file.name,
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

      toast({ title: 'Traitement terminé', description: options.mode === 'remove-bg' ? 'Fond supprimé' : `Réduction de ${res.savings}%` });
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [selectedImage, toast, setResults]);

  const handleDownloadSingle = useCallback(() => {
    if (!selectedResult || !selectedImage) return;
    const a = document.createElement('a');
    a.href = selectedResult.url;
    const baseName = selectedImage.file.name.replace(/\.[^.]+$/, '');
    a.download = `pixelforge-${baseName}.${selectedResult.format}`;
    a.click();
  }, [selectedResult, selectedImage]);

  const handleDownloadAllZip = useCallback(async () => {
    const editedEntries: EditedResult[] = [];
    images.forEach(img => {
      const r = results.get(img.id);
      if (r) editedEntries.push({ imageId: img.id, result: r, filename: img.file.name });
    });

    if (editedEntries.length === 0) {
      toast({ title: 'Aucune image éditée', description: 'Traitez au moins une image avant de télécharger.', variant: 'destructive' });
      return;
    }

    if (editedEntries.length === 1) {
      const entry = editedEntries[0];
      const a = document.createElement('a');
      a.href = entry.result.url;
      const baseName = entry.filename.replace(/\.[^.]+$/, '');
      a.download = `pixelforge-${baseName}.${entry.result.format}`;
      a.click();
      return;
    }

    toast({ title: 'Création du ZIP…', description: 'Patientez…' });
    const zip = new JSZip();
    for (const entry of editedEntries) {
      const baseName = entry.filename.replace(/\.[^.]+$/, '');
      zip.file(`pixelforge-${baseName}.${entry.result.format}`, entry.result.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixelforge-export.zip';
    a.click();
    toast({ title: 'ZIP téléchargé', description: `${editedEntries.length} images exportées` });
  }, [images, results, toast]);

  const editedCount = images.filter(i => results.has(i.id)).length;
  const showCheckerboard = selectedResult?.mode === 'remove-bg';

  const handleCropped = useCallback((blob: Blob) => {
    if (!selectedImage) return;
    const url = URL.createObjectURL(blob);
    const res: ProcessingResult = {
      blob, url,
      originalSize: selectedImage.file.size,
      processedSize: blob.size,
      width: 0, height: 0,
      format: 'png',
      savings: Math.max(0, Math.round((1 - blob.size / selectedImage.file.size) * 100)),
      mode: 'compress',
    };
    setResults(prev => new Map(prev).set(selectedImage.id, res));
    setImages(prev => prev.map(i => i.id === selectedImage.id ? { ...i, edited: true } : i));
  }, [selectedImage, setResults]);

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar activeTab={tab} onTabChange={setTab} />
      <main className="container pt-20 sm:pt-24 pb-12 sm:pb-16 px-3 sm:px-6">
        {/* Undo/Redo toolbar */}
        {images.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{images.length} image{images.length > 1 ? 's' : ''} · {editedCount} éditée{editedCount > 1 ? 's' : ''}</span>
              {editedCount > 0 && (
                <Button size="sm" variant="outline" onClick={handleDownloadAllZip} className="gap-1.5">
                  <Archive className="w-3.5 h-3.5" />
                  {editedCount > 1 ? `ZIP (${editedCount})` : 'Télécharger'}
                </Button>
              )}
            </div>
            <TooltipProvider>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => undoRedo.undo()}
                      disabled={!undoRedo.canUndo}
                      className="h-8 w-8"
                    >
                      <Undo2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Annuler <kbd className="ml-1 text-[10px] bg-secondary px-1 rounded">⌘Z</kbd></p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => undoRedo.redo()}
                      disabled={!undoRedo.canRedo}
                      className="h-8 w-8"
                    >
                      <Redo2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Rétablir <kbd className="ml-1 text-[10px] bg-secondary px-1 rounded">⌘⇧Z</kbd></p></TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )}

        {/* Image grid */}
        {images.length > 0 && (
          <div className="mb-6">
            <ImageGrid
              images={images}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={handleAddImages}
              onRemove={handleRemoveImage}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === 'editor' && (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {images.length === 0 ? (
                <div className="max-w-2xl mx-auto space-y-8">
                  <div className="text-center space-y-3">
                    <h1 className="font-heading text-4xl sm:text-5xl font-bold">
                      <span className="text-gradient">PixelForge</span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                      Compression, redimensionnement, upscaling et suppression de fond — 100% dans votre navigateur.
                    </p>
                  </div>
                  <ImageGrid
                    images={[]}
                    selectedId={null}
                    onSelect={() => {}}
                    onAdd={handleAddImages}
                    onRemove={() => {}}
                  />
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
              ) : selectedImage ? (
                <div className="space-y-6">
                  <div className="grid lg:grid-cols-[1fr_320px] gap-6">
                    <div className="space-y-6">
                      {selectedResult ? (
                        showCheckerboard ? (
                          <div className="glass rounded-xl overflow-hidden aspect-video flex items-center justify-center"
                            style={{ backgroundImage: 'repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%)', backgroundSize: '20px 20px' }}
                          >
                            <img src={selectedResult.url} alt="Résultat" className="max-w-full max-h-full object-contain" />
                          </div>
                        ) : (
                          <BeforeAfterSlider beforeSrc={selectedUrl} afterSrc={selectedResult.url} />
                        )
                      ) : (
                        <div className="glass rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                          <img src={selectedUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                      {selectedResult && <ResultStats result={selectedResult} />}
                      <ImageAnalysisPanel file={selectedImage.file} />
                    </div>

                    <ProcessingPanel
                      onProcess={handleProcess}
                      onDownload={handleDownloadSingle}
                      processing={processing}
                      progress={progress}
                      hasResult={!!selectedResult}
                      originalWidth={selectedDims?.w}
                      originalHeight={selectedDims?.h}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Sélectionnez une image dans la grille ci-dessus</p>
              )}
            </motion.div>
          )}

          {tab === 'filters' && (
            <motion.div key="filters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
              {selectedImage ? (
                <FilterEditor
                  file={selectedImage.file}
                  onApply={(blob) => {
                    if (!selectedImage) return;
                    const url = URL.createObjectURL(blob);
                    const res = {
                      blob, url,
                      originalSize: selectedImage.file.size,
                      processedSize: blob.size,
                      width: 0, height: 0,
                      format: 'png' as const,
                      savings: Math.max(0, Math.round((1 - blob.size / selectedImage.file.size) * 100)),
                      mode: 'compress' as const,
                    };
                    setResults(prev => new Map(prev).set(selectedImage.id, res));
                    setImages(prev => prev.map(i => i.id === selectedImage.id ? { ...i, edited: true } : i));
                  }}
                />
              ) : (
                <p className="text-center text-muted-foreground py-16">Ajoutez et sélectionnez une image pour appliquer des filtres</p>
              )}
            </motion.div>
          )}

          {tab === 'crop' && (
            <motion.div key="crop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto">
              {selectedImage ? (
                <CropTool file={selectedImage.file} onCropped={handleCropped} />
              ) : (
                <p className="text-center text-muted-foreground py-16">Ajoutez et sélectionnez une image pour la recadrer</p>
              )}
            </motion.div>
          )}

          {tab === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto">
              {selectedImage ? (
                <QualityComparator file={selectedImage.file} />
              ) : (
                <p className="text-center text-muted-foreground py-16">Ajoutez et sélectionnez une image pour comparer</p>
              )}
            </motion.div>
          )}

          {tab === 'pipeline' && (
            <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
              {selectedImage ? (
                <PipelineEditor
                  file={selectedImage.file}
                  onPipelineComplete={(blob, result) => {
                    if (!selectedImage) return;
                    setResults(prev => new Map(prev).set(selectedImage.id, result));
                    setImages(prev => prev.map(i => i.id === selectedImage.id ? { ...i, edited: true } : i));
                  }}
                />
              ) : (
                <p className="text-center text-muted-foreground py-16">Ajoutez et sélectionnez une image pour le pipeline</p>
              )}
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
