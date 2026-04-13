import { useState, useRef, useCallback } from 'react';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function BeforeAfterSlider({ beforeSrc, afterSrc, beforeLabel = 'Original', afterLabel = 'Traité' }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const onPointerDown = () => { dragging.current = true; };
  const onPointerUp = () => { dragging.current = false; };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) updatePosition(e.clientX);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-xl overflow-hidden cursor-col-resize glass select-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerMove={onPointerMove}
      onClick={(e) => updatePosition(e.clientX)}
    >
      {/* After (full) */}
      <img src={afterSrc} alt={afterLabel} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
      {/* Before (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={beforeSrc} alt={beforeLabel} className="absolute inset-0 w-full h-full object-contain" style={{ minWidth: containerRef.current?.offsetWidth }} draggable={false} />
      </div>
      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-primary glow-primary" style={{ left: `${position}%` }}>
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 7H10M4 7L6 5M4 7L6 9M10 7L8 5M10 7L8 9" stroke="hsl(var(--primary-foreground))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      {/* Labels */}
      <span className="absolute top-3 left-3 text-xs font-heading font-semibold bg-background/70 backdrop-blur px-2 py-1 rounded">{beforeLabel}</span>
      <span className="absolute top-3 right-3 text-xs font-heading font-semibold bg-primary/20 backdrop-blur px-2 py-1 rounded text-primary">{afterLabel}</span>
    </div>
  );
}
