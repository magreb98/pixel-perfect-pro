import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Eye, Palette, Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import type { ImageAnalysis } from '@/lib/image-analysis';
import { analyzeImage } from '@/lib/image-analysis';

interface Props {
  file: File | null;
}

function MiniHistogram({ data, color, label }: { data: number[]; color: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(...data);
    if (max === 0) return;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    const barW = w / 256;
    for (let i = 0; i < 256; i++) {
      const barH = (data[i] / max) * h;
      ctx.fillRect(i * barW, h - barH, Math.max(barW, 1), barH);
    }
    ctx.globalAlpha = 1;
  }, [data, color]);

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <canvas ref={canvasRef} width={256} height={48} className="w-full h-8 rounded bg-secondary/30" />
    </div>
  );
}

function MetricBar({ label, value, icon, suffix = '%' }: { label: string; value: number; icon: React.ReactNode; suffix?: string }) {
  const color = value > 70 ? 'bg-primary' : value > 40 ? 'bg-accent' : 'bg-destructive';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
        <span className="font-semibold text-foreground">{value}{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function ImageAnalysisPanel({ file }: Props) {
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!file) { setAnalysis(null); return; }
    setLoading(true);
    analyzeImage(file)
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false));
  }, [file]);

  if (!file) return null;

  if (loading) {
    return (
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Analyse de l'image…</span>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold font-heading text-foreground">Analyse avancée</h4>
            <p className="text-[11px] text-muted-foreground">
              Score : <span className="text-primary font-semibold">{analysis.qualityScore}/100</span>
              {' · '}{analysis.dimensions.width}×{analysis.dimensions.height}
              {' · '}{analysis.megapixels} MP
              {' · '}{analysis.aspectRatio}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-5">
              {/* Quality metrics */}
              <div className="space-y-3">
                <MetricBar label="Netteté" value={analysis.sharpness} icon={<Eye className="w-3 h-3" />} />
                <MetricBar label="Contraste" value={analysis.contrast} icon={<Gauge className="w-3 h-3" />} />
                <MetricBar label="Plage dynamique" value={analysis.dynamicRange} icon={<Activity className="w-3 h-3" />} />
                <MetricBar label="Saturation" value={analysis.saturation} icon={<Palette className="w-3 h-3" />} />
                <MetricBar label="Bruit (inv.)" value={Math.max(0, 100 - analysis.noise)} icon={<Activity className="w-3 h-3" />} />
              </div>

              {/* Histograms */}
              <div className="space-y-2">
                <h5 className="text-xs font-heading font-semibold text-foreground">Histogrammes</h5>
                <div className="grid grid-cols-2 gap-2">
                  <MiniHistogram data={analysis.histogram.luminance} color="hsl(210, 20%, 70%)" label="Luminance" />
                  <MiniHistogram data={analysis.histogram.r} color="hsl(0, 70%, 55%)" label="Rouge" />
                  <MiniHistogram data={analysis.histogram.g} color="hsl(140, 60%, 45%)" label="Vert" />
                  <MiniHistogram data={analysis.histogram.b} color="hsl(220, 70%, 55%)" label="Bleu" />
                </div>
              </div>

              {/* Dominant colors */}
              <div className="space-y-2">
                <h5 className="text-xs font-heading font-semibold text-foreground">Couleurs dominantes</h5>
                <div className="flex gap-2">
                  {analysis.dominantColors.map((c, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className="w-8 h-8 rounded-lg border border-border"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-[9px] text-muted-foreground">{c.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h5 className="text-xs font-heading font-semibold text-foreground">Recommandations</h5>
                <div className="space-y-1.5">
                  {analysis.recommendations.map((rec, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground leading-relaxed flex gap-2">
                      <span className="text-primary mt-0.5 shrink-0">›</span>
                      {rec}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
