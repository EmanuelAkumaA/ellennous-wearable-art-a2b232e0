import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, Check, X, Loader2 } from "lucide-react";

const PALETTE_PATH =
  "M 50 4 C 78 4 96 22 96 48 C 96 70 82 86 64 92 C 56 95 50 95 44 92 C 38 89 34 83 32 76 C 30 69 24 66 18 68 C 10 70 4 64 4 56 C 4 30 22 4 50 4 Z";
const THUMB_HOLE = { cx: 26, cy: 60, r: 5 };

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onApply: (blob: Blob) => Promise<void> | void;
}

const CANVAS_SIZE = 400;

export const AvatarCropDialog = ({ open, imageSrc, onCancel, onApply }: AvatarCropDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [imgReady, setImgReady] = useState(false);
  const [applying, setApplying] = useState(false);

  // Load image when src changes
  useEffect(() => {
    if (!imageSrc) {
      imgRef.current = null;
      setImgReady(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
      // Initial fit: cover the canvas
      const scale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
      const baseW = img.width * scale;
      const baseH = img.height * scale;
      setZoom(1);
      setOffset({ x: (CANVAS_SIZE - baseW) / 2, y: (CANVAS_SIZE - baseH) / 2 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const baseScale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const w = img.width * baseScale * zoom;
    const h = img.height * baseScale * zoom;
    ctx.drawImage(img, offset.x, offset.y, w, h);
  }, [zoom, offset, imgReady]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleApply = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setApplying(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("Falha ao gerar imagem");
      await onApply(blob);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !applying && onCancel()}>
      <DialogContent className="bg-card/95 border-border/40 backdrop-blur-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-gradient-light">Ajustar foto</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Arraste para reposicionar e use o zoom. A foto será recortada na forma da paleta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 pt-2">
          {/* Crop area */}
          <div
            className="relative select-none touch-none"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, maxWidth: "100%" }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className={`absolute inset-0 w-full h-full bg-secondary/40 cursor-${dragging ? "grabbing" : "grab"}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {/* Mask overlay — palette shape */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              <defs>
                <mask id="palette-crop-mask">
                  <rect width="100" height="100" fill="white" />
                  <path d={PALETTE_PATH} fill="black" />
                  <circle cx={THUMB_HOLE.cx} cy={THUMB_HOLE.cy} r={THUMB_HOLE.r} fill="white" />
                </mask>
              </defs>
              {/* Dark veil outside palette */}
              <rect width="100" height="100" fill="hsl(240 20% 4% / 0.78)" mask="url(#palette-crop-mask)" />
              {/* Palette outline */}
              <path
                d={PALETTE_PATH}
                fill="none"
                stroke="hsl(274 90% 65%)"
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={THUMB_HOLE.cx}
                cy={THUMB_HOLE.cy}
                r={THUMB_HOLE.r}
                fill="none"
                stroke="hsl(274 90% 65%)"
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {!imgReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary-glow" />
              </div>
            )}
          </div>

          {/* Zoom control */}
          <div className="w-full flex items-center gap-3 px-1">
            <ZoomIn className="h-4 w-4 text-primary-glow shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
            <span className="font-accent text-[10px] tracking-[0.2em] text-muted-foreground w-10 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Actions */}
          <div className="flex w-full gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={applying}
              className="flex-1 rounded-none font-accent tracking-[0.2em] uppercase text-[11px]"
            >
              <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={applying || !imgReady}
              className="flex-1 rounded-none font-accent tracking-[0.2em] uppercase text-[11px] bg-gradient-purple-wine hover:opacity-90 shadow-glow"
            >
              {applying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
