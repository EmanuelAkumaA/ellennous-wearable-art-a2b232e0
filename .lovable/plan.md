
Vou adicionar uma seção de **Depoimentos** (`Testimonials`) entre o `ScarType` e o `ForWhom`, mantendo a estética dark premium da marca.

## O que será criado

**Novo arquivo**: `src/components/sections/Testimonials.tsx`

**Posição na página**: Entre `ScarType` e `ForWhom` em `src/pages/Index.tsx`.

## Design da seção

- **Título**: "Quem veste, fala por si." (Cinzel) + subcopy curta
- **Carrossel** usando `@/components/ui/carousel` (Embla, já instalado) com `loop: true` e `align: "start"`
- **Cards de depoimento** (3 visíveis em desktop, 2 em tablet, 1 em mobile):
  - Foto da pessoa vestindo a peça (formato retrato, `aspect-[3/4]`, hover zoom suave)
  - Overlay gradient escuro embaixo da foto
  - Nome + cidade/@ em pequeno
  - Citação curta em itálico (Cinzel light)
  - Tag da categoria da peça (badge sutil roxo)
- **Setas de navegação** customizadas (CarouselPrevious/Next) com glow roxo
- **Dragão SVG** como marca d'água sutil no fundo da seção (reaproveita `Dragon.tsx`)
- **Animação reveal** ao scroll usando o hook `use-reveal` existente

## Conteúdo (6 depoimentos fictícios premium)

Cada um com nome, @, cidade, categoria da peça e frase curta no tom da marca. Exemplos:
- "Rafael M." — São Paulo — Anime/Geek — "Nunca usei nada que falasse tanto por mim sem precisar abrir a boca."
- "Marina S." — Rio de Janeiro — Floral — "É arte que respira comigo."
- "Lucas T." — Curitiba — ScarType — "Não é roupa. É um manifesto que eu visto."
- (e mais 3 no mesmo tom)

## Imagens

Vou gerar **6 imagens com IA** no estilo Solo Leveling/dark premium — pessoas usando jaquetas customizadas, iluminação cinematográfica, fundos urbanos noturnos com tons roxo/vermelho. Salvas em `src/assets/`:
- `testimonial-1.jpg` até `testimonial-6.jpg`

## Detalhes técnicos

- Reutilizar tokens do design system (`--primary`, `--wine`, `shadow-glow`)
- Auto-play opcional via plugin `embla-carousel-autoplay` (já vem com embla, instalo se necessário)
- Sem libs novas pesadas
- 100% responsivo, mobile-first
- Importar `Testimonials` em `Index.tsx` e renderizar entre `ScarType` e `ForWhom`

## Arquivos afetados

1. `src/components/sections/Testimonials.tsx` (novo)
2. `src/pages/Index.tsx` (adicionar import + render)
3. `src/assets/testimonial-1.jpg` … `testimonial-6.jpg` (novos, gerados via IA)
