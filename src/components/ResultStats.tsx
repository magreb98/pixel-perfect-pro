import { motion } from 'framer-motion';
import { ArrowDown, Image as ImageIcon, FileType } from 'lucide-react';
import { formatBytes } from '@/lib/image-processing';
import type { ProcessingResult } from '@/lib/image-processing';

export default function ResultStats({ result }: { result: ProcessingResult }) {
  const stats = [
    { label: 'Original', value: formatBytes(result.originalSize), icon: <ImageIcon className="w-4 h-4" /> },
    { label: 'Traité', value: formatBytes(result.processedSize), icon: <FileType className="w-4 h-4" /> },
    { label: 'Réduction', value: `${result.savings}%`, icon: <ArrowDown className="w-4 h-4" /> },
    { label: 'Dimensions', value: `${result.width}×${result.height}`, icon: <ImageIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="glass rounded-xl p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            {s.icon}
            <span className="text-xs">{s.label}</span>
          </div>
          <p className="font-heading font-bold text-foreground">{s.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
