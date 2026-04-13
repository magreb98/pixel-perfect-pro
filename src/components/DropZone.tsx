import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp', 'image/tiff'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function DropZone({ onFileSelect, disabled }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const validate = (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setError('Format non supporté. Utilisez JPEG, PNG, WebP ou AVIF.');
      return false;
    }
    if (file.size > MAX_SIZE) {
      setError('Fichier trop volumineux (max 50 MB).');
      return false;
    }
    setError('');
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file && validate(file)) onFileSelect(file);
  }, [onFileSelect, disabled]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validate(file)) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-4 p-12 rounded-2xl cursor-pointer
          transition-all duration-300 glass
          ${dragOver ? 'glow-primary border-primary' : 'hover:border-primary/40'}
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={handleInput}
          className="hidden"
          disabled={disabled}
        />
        <AnimatePresence mode="wait">
          {dragOver ? (
            <motion.div key="drop" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
              <ImageIcon className="w-12 h-12 text-primary animate-pulse-glow" />
              <span className="text-primary font-heading font-semibold text-lg">Déposez ici</span>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-heading font-semibold text-foreground">Glissez votre image ici</p>
                <p className="text-sm text-muted-foreground mt-1">ou cliquez pour parcourir · JPEG, PNG, WebP, AVIF · Max 50 MB</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </label>
      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-destructive text-sm mt-2 text-center">
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
