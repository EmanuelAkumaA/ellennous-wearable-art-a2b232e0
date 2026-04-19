import { useEffect, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useReveal } from "@/hooks/use-reveal";
import { buildWhatsAppLink } from "@/components/FloatingWhatsApp";
import { Dragon } from "@/components/Dragon";
import animeImg from "@/assets/gallery-anime.jpg";
import animeDetailImg from "@/assets/gallery-anime-detail.jpg";
import animeBackImg from "@/assets/gallery-anime-back.jpg";
import anime2Img from "@/assets/gallery-anime2.jpg";
import realismoImg from "@/assets/gallery-realismo.jpg";
import realismo2Img from "@/assets/gallery-realismo2.jpg";
import realismo2CloseImg from "@/assets/gallery-realismo2-close.jpg";
import realismo2SideImg from "@/assets/gallery-realismo2-side.jpg";
import floralImg from "@/assets/gallery-floral.jpg";
import scartypeImg from "@/assets/gallery-scartype.jpg";
import exclusivaImg from "@/assets/gallery-exclusiva.jpg";

type Category = "Todas" | "Anime / Geek" | "Realismo" | "Floral" | "ScarType" | "Exclusivas";

interface Piece {
  id: string;
  nome: string;
  categoria: Exclude<Category, "Todas">;
  imagens: string[];
  descricao: string;
  conceito: string;
  tempo: string;
  destaque?: boolean;
}

const PIECES: Piece[] = [
  {
    id: "1",
    nome: "Sombra do Monarca",
    categoria: "Anime / Geek",
    imagens: [animeImg, animeBackImg, animeDetailImg],
    descricao: "Jaqueta de couro pintada à mão com cena inspirada em fantasia sombria.",
    conceito: "Uma homenagem ao herói que carrega o peso da escuridão. Roxo profundo e respingos de sangue como narrativa visual.",
    tempo: "38 dias",
    destaque: true,
  },
  {
    id: "2",
    nome: "Cavaleiro Violeta",
    categoria: "Anime / Geek",
    imagens: [anime2Img],
    descricao: "Bomber black com armadura roxa pintada e olhos vermelhos vivos.",
    conceito: "Presença imponente. A figura do guerreiro como símbolo de poder silencioso.",
    tempo: "32 dias",
  },
  {
    id: "3",
    nome: "Retrato em Carmim",
    categoria: "Realismo",
    imagens: [realismoImg],
    descricao: "Jaqueta jeans com retrato hiperrealista em tons de vinho.",
    conceito: "O olhar que não pede licença. Pintura a óleo direta no tecido.",
    tempo: "40 dias",
  },
  {
    id: "4",
    nome: "Tigre Soberano",
    categoria: "Realismo",
    imagens: [realismo2Img, realismo2CloseImg, realismo2SideImg],
    descricao: "Couro vinho com tigre realista pintado à mão.",
    conceito: "Força e elegância selvagem. Cada pelo desenhado com pincel fino.",
    tempo: "35 dias",
    destaque: true,
  },
  {
    id: "5",
    nome: "Jardim Noturno",
    categoria: "Floral",
    imagens: [floralImg],
    descricao: "Bomber preto com rosas profundas em roxo e vermelho.",
    conceito: "A beleza que floresce no escuro. Botânica gótica em camadas de tinta.",
    tempo: "30 dias",
  },
  {
    id: "6",
    nome: "Costura Dilacerada",
    categoria: "ScarType",
    imagens: [scartypeImg],
    descricao: "Peça desconstruída com fusão de tecidos vinho e azul elétrico.",
    conceito: "O método ScarType™ em sua expressão mais pura. Cada cicatriz é um traço autoral.",
    tempo: "40 dias",
    destaque: true,
  },
  {
    id: "7",
    nome: "Dragão Imperial",
    categoria: "Exclusivas",
    imagens: [exclusivaImg],
    descricao: "Couro metálico com dragão oriental em roxo e carmim.",
    conceito: "Peça única de status. Numerada, registrada, irrepetível.",
    tempo: "45 dias",
    destaque: true,
  },
];

const CATEGORIES: Category[] = ["Todas", "Anime / Geek", "Realismo", "Floral", "ScarType", "Exclusivas"];

