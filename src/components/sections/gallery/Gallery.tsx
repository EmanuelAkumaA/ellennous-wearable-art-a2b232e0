import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/use-reveal";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildWhatsAppLink } from "@/components/FloatingWhatsApp";
import { Dragon } from "@/components/Dragon";
import { CATEGORIES, PIECES, type Category, type Piece } from "./pieces";
import { PieceCarousel } from "./PieceCarousel";
import { ZoomOverlay } from "./ZoomOverlay";

const MOBILE_LIMIT = 6;

const rankPiece = (p: Piece) => (p.novo ? 0 : p.destaque ? 1 : 2);

export const Gallery = () => {
  const [filter, setFilter] = useState<Category>("Todas");
  const [selected, setSelected] = useState<Piece | null>(null);
  const [zoomedImages, setZoomedImages] = useState<string[] | null>(null);
  const [zoomedIndex, setZoomedIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const isMobile = useIsMobile();
  const ref = useReveal();

  const filtered = filter === "Todas" ? PIECES : PIECES.filter((p) => p.categoria === filter);
  const sorted = [...filtered].sort((a, b) => rankPiece(a) - rankPiece(b));
  const visible = isMobile && !showAll ? sorted.slice(0, MOBILE_LIMIT) : sorted;
  const showMoreButton = isMobile && !showAll && sorted.length > MOBILE_LIMIT;

  const handleFilter = (cat: Category) => {
    setFilter(cat);
    setShowAll(false);
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
      {/* Dragon watermark */}
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

        {/* Filters */}
        <div className="reveal flex flex-wrap justify-center gap-2 md:gap-3 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleFilter(cat)}
              className={`font-accent px-4 md:px-5 py-2 text-sm md:text-base tracking-[0.15em] uppercase border transition-all duration-500 ${
                filter === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-glow"
                  : "border-border/60 text-muted-foreground hover:border-primary-glow hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((piece) => (
            <button
              key={piece.id}
              onClick={() => setSelected(piece)}
              className="group relative aspect-[4/5] overflow-hidden bg-card border border-border/40 hover:border-primary-glow/60 transition-all duration-700 text-left animate-fade-up"
            >
              <img
                src={piece.imagens[0]}
                alt={`${piece.nome} — ${piece.categoria}`}
                loading="lazy"
                width={1024}
                height={1280}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-90" />
              {piece.destaque && (
                <span className="font-accent absolute top-4 right-4 text-xs tracking-[0.15em] uppercase bg-brand-red/90 text-white px-3 py-1">
                  Destaque
                </span>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="font-accent text-xs tracking-[0.15em] uppercase text-primary-glow mb-2">{piece.categoria}</p>
                <h3 className="font-display text-2xl text-foreground group-hover:text-gradient-brand transition-colors">
                  {piece.nome}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  Clique para ver detalhes →
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl bg-card border-primary/30 p-0 overflow-hidden">
          {selected && (
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative aspect-square md:aspect-auto bg-secondary/30">
                <PieceCarousel
                  key={selected.id}
                  images={selected.imagens}
                  alt={selected.nome}
                  onZoom={openZoom}
                />
              </div>
              <div className="p-8 flex flex-col">
                <p className="font-accent text-xs tracking-[0.15em] uppercase text-primary-glow mb-3">{selected.categoria}</p>
                <h3 className="font-display text-3xl md:text-4xl mb-6 text-foreground">{selected.nome}</h3>
                <div className="space-y-5 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Descrição</p>
                    <p className="text-foreground/90 leading-relaxed">{selected.descricao}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Conceito</p>
                    <p className="text-foreground/90 leading-relaxed">{selected.conceito}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Tempo de produção</p>
                    <p className="text-foreground/90">{selected.tempo}</p>
                  </div>
                </div>
                <Button
                  asChild
                  className="font-accent text-base tracking-[0.2em] uppercase mt-8 bg-gradient-purple-wine border border-primary-glow/40 hover:shadow-glow text-white rounded-none h-12"
                >
                  <a
                    href={buildWhatsAppLink(`Quero algo no nível de "${selected.nome}". Me conta como começamos.`)}
                    target="_blank"
                    rel="noopener noreferrer"
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
