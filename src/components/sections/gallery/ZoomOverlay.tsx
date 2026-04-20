import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";

interface ZoomOverlayProps {
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const ZoomOverlay = ({ images, index, onClose, onPrev, onNext }: ZoomOverlayProps) => {
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 50 || images.length <= 1) return;
    if (deltaX < 0) onNext();
    else onPrev();
  };

  return (
    <div
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 md:p-12 cursor-zoom-out animate-fade-in"
      role="dialog"
      aria-label="Imagem ampliada"
    >
      <img
        src={getOptimizedImageUrl(images[index], { width: 1600, quality: 85, resize: "contain" })}
        alt={`Visualização ampliada ${index + 1} de ${images.length}`}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain shadow-2xl border border-primary/20 select-none"
        draggable={false}
      />

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] font-accent text-xs tracking-[0.15em] uppercase text-foreground/70 bg-background/40 backdrop-blur-sm px-3 py-1.5 border border-border/40">
          {index + 1} / {images.length}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Fechar visualização"
        className="absolute top-4 right-4 md:top-6 md:right-6 z-[110] min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 font-accent text-xs tracking-[0.15em] uppercase text-foreground/80 hover:text-primary-glow transition-colors px-4 py-2 border border-border/40 hover:border-primary-glow/60 bg-background/60 backdrop-blur-sm"
      >
        <span className="hidden sm:inline">Fechar</span>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
