

## Análise rápida

**Tarefas:**
1. Rodar `npm run bump` — não posso executar em modo plan; será feito ao aprovar.
2. Microtipografia: aumentar `letter-spacing` em parágrafos Inter + ajustar `line-height` em Playfair.
3. Testimonials: tornar `@handle` clicável → link para `https://instagram.com/<handle sem @>`.
4. Gallery modal: trocar imagem única por **carrossel automático** com várias imagens por peça.

## Mudanças

### 1. Bump de versão
- Executar `npm run bump "troca de tipografia para Playfair + Bebas Neue + Inter"` → atualiza `package.json` para 0.1.1 e adiciona linha no README.

### 2. Microtipografia editorial (`src/index.css`)
- `body` (Inter): adicionar `letter-spacing: 0.01em` e manter `line-height: 1.65`.
- `p`: `letter-spacing: 0.012em; line-height: 1.7`.
- `h1, h2` (Playfair): `line-height: 1.05` (atualmente algumas usam 0.95 em utility — manter override em utility), `letter-spacing: -0.005em` para look editorial.
- Não alterar `font-accent` (Bebas) — já condensado.

### 3. Instagram clicável em Testimonials (`src/components/sections/Testimonials.tsx`)
- Adicionar campo `instagramUrl` opcional em cada testimonial (derivado do handle: `https://instagram.com/${handle.replace('@','').replace('.','')}` — mas como handles fictícios podem não existir, vou montar o link a partir do handle removendo só o `@`).
- Trocar `<p>` do handle por `<a href={instagramUrl} target="_blank" rel="noopener noreferrer">` com hover color (text-primary-glow → text-foreground).
- Adicionar pequeno ícone Instagram do lucide-react ao lado do handle para reforçar affordance.

### 4. Carrossel automático no modal da Galeria (`src/components/sections/Gallery.tsx`)
- Mudar tipo `Piece`: `imagem: string` → `imagens: string[]` (array). Manter `imagem` na grid principal (primeira do array).
- Para cada peça em `PIECES`, popular `imagens` com a imagem atual (1 item por enquanto). Usuário pode adicionar mais depois — o carrossel já funciona com qualquer quantidade ≥1.
- No `<DialogContent>`, substituir `<img>` único por `<Carousel>` (já existe `@/components/ui/carousel`) + plugin `embla-carousel-autoplay` (já usado em Testimonials):
  - `Carousel` com `opts={{ loop: true }}`, autoplay 4s.
  - Quando `imagens.length === 1`: renderizar imagem estática (sem controles/autoplay).
  - Quando ≥2: mostrar `CarouselPrevious`/`CarouselNext` discretos + indicadores (dots) opcionais.
- Lazy/loading: `loading="lazy"` em todas as imagens do carrossel.

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `package.json` + `README.md` | bump via script |
| `src/index.css` | letter-spacing/leading editorial |
| `src/components/sections/Testimonials.tsx` | handle → link Instagram + ícone |
| `src/components/sections/Gallery.tsx` | tipo `imagens: string[]` + carrossel autoplay no modal |

## Pontos de atenção
- Carrossel autoplay no modal pausa em hover/interação (mesmo padrão do Testimonials).
- Handles Instagram nos depoimentos são fictícios → links irão para perfis inexistentes; comportamento esperado e fácil de trocar quando o cliente fornecer handles reais.
- Sem mexer em paleta, layout ou estrutura.

