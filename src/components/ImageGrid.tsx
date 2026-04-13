import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, Image as ImageIcon } from 'lucide-react';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  edited?: boolean;
}

interface ImageGridProps {
  images: ImageItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp', 'image/tiff'];

export type { ImageItem };

export default function ImageGrid({ images, selectedId, onSelect, onAdd, onRemove }: ImageGridProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const valid = Array.from(fileList).filter(f => ACCEPTED.includes(f.type) && f.size <= 50 * 1024 * 1024);
    if (valid.length) onAdd(valid);
  }, [onAdd]);

  return (
    <div className="space-y-3">
      {/* Grid of uploaded images */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <AnimatePresence>
            {images.map((img) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => onSelect(img.id)}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
                  selectedId === img.id
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-muted-foreground/30'
                }`}
              >
                <img src={img.url} alt={img.file.name} className="w-full h-full object-cover" />
                {img.edited && (
                  <div className="absolute top-1 right-1">
                    <CheckCircle className="w-3.5 h-3.5 text-primary drop-shadow" />
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
                  className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-full p-0.5"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
                {selectedId === img.id && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-primary" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add more button */}
          <label
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              multiple
              accept={ACCEPTED.join(',')}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
            <Upload className="w-5 h-5 text-muted-foreground" />
          </label>
        </div>
      )}

      {/* Empty state / initial drop zone */}
      {images.length === 0 && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`flex flex-col items-center justify-center gap-4 p-12 rounded-2xl cursor-pointer transition-all glass ${
            dragOver ? 'glow-primary border-primary' : 'hover:border-primary/40'
          }`}
        >
          <input
            type="file"
            multiple
            accept={ACCEPTED.join(',')}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
          <ImageIcon className="w-10 h-10 text-muted-foreground" />
          <div className="text-center">
            <p className="font-heading font-semibold text-foreground">Glissez vos images ici</p>
            <p className="text-sm text-muted-foreground mt-1">ou cliquez pour parcourir · Plusieurs fichiers acceptés · Max 50 MB</p>
          </div>
        </label>
      )}
    </div>
  );
}
