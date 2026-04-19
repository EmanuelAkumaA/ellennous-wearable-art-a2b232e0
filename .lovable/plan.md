

## Plano — Dots no carrossel + imagens extras

### 1. Indicadores (dots) no `PieceCarousel` (`src/components/sections/Gallery.tsx`)

- Usar a `CarouselApi` exposta via `setApi` para rastrear `selectedIndex` e `scrollSnaps`.
- Estado local: `selectedIndex` (number) e `snapCount` (number).
- Subscrever em `api.on("select", ...)` e `api.on("reInit", ...)` para atualizar.
- Renderizar dots **abaixo** do carrossel, sobrepostos na parte inferior da imagem (absolute bottom-3, centrados):
  - `<button>` por snap, `aria-label="Ir para imagem N"`.
  - Dot ativo: `w-6 bg-primary-glow` / inativo: `w-1.5 bg-white/40 hover:bg-white/70`.
  - Altura `h-1.5`, rounded-full, transição suave.
  - Click → `api.scrollTo(i)`.
- Só renderizar dots quando `imagens.length > 1` (já é o caso onde o Carousel aparece).

### 2. Imagens extras em peças da galeria

Para validar visualmente, vou adicionar **imagens extras geradas via IA** em 2 peças:

- **"Sombra do Monarca"** (Anime/Geek) → +2 imagens (detalhe das costas + close da pintura).
- **"Tigre Soberano"** (Realismo) → +2 imagens (close do tigre + vista lateral).

Geração via skill `image-generation` (modelo `flux/schnell` por velocidade), salvas em `src/assets/`:
- `gallery-anime-detail.jpg`, `gallery-anime-back.jpg`
- `gallery-realismo2-close.jpg`, `gallery-realismo2-side.jpg`

Atualizar arrays `imagens` das peças correspondentes em `PIECES`.

### 3. Pequeno ajuste de layout no modal

- Garantir `padding-bottom` suficiente na imagem para os dots não cobrirem detalhe importante (ou colocar dots **fora** da imagem, num `<div>` abaixo). Vou optar por dots **sobrepostos** na base da imagem com leve gradiente escuro embaixo já existente — fica discreto e elegante.

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/sections/Gallery.tsx` | dots + imagens extras nos arrays |
| `src/assets/gallery-anime-detail.jpg` (novo) | gerada |
| `src/assets/gallery-anime-back.jpg` (novo) | gerada |
| `src/assets/gallery-realismo2-close.jpg` (novo) | gerada |
| `src/assets/gallery-realismo2-side.jpg` (novo) | gerada |

## Pontos de atenção
- Sem mudanças em paleta, layout geral ou tipografia.
- Dots seguem identidade: roxo `primary-glow` no ativo, branco translúcido no inativo.
- Autoplay continua funcionando; dots refletem o slide atual em tempo real.

