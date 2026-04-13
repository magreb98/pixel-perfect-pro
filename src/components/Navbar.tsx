import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'editor', label: 'Éditeur' },
  { id: 'compare', label: 'Comparateur' },
  { id: 'batch', label: 'Batch' },
  { id: 'history', label: 'Historique' },
];

export default function Navbar({ activeTab, onTabChange }: NavbarProps) {
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
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