export const Gallery = () => {
  const [filter, setFilter] = useState<Category>("Todas");
  const [selected, setSelected] = useState<Piece | null>(null);
  const [zoomedImages, setZoomedImages] = useState<string[] | null>(null);
  const [zoomedIndex, setZoomedIndex] = useState(0);
  const ref = useReveal();

  const filtered = filter === "Todas" ? PIECES : PIECES.filter((p) => p.categoria === filter);

  const closeZoom = () => setZoomedImages(null);
  const prevZoom = () => {
    if (!zoomedImages) return;
    setZoomedIndex((i) => (i - 1 + zoomedImages.length) % zoomedImages.length);
  };
  const nextZoom = () => {
    if (!zoomedImages) return;
    setZoomedIndex((i) => (i + 1) % zoomedImages.length);
  };

  // Keyboard: ESC closes, arrows navigate
  useEffect(() => {
    if (!zoomedImages) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeZoom();
      else if (e.key === "ArrowLeft") prevZoom();
      else if (e.key === "ArrowRight") nextZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedImages]);

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
              onClick={() => setFilter(cat)}
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
          {filtered.map((piece) => (
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
                <span className="font-accent absolute top-4 right-4 text-xs tracking-[0.3em] uppercase bg-brand-red/90 text-white px-3 py-1">
                  Destaque
                </span>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="font-accent text-xs tracking-[0.3em] uppercase text-primary-glow mb-2">{piece.categoria}</p>
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
                <p className="font-accent text-xs tracking-[0.3em] uppercase text-primary-glow mb-3">{selected.categoria}</p>
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

      {/* Zoom overlay */}
      {zoomedImages && (
        <div
          onClick={closeZoom}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 md:p-12 cursor-zoom-out animate-fade-in"
          role="dialog"
          aria-label="Imagem ampliada"
        >
          <img
            src={zoomedImages[zoomedIndex]}
            alt={`Visualização ampliada ${zoomedIndex + 1} de ${zoomedImages.length}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain shadow-2xl border border-primary/20"
          />

          {/* Prev/Next buttons */}
          {zoomedImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevZoom();
                }}
                aria-label="Imagem anterior"
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-[110] h-12 w-12 rounded-full bg-background/40 backdrop-blur-sm border border-border/40 hover:border-primary-glow/60 text-foreground/80 hover:text-primary-glow transition-all flex items-center justify-center"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextZoom();
                }}
                aria-label="Próxima imagem"
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-[110] h-12 w-12 rounded-full bg-background/40 backdrop-blur-sm border border-border/40 hover:border-primary-glow/60 text-foreground/80 hover:text-primary-glow transition-all flex items-center justify-center"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Counter */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] font-accent text-xs tracking-[0.3em] uppercase text-foreground/70 bg-background/40 backdrop-blur-sm px-3 py-1.5 border border-border/40">
                {zoomedIndex + 1} / {zoomedImages.length}
              </div>
            </>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeZoom();
            }}
            aria-label="Fechar visualização"
            className="absolute top-4 right-4 md:top-6 md:right-6 z-[110] min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 font-accent text-xs tracking-[0.3em] uppercase text-foreground/80 hover:text-primary-glow transition-colors px-4 py-2 border border-border/40 hover:border-primary-glow/60 bg-background/60 backdrop-blur-sm"
          >
            <span className="hidden sm:inline">Fechar</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
};

interface PieceCarouselProps {
  images: string[];
  alt: string;
  onZoom?: (images: string[], index: number) => void;
}

const PieceCarousel = ({ images, alt, onZoom }: PieceCarouselProps) => {
  const autoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true, playOnInit: true })
  );
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSelectedIndex(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };
    update();
    api.on("select", update);
    api.on("reInit", update);

    // Ensure autoplay actually starts after the dialog finishes mounting
    const startTimer = window.setTimeout(() => {
      api.reInit();
      autoplay.current?.reset?.();
      autoplay.current?.play?.();
    }, 100);

    return () => {
      window.clearTimeout(startTimer);
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  if (images.length <= 1) {
    return (
      <img
        src={images[0]}
        alt={alt}
        loading="lazy"
        onClick={() => onZoom?.(images, 0)}
        className="w-full h-full object-cover cursor-zoom-in"
      />
    );
  }

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
              onClick={() => onZoom?.(images, i)}
              className="w-full h-full object-cover aspect-square md:aspect-auto cursor-zoom-in"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-3 h-9 w-9 bg-background/70 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow" />
      <CarouselNext className="right-3 h-9 w-9 bg-background/70 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow" />

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
        {Array.from({ length: snapCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => api?.scrollTo(i)}
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
