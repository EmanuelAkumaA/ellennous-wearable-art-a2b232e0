import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Pause } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { OptimizedVariant } from "@/lib/imageSnippet";
import type { PieceImageData } from "./useGalleryData";

interface PieceCarouselProps {
  images: string[];
  alt: string;
  onZoom?: (images: string[], index: number) => void;
  imagesData?: PieceImageData[];
}

const AUTOPLAY_DELAY = 4000;
const PAUSE_AFTER_INTERACTION = 5000;
const SIZES = "(max-width:768px) 100vw, 50vw";

const buildSrcset = (variants: OptimizedVariant[], format: OptimizedVariant["format"]) =>
  variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");

interface SmartImageProps {
  src: string;
  variants: OptimizedVariant[] | null;
  alt: string;
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low" | "auto";
  onClick?: () => void;
  className: string;
}

const SmartImage = ({ src, variants, alt, loading, fetchPriority, onClick, className }: SmartImageProps) => {
  if (!variants || variants.length === 0) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onClick={onClick}
        className={className}
      />
    );
  }
  const avifSet = buildSrcset(variants, "avif");
  const webpSet = buildSrcset(variants, "webp");
  const jpegVariants = variants.filter((v) => v.format === "jpeg").sort((a, b) => a.width - b.width);
  const jpegSet = jpegVariants.map((v) => `${v.url} ${v.width}w`).join(", ");
  const fallback = jpegVariants.find((v) => v.width === 800) ?? jpegVariants[Math.floor(jpegVariants.length / 2)] ?? jpegVariants[0];

  return (
    <picture>
      {avifSet && <source type="image/avif" srcSet={avifSet} sizes={SIZES} />}
      {webpSet && <source type="image/webp" srcSet={webpSet} sizes={SIZES} />}
      <img
        src={fallback?.url ?? src}
        srcSet={jpegSet || undefined}
        sizes={SIZES}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onClick={onClick}
        className={className}
      />
    </picture>
  );
};

export const PieceCarousel = ({ images, alt, onZoom, imagesData }: PieceCarouselProps) => {
  const isMobile = useIsMobile();
  const autoplay = useRef(
    Autoplay({ delay: AUTOPLAY_DELAY, stopOnInteraction: false, stopOnMouseEnter: true, playOnInit: true })
  );
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pauseTimeoutRef = useRef<number | null>(null);

  // Build a per-index variants lookup; falls back to null when not optimized.
  const variantsAt = useMemo(() => {
    if (!imagesData) return new Map<number, OptimizedVariant[] | null>();
    const m = new Map<number, OptimizedVariant[] | null>();
    imagesData.forEach((d, i) => m.set(i, d.variants));
    return m;
  }, [imagesData]);

  const pauseAutoplay = useCallback(() => {
    const ap = autoplay.current as unknown as { stop?: () => void; play?: () => void };
    ap.stop?.();
    setProgress(0);
    setIsPaused(true);
    if (pauseTimeoutRef.current != null) {
      window.clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = window.setTimeout(() => {
      setProgress(0);
      setIsPaused(false);
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
    const onPointerDown = () => {
      setIsDragging(true);
      pauseAutoplay();
    };
    const onSettle = () => setIsDragging(false);

    update();
    api.on("select", update);
    api.on("reInit", update);
    api.on("pointerDown", onPointerDown);
    api.on("settle", onSettle);

    const startTimer = window.setTimeout(() => {
      api.reInit();
      autoplay.current?.reset?.();
      autoplay.current?.play?.();
    }, 100);

    return () => {
      window.clearTimeout(startTimer);
      api.off("select", update);
      api.off("reInit", update);
      api.off("pointerDown", onPointerDown);
      api.off("settle", onSettle);
    };
  }, [api, pauseAutoplay]);

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current != null) {
        window.clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!api || images.length <= 1 || isDragging || isPaused) return;

    const ap = autoplay.current as unknown as {
      isPlaying?: () => boolean;
      timeUntilNext?: () => number | null;
    };

    let raf = 0;
    let intervalId: number | null = null;
    let stopped = false;

    const computeProgress = () => {
      const playing = ap.isPlaying?.() ?? false;
      const remaining = ap.timeUntilNext?.();
      if (playing && typeof remaining === "number" && remaining >= 0) {
        const pct = Math.max(0, Math.min(100, 100 - (remaining / AUTOPLAY_DELAY) * 100));
        setProgress(pct);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        if (intervalId != null) window.clearInterval(intervalId);
        stopped = true;
      }
    };

    if (isMobile) {
      intervalId = window.setInterval(computeProgress, 50);
    } else {
      const tick = () => {
        if (stopped) return;
        computeProgress();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (intervalId != null) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [api, images.length, isMobile, isDragging, isPaused]);

  const canZoom = !isMobile;
  const cursorClass = canZoom ? "cursor-zoom-in" : "cursor-default";
  const handleImageClick = (i: number) => {
    if (!canZoom) return;
    onZoom?.(images, i);
  };

  if (images.length <= 1) {
    return (
      <SmartImage
        src={images[0]}
        variants={variantsAt.get(0) ?? null}
        alt={alt}
        loading="lazy"
        fetchPriority="high"
        onClick={() => handleImageClick(0)}
        className={`w-full h-full object-cover ${cursorClass}`}
      />
    );
  }

  const handleDotClick = (i: number) => {
    pauseAutoplay();
    api?.scrollTo(i);
  };

  const isAdjacent = (i: number) => {
    if (i === selectedIndex) return true;
    const total = images.length;
    const prev = (selectedIndex - 1 + total) % total;
    const next = (selectedIndex + 1) % total;
    return i === prev || i === next;
  };

  return (
    <Carousel
      opts={{
        align: "start",
        loop: true,
        dragFree: false,
        containScroll: "trimSnaps",
        duration: 20,
        skipSnaps: false,
        watchDrag: true,
      }}
      plugins={[autoplay.current]}
      setApi={setApi}
      className="w-full h-full"
      style={{ contain: "layout paint" }}
    >
      <CarouselContent
        className="h-full"
        style={{ willChange: isDragging ? "transform" : "auto" }}
      >
        {images.map((src, i) => {
          const active = i === selectedIndex;
          const adjacent = isAdjacent(i);
          return (
            <CarouselItem key={i} className="h-full">
              <SmartImage
                src={src}
                variants={variantsAt.get(i) ?? null}
                alt={`${alt} — imagem ${i + 1}`}
                loading={adjacent ? "eager" : "lazy"}
                fetchPriority={active ? "high" : "low"}
                onClick={() => handleImageClick(i)}
                className={`w-full h-full object-cover aspect-square md:aspect-auto ${cursorClass}`}
              />
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious
        onClick={pauseAutoplay}
        className="left-3 h-9 w-9 bg-background/70 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow"
      />
      <CarouselNext
        onClick={pauseAutoplay}
        className="right-3 h-9 w-9 bg-background/70 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow"
      />

      <div
        className={`absolute top-2 right-2 z-20 flex items-center justify-center h-7 w-7 rounded-full bg-background/60 backdrop-blur-sm border border-primary/30 transition-opacity duration-300 ${
          isPaused ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isPaused}
      >
        <Pause className="h-3 w-3 text-primary-glow" fill="currentColor" />
      </div>

      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-10">
        <div
          className="h-full bg-primary-glow transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

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
