import { useCallback, useEffect, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface PieceCarouselProps {
  images: string[];
  alt: string;
  onZoom?: (images: string[], index: number) => void;
}

const AUTOPLAY_DELAY = 4000;
const PAUSE_AFTER_INTERACTION = 5000;

export const PieceCarousel = ({ images, alt, onZoom }: PieceCarouselProps) => {
  const isMobile = useIsMobile();
  const autoplay = useRef(
    Autoplay({ delay: AUTOPLAY_DELAY, stopOnInteraction: false, stopOnMouseEnter: true, playOnInit: true })
  );
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const pauseTimeoutRef = useRef<number | null>(null);

  const pauseAutoplay = useCallback(() => {
    const ap = autoplay.current as unknown as { stop?: () => void; play?: () => void };
    ap.stop?.();
    setProgress(0);
    if (pauseTimeoutRef.current != null) {
      window.clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = window.setTimeout(() => {
      setProgress(0);
      ap.play?.();
      pauseTimeoutRef.current = null;
    }, PAUSE_AFTER_INTERACTION);
  }, []);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSelectedIndex(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
      setProgress(0);
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    api.on("pointerDown", pauseAutoplay);

    const startTimer = window.setTimeout(() => {
      api.reInit();
      autoplay.current?.reset?.();
      autoplay.current?.play?.();
    }, 100);

    return () => {
      window.clearTimeout(startTimer);
      api.off("select", update);
      api.off("reInit", update);
      api.off("pointerDown", pauseAutoplay);
    };
  }, [api, pauseAutoplay]);

  // Cleanup pause timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current != null) {
        window.clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  // Animate progress bar in sync with autoplay
  useEffect(() => {
    if (!api || images.length <= 1) return;
    let raf = 0;
    const tick = () => {
      const ap = autoplay.current as unknown as {
        isPlaying?: () => boolean;
        timeUntilNext?: () => number | null;
      };
      const playing = ap.isPlaying?.() ?? false;
      const remaining = ap.timeUntilNext?.();
      if (playing && typeof remaining === "number" && remaining >= 0) {
        const pct = Math.max(0, Math.min(100, 100 - (remaining / AUTOPLAY_DELAY) * 100));
        setProgress(pct);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [api, images.length]);

  const canZoom = !isMobile;
  const cursorClass = canZoom ? "cursor-zoom-in" : "cursor-default";
  const handleImageClick = (i: number) => {
    if (!canZoom) return;
    onZoom?.(images, i);
  };

  if (images.length <= 1) {
    return (
      <img
        src={images[0]}
        alt={alt}
        loading="lazy"
        onClick={() => handleImageClick(0)}
        className={`w-full h-full object-cover ${cursorClass}`}
      />
    );
  }

  const handleDotClick = (i: number) => {
    pauseAutoplay();
    api?.scrollTo(i);
  };

  return (
    <Carousel
      opts={{ align: "start", loop: true }}
      plugins={[autoplay.current]}
      setApi={setApi}
      className="w-full h-full"
    >
      <CarouselContent className="h-full">
        {images.map((src, i) => (
          <CarouselItem key={i} className="h-full">
            <img
              src={src}
              alt={`${alt} — imagem ${i + 1}`}
              loading="lazy"
              onClick={() => handleImageClick(i)}
              className={`w-full h-full object-cover aspect-square md:aspect-auto ${cursorClass}`}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious
        onClick={pauseAutoplay}
        className="left-3 h-9 w-9 bg-background/70 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow"
      />
      <CarouselNext
        onClick={pauseAutoplay}
        className="right-3 h-9 w-9 bg-background/70 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow"
      />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-10">
        <div
          className="h-full bg-primary-glow transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
        {Array.from({ length: snapCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => handleDotClick(i)}
            aria-label={`Ir para imagem ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === selectedIndex
                ? "w-6 bg-primary-glow"
                : "w-1.5 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </Carousel>
  );
};
