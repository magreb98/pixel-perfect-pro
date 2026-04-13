import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glass-subtle"
    >
      <div className="container flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <span className="font-heading font-bold text-lg text-foreground">
            Pixel<span className="text-gradient">Forge</span>
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Compression</span>
          <span className="hidden sm:inline">Resize</span>
          <span className="hidden sm:inline">Upscale</span>
        </div>
      </div>
    </motion.nav>
  );
}
