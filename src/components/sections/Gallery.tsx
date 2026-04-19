import { useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useReveal } from "@/hooks/use-reveal";
import { buildWhatsAppLink } from "@/components/FloatingWhatsApp";
import { Dragon } from "@/components/Dragon";
import animeImg from "@/assets/gallery-anime.jpg";
import anime2Img from "@/assets/gallery-anime2.jpg";
import realismoImg from "@/assets/gallery-realismo.jpg";
import realismo2Img from "@/assets/gallery-realismo2.jpg";
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
    imagens: [animeImg],
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
    imagens: [realismo2Img],
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
  const ref = useReveal();

  const filtered = filter === "Todas" ? PIECES : PIECES.filter((p) => p.categoria === filter);

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
              <div className="aspect-square md:aspect-auto bg-secondary/30">
                <img src={selected.imagem} alt={selected.nome} className="w-full h-full object-cover" />
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
    </section>
  );
};
