import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Clock, Scissors, Zap, Maximize, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHistory, clearHistory, formatBytes, type HistoryEntry } from '@/lib/image-processing';

const modeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  compress: { label: 'Compression', icon: <Zap className="w-3 h-3" /> },
  resize: { label: 'Resize', icon: <Maximize className="w-3 h-3" /> },
  upscale: { label: 'Upscale', icon: <Sparkles className="w-3 h-3" /> },
  'remove-bg': { label: 'Fond supprimé', icon: <Scissors className="w-3 h-3" /> },
};

export default function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  const handleClear = () => {
    clearHistory();
    setEntries([]);
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Clock className="w-10 h-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">Aucun traitement dans l'historique</p>
        <p className="text-xs text-muted-foreground/70">Vos traitements apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{entries.length} traitement(s)</p>
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> Effacer
        </Button>
      </div>

      <AnimatePresence>
        {entries.map((entry, i) => {
          const modeInfo = modeLabels[entry.mode] || modeLabels.compress;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 glass rounded-xl px-4 py-3"
            >
              {entry.thumbnail && (
                <img src={entry.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover bg-secondary" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{entry.filename}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1 text-primary">
                    {modeInfo.icon} {modeInfo.label}
                  </span>
                  <span>·</span>
                  <span>{formatBytes(entry.originalSize)} → {formatBytes(entry.processedSize)}</span>
                  {entry.savings > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-primary">-{entry.savings}%</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground/60 shrink-0">
                {new Date(entry.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
