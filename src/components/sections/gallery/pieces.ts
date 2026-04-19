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

export type Category = "Todas" | "Anime / Geek" | "Realismo" | "Floral" | "ScarType" | "Exclusivas";

export interface Piece {
  id: string;
  nome: string;
  categoria: Exclude<Category, "Todas">;
  imagens: string[];
  descricao: string;
  conceito: string;
  tempo: string;
  destaque?: boolean;
  novo?: boolean;
}

export const CATEGORIES: Category[] = [
  "Todas",
  "Anime / Geek",
  "Realismo",
  "Floral",
  "ScarType",
  "Exclusivas",
];

export const PIECES: Piece[] = [
  {
    id: "1",
    nome: "Sombra do Monarca",
    categoria: "Anime / Geek",
    imagens: [animeImg, animeBackImg, animeDetailImg],
    descricao: "Jaqueta de couro pintada à mão com cena inspirada em fantasia sombria.",
    conceito:
      "Uma homenagem ao herói que carrega o peso da escuridão. Roxo profundo e respingos de sangue como narrativa visual.",
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
    conceito:
      "O método ScarType™ em sua expressão mais pura. Cada cicatriz é um traço autoral.",
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
