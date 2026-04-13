import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Menu, X } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'editor', label: 'Éditeur' },
  { id: 'crop', label: 'Recadrage' },
  { id: 'compare', label: 'Comparateur' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'history', label: 'Historique' },
];

export default function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleTab = (id: string) => {
    onTabChange(id);
    setMobileOpen(false);
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glass-subtle"
    >
      <div className="container flex items-center h-14 sm:h-16 px-3 sm:px-6 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          <span className="font-heading font-bold text-base sm:text-lg text-foreground hidden sm:inline">
            Pixel<span className="text-gradient">Forge</span>
          </span>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:flex items-center gap-1 ml-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={`relative px-3 lg:px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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

        {/* Mobile: horizontal scroll tabs */}
        <div className="flex md:hidden items-center gap-0.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={`relative px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
