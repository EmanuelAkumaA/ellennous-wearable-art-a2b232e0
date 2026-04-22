import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/use-reveal";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildWhatsAppLink } from "@/components/FloatingWhatsApp";
import { Dragon } from "@/components/Dragon";
import { PieceCarousel } from "./PieceCarousel";
import { ResponsivePicture } from "@/components/ui/responsive-picture";
import { ZoomOverlay } from "./ZoomOverlay";
import { useGalleryData, type PieceData } from "./useGalleryData";
import { trackPieceEvent } from "@/lib/analytics";
import { useDominantColor } from "@/hooks/use-dominant-color";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const MOBILE_STEP = 5;
const DESKTOP_STEP = 6;

const SECTION_STORAGE_PREFIX = "ellennous:gallery:lastSection:";
type SectionKey = "descricao" | "conceito" | "historia" | "tempo";
const SECTION_ORDER: SectionKey[] = ["descricao", "conceito", "historia", "tempo"];

const getStoredSection = (pieceId: string): string | null => {
  try {
    return localStorage.getItem(SECTION_STORAGE_PREFIX + pieceId);
  } catch {
    return null;
  }
};

const setStoredSection = (pieceId: string, value: string) => {
  try {
    localStorage.setItem(SECTION_STORAGE_PREFIX + pieceId, value);
  } catch {
    /* ignore */
  }
};

const pickFirstAvailable = (piece: PieceData): SectionKey | undefined => {
  for (const key of SECTION_ORDER) {
    if (piece[key]) return key;
  }
  return undefined;
};

const rankPiece = (p: PieceData) => (p.novo ? 0 : p.destaque ? 1 : 2);

