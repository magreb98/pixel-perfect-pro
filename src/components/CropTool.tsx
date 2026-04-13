import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Download, RotateCcw, Lock, Unlock, Move } from 'lucide-react';
import { formatBytes } from '@/lib/image-processing';

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type AspectPreset = { label: string; ratio: number | null };

const PRESETS: AspectPreset[] = [
  { label: 'Libre', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '3:4', ratio: 3 / 4 },
];

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface CropToolProps {
  file: File;
  onCropped?: (blob: Blob) => void;
}

export default function CropTool({ file, onCropped }: CropToolProps) {
  const [imgUrl, setImgUrl] = useState('');
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [displayDims, setDisplayDims] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [preset, setPreset] = useState<AspectPreset>(PRESETS[0]);
  const [dragging, setDragging] = useState<'move' | Handle | null>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, crop: { x: 0, y: 0, w: 0, h: 0 } });
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [croppedSize, setCroppedSize] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset when file changes
  useEffect(() => {
    setCroppedUrl(null);
    setCrop({ x: 0, y: 0, w: 0, h: 0 });
    setPreset(PRESETS[0]);
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    setImgDims({ w: natW, h: natH });
    setDisplayDims({ w: img.clientWidth, h: img.clientHeight });
    const cw = natW * 0.8;
    const ch = natH * 0.8;
    setCrop({ x: (natW - cw) / 2, y: (natH - ch) / 2, w: cw, h: ch });
    setCroppedUrl(null);
  }, []);

  useEffect(() => {
    const update = () => {
      if (imgRef.current) {
        setDisplayDims({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const scaleX = imgDims.w > 0 ? displayDims.w / imgDims.w : 1;
  const scaleY = imgDims.h > 0 ? displayDims.h / imgDims.h : 1;

  const displayCrop = {
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    w: crop.w * scaleX,
    h: crop.h * scaleY,
  };

  const constrainCrop = useCallback((c: CropRect, ratio: number | null): CropRect => {
    let { x, y, w, h } = c;
    w = clamp(w, 20, imgDims.w);
    h = clamp(h, 20, imgDims.h);
    if (ratio !== null) {
      h = w / ratio;
      if (h > imgDims.h) {
        h = imgDims.h;
        w = h * ratio;
      }
    }
    x = clamp(x, 0, imgDims.w - w);
    y = clamp(y, 0, imgDims.h - h);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }, [imgDims]);

  const applyPreset = useCallback((p: AspectPreset) => {
    setPreset(p);
    if (p.ratio !== null) {
      setCrop(prev => constrainCrop(prev, p.ratio));
    }
  }, [constrainCrop]);

  const getMousePos = (e: React.MouseEvent | MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | Handle) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getMousePos(e);
    setDragging(type);
    setDragStart({ mx: pos.x, my: pos.y, crop: { ...crop } });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const pos = getMousePos(e);
      const dx = (pos.x - dragStart.mx) / scaleX;
      const dy = (pos.y - dragStart.my) / scaleY;
      const sc = dragStart.crop;
      let newCrop: CropRect;
      if (dragging === 'move') {
        newCrop = { ...sc, x: sc.x + dx, y: sc.y + dy };
      } else {
        let nx = sc.x, ny = sc.y, nw = sc.w, nh = sc.h;
        if (dragging.includes('w')) { nx = sc.x + dx; nw = sc.w - dx; }
        if (dragging.includes('e')) { nw = sc.w + dx; }
        if (dragging.includes('n')) { ny = sc.y + dy; nh = sc.h - dy; }
        if (dragging.includes('s')) { nh = sc.h + dy; }
        if (nw < 20) { nw = 20; if (dragging.includes('w')) nx = sc.x + sc.w - 20; }
        if (nh < 20) { nh = 20; if (dragging.includes('n')) ny = sc.y + sc.h - 20; }
        newCrop = { x: nx, y: ny, w: nw, h: nh };
      }
      setCrop(constrainCrop(newCrop, preset.ratio));
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dragStart, scaleX, scaleY, constrainCrop, preset.ratio]);

  const handleCrop = useCallback(async () => {
    if (!file) return;
    const img = new Image();
    img.src = imgUrl;
    await new Promise(r => { img.onload = r; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(crop.w);
    canvas.height = Math.round(crop.h);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(), 'image/png');
    });
    setCroppedUrl(URL.createObjectURL(blob));
    setCroppedSize(blob.size);
    onCropped?.(blob);
  }, [file, imgUrl, crop, onCropped]);

  const handleDownload = () => {
    if (!croppedUrl) return;
    const a = document.createElement('a');
    a.href = croppedUrl;
    a.download = `pixelforge-crop.png`;
    a.click();
  };

  const handleStyles: Record<Handle, React.CSSProperties> = {
    nw: { top: -5, left: -5, cursor: 'nwse-resize' },
    ne: { top: -5, right: -5, cursor: 'nesw-resize' },
    sw: { bottom: -5, left: -5, cursor: 'nesw-resize' },
    se: { bottom: -5, right: -5, cursor: 'nwse-resize' },
    n: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    s: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    w: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    e: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground font-heading truncate max-w-[200px]">{file.name}</div>
        <div className="flex items-center gap-2">
          {croppedUrl && (
            <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Télécharger
            </Button>
          )}
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              preset.label === p.label
                ? 'bg-primary/15 border border-primary/40 text-primary'
                : 'bg-secondary/50 border border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.ratio !== null ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {p.label}
          </button>
        ))}
      </div>

      {/* Crop canvas */}
      <div className="glass rounded-xl overflow-hidden p-2">
        <div ref={containerRef} className="relative select-none mx-auto" style={{ maxWidth: '100%' }}>
          <img
            ref={imgRef}
            src={imgUrl}
            alt="Source"
            onLoad={handleImgLoad}
            className="w-full h-auto block max-h-[60vh] object-contain mx-auto"
            draggable={false}
          />
          {displayDims.w > 0 && (
            <>
              <div className="absolute bg-black/50 pointer-events-none" style={{ top: 0, left: 0, width: displayDims.w, height: displayCrop.y }} />
              <div className="absolute bg-black/50 pointer-events-none" style={{ top: displayCrop.y + displayCrop.h, left: 0, width: displayDims.w, height: displayDims.h - displayCrop.y - displayCrop.h }} />
              <div className="absolute bg-black/50 pointer-events-none" style={{ top: displayCrop.y, left: 0, width: displayCrop.x, height: displayCrop.h }} />
              <div className="absolute bg-black/50 pointer-events-none" style={{ top: displayCrop.y, left: displayCrop.x + displayCrop.w, width: displayDims.w - displayCrop.x - displayCrop.w, height: displayCrop.h }} />
              <div
                className="absolute border-2 border-primary cursor-move"
                style={{ top: displayCrop.y, left: displayCrop.x, width: displayCrop.w, height: displayCrop.h }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-primary/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-primary/30" />
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-primary/30" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-primary/30" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                  <Move className="w-5 h-5 text-primary" />
                </div>
                {(Object.keys(handleStyles) as Handle[]).map((h) => (
                  <div
                    key={h}
                    className="absolute w-3 h-3 rounded-sm bg-primary border border-primary-foreground shadow-sm"
                    style={{ ...handleStyles[h], position: 'absolute' }}
                    onMouseDown={(e) => handleMouseDown(e, h)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-muted-foreground space-x-3">
          <span>Sélection : {Math.round(crop.w)} × {Math.round(crop.h)} px</span>
          <span>Original : {imgDims.w} × {imgDims.h} px</span>
          {croppedUrl && <span>Taille : {formatBytes(croppedSize)}</span>}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCrop(constrainCrop({ x: 0, y: 0, w: imgDims.w, h: imgDims.h }, preset.ratio));
              setCroppedUrl(null);
            }}
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
          </Button>
          <Button size="sm" onClick={handleCrop} className="gap-1.5">
            Recadrer
          </Button>
        </div>
      </div>

      {croppedUrl && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl overflow-hidden"
        >
          <div className="p-3 border-b border-border">
            <h4 className="text-sm font-heading font-semibold text-foreground">Résultat</h4>
          </div>
          <div className="p-4 flex items-center justify-center bg-secondary/20">
            <img src={croppedUrl} alt="Recadré" className="max-w-full max-h-[40vh] object-contain rounded" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