export const Gallery = () => {
  const { categories: dbCategories, pieces: PIECES, loading } = useGalleryData();
  const CATEGORIES = ["Todas", ...dbCategories];
  const isMobile = useIsMobile();
  const step = isMobile ? MOBILE_STEP : DESKTOP_STEP;
  const [filter, setFilter] = useState<string>("Todas");
  const [selected, setSelected] = useState<PieceData | null>(null);
  const [zoomedImages, setZoomedImages] = useState<string[] | null>(null);
  const [zoomedIndex, setZoomedIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(step);
  const [openSection, setOpenSection] = useState<string | undefined>(undefined);
  const ref = useReveal();
  const lastInitialItemRef = useRef<HTMLButtonElement | null>(null);
  const previousCountRef = useRef(step);
  const animateFromRef = useRef(0);
  const modalOpenedAtRef = useRef<number | null>(null);
  const trackedPieceRef = useRef<string | null>(null);

  const handleSelectPiece = (piece: PieceData) => {
    setSelected(piece);
    modalOpenedAtRef.current = Date.now();
    trackedPieceRef.current = piece.id;
    void trackPieceEvent(piece.id, "modal_open");
  };

  const handleModalChange = (open: boolean) => {
    if (!open) {
      const pid = trackedPieceRef.current;
      const openedAt = modalOpenedAtRef.current;
      if (pid && openedAt) {
        void trackPieceEvent(pid, "modal_close", Date.now() - openedAt);
      }
      modalOpenedAtRef.current = null;
      trackedPieceRef.current = null;
      setSelected(null);
    }
  };

  const handleCtaClick = () => {
    if (selected) void trackPieceEvent(selected.id, "cta_click");
  };

  const filtered = filter === "Todas" ? PIECES : PIECES.filter((p) => p.categoria === filter);
  const sorted = [...filtered].sort((a, b) => rankPiece(a) - rankPiece(b));
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;
  const canClose = visibleCount > step;

  useEffect(() => {
    setVisibleCount((current) => (current <= Math.max(MOBILE_STEP, DESKTOP_STEP) ? step : current));
  }, [step]);

  const handleFilter = (cat: string) => {
    setFilter(cat);
    animateFromRef.current = 0;
    previousCountRef.current = step;
    setVisibleCount(step);
  };

  const handleShowMore = () => {
    animateFromRef.current = visibleCount;
    setVisibleCount((c) => Math.min(c + step, sorted.length));
  };

  const handleClose = () => {
    animateFromRef.current = 0;
    previousCountRef.current = step;
    setVisibleCount(step);
    requestAnimationFrame(() => {
      lastInitialItemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  useEffect(() => {
    previousCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    if (!selected) return;
    const stored = getStoredSection(selected.id);
    if (stored === "") {
      setOpenSection("");
      return;
    }
    if (stored && SECTION_ORDER.includes(stored as SectionKey) && selected[stored as SectionKey]) {
      setOpenSection(stored);
      return;
    }
    setOpenSection(pickFirstAvailable(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const handleSectionChange = (value: string) => {
    setOpenSection(value);
    if (selected) setStoredSection(selected.id, value);
  };

  const closeZoom = () => setZoomedImages(null);
  const prevZoom = () => {
    if (!zoomedImages) return;
    setZoomedIndex((i) => (i - 1 + zoomedImages.length) % zoomedImages.length);
  };
  const nextZoom = () => {
    if (!zoomedImages) return;
    setZoomedIndex((i) => (i + 1) % zoomedImages.length);
  };

  const openZoom = (images: string[], index: number) => {
    setZoomedImages(images);
    setZoomedIndex(index);
  };

  return (
    <section id="galeria" ref={ref} className="relative py-32 px-6 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07]">
        <Dragon className="w-[900px] h-[900px]" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="reveal text-center mb-16">
          <p className="font-accent text-sm tracking-[0.4em] text-primary-glow/80 uppercase mb-6">Galeria</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-4">
            Arte vestível <span className="text-gradient-brand">exclusiva</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Cada obra é uma identidade materializada. Nenhuma se repete.
          </p>
        </div>

        <div className="reveal flex flex-wrap justify-center gap-2 md:gap-3 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleFilter(cat)}
              className={`font-accent px-4 md:px-5 py-2 text-sm md:text-base tracking-[0.15em] uppercase border transition-all duration-500 hover:-translate-y-0.5 active:scale-95 ${
                filter === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-glow"
                  : "border-border/60 text-muted-foreground hover:border-primary-glow hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-card border border-border/40 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhuma obra cadastrada ainda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((piece, idx) => {
              const isNew = idx >= animateFromRef.current;
              const delay = isNew ? (idx - animateFromRef.current) * 150 : 0;
              return (
                <PieceCard
                  key={piece.id}
                  piece={piece}
                  isNew={isNew}
                  delay={delay}
                  onSelect={handleSelectPiece}
                  innerRef={idx === step - 1 ? lastInitialItemRef : undefined}
                />
              );
            })}
          </div>
        )}

        {(hasMore || canClose) && (
          <div className="flex justify-center gap-3 mt-10">
            {hasMore && (
              <button
                onClick={handleShowMore}
                className="font-accent px-6 py-3 text-sm tracking-[0.15em] uppercase border border-primary-glow/60 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-glow transition-all duration-500"
              >
                Ver mais obras
              </button>
            )}
            {canClose && (
              <button
                onClick={handleClose}
                className="font-accent px-6 py-3 text-sm tracking-[0.15em] uppercase border border-border/60 text-muted-foreground hover:border-primary-glow hover:text-foreground transition-all duration-500"
              >
                Fechar
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-4xl bg-card border-primary/30 p-0 overflow-hidden max-h-[90vh] overflow-y-auto overscroll-contain">
          {selected && (
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative aspect-square md:aspect-auto bg-secondary/30 touch-pan-y">
                <PieceCarousel
                  key={selected.id}
                  images={selected.imagens}
                  imagesData={selected.imagensData}
                  alt={selected.nome}
                  onZoom={openZoom}
                />
              </div>
              <div className="p-8 flex flex-col">
                <p className="font-accent text-xs tracking-[0.15em] uppercase text-primary-glow mb-3">{selected.categoria}</p>
                <h3 className="font-display text-3xl md:text-4xl mb-3 text-foreground">{selected.nome}</h3>
                <div className="flex items-center gap-1.5 mb-6" aria-label="Seções disponíveis">
                  {SECTION_ORDER.map((key) => {
                    const labels: Record<SectionKey, string> = {
                      descricao: "Descrição",
                      conceito: "Conceito",
                      historia: "História",
                      tempo: "Tempo de produção",
                    };
                    const filled = !!selected[key];
                    return (
                      <span
                        key={key}
                        title={`${labels[key]}${filled ? "" : " (sem conteúdo)"}`}
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                          filled ? "bg-primary-glow shadow-[0_0_6px_hsl(var(--primary-glow)/0.6)]" : "bg-muted-foreground/30"
                        }`}
                      />
                    );
                  })}
                </div>
                <Accordion
                  type="single"
                  collapsible
                  value={openSection}
                  onValueChange={handleSectionChange}
                  className="text-sm"
                >
                  {selected.descricao && (
                    <AccordionItem value="descricao" className="border-border/40">
                      <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground py-3">
                        Descrição
                      </AccordionTrigger>
                      <AccordionContent className="text-foreground/90 leading-relaxed pb-4">
                        {selected.descricao}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {selected.conceito && (
                    <AccordionItem value="conceito" className="border-border/40">
                      <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground py-3">
                        Conceito
                      </AccordionTrigger>
                      <AccordionContent className="text-foreground/90 leading-relaxed pb-4">
                        {selected.conceito}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {selected.historia && (
                    <AccordionItem value="historia" className="border-border/40">
                      <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground py-3">
                        História
                      </AccordionTrigger>
                      <AccordionContent className="text-foreground/90 leading-relaxed whitespace-pre-line pb-4">
                        {selected.historia}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {selected.tempo && (
                    <AccordionItem value="tempo" className="border-border/40">
                      <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground py-3">
                        Tempo de produção
                      </AccordionTrigger>
                      <AccordionContent className="text-foreground/90 leading-relaxed pb-4">
                        {selected.tempo}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
                <Button
                  asChild
                  className="font-accent text-base tracking-[0.2em] uppercase mt-8 bg-gradient-purple-wine border border-primary-glow/40 hover:shadow-glow text-white rounded-none h-12 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <a
                    href={buildWhatsAppLink(
                      `Olá! Vi a obra "${selected.nome}"${selected.categoria ? ` (${selected.categoria})` : ""} na galeria e quero algo nesse nível. Pode me contar como começamos um projeto exclusivo?`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleCtaClick}
                  >
                    Quero algo nesse nível
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {zoomedImages && (
        <ZoomOverlay
          images={zoomedImages}
          index={zoomedIndex}
          onClose={closeZoom}
          onPrev={prevZoom}
          onNext={nextZoom}
        />
      )}
    </section>
  );
};
