

## Plano — ESC, navegação no zoom, fix autoplay e fix botão fechar mobile

### 1. Tecla ESC + setas no overlay de zoom (`Gallery.tsx`)

Estado adicional no `Gallery`:
- `zoomedImages: string[] | null` (lista da peça aberta)
- `zoomedIndex: number` (posição atual)
- Substituir `zoomedImage: string | null` por essa dupla; `currentSrc = zoomedImages?.[zoomedIndex]`.

Ao chamar `onZoom(src)` do `PieceCarousel`, passar também o array completo + índice clicado:
- Mudar assinatura: `onZoom?: (images: string[], index: number) => void`.
- No `PieceCarousel`, ao clicar numa imagem, usar `selectedIndex` atual ou o índice do `map`.

`useEffect` no `Gallery` quando `zoomedImages` ativo:
- `keydown`: `Escape` → fecha; `ArrowLeft` → `prev`; `ArrowRight` → `next` (com wrap).
- Cleanup no unmount/fechamento.

### 2. Botões prev/next discretos no overlay
- Só renderizar quando `zoomedImages.length > 1`.
- Botões absolutos `left-4` / `right-4`, `top-1/2`, ícones `ChevronLeft`/`ChevronRight` do lucide.
- Estilo: `bg-background/40 border border-border/40 hover:border-primary-glow/60`, `h-12 w-12`, rounded-full.
- `e.stopPropagation()` para não fechar o overlay.
- Indicador discreto `N / Total` no canto inferior central com `font-accent`.

### 3. Fix botão "Fechar ✕" no mobile

Causa provável: o overlay tem `onClick={() => setZoomedImage(null)}` no container raiz. No mobile, o **tap** no botão pode estar borbulhando OU o botão fica atrás de algo. Mais crítico: o botão usa apenas `onClick`, mas em alguns iOS a área do botão pode ser interceptada. Solução:
- Adicionar `e.stopPropagation()` no `onClick` do botão fechar (já fecha via close, mas evita double-trigger).
- Aumentar área de toque: `min-h-[44px] min-w-[44px]` (Apple HIG).
- Garantir `z-[110]` no botão (acima do overlay `z-[100]`).
- Adicionar `type="button"`.
- Trocar `onClick` da imagem para também ter `e.stopPropagation()` (já tem) — manter.

### 4. Fix carrossel automático parado

Causa: `Autoplay` é instanciado via `useRef(Autoplay({...}))` **uma vez** no mount do `PieceCarousel`. Quando o `Dialog` fecha e reabre (ou troca de peça), o `PieceCarousel` é desmontado/remontado, mas o problema real é que **`stopOnInteraction: false` + `stopOnMouseEnter: true`** está ok — porém, **ao abrir o modal pela primeira vez, o Embla pode inicializar antes do dialog estar visível**, e o autoplay não retoma porque o container estava `display:none`.

Correções:
- Forçar `api.reInit()` quando o `PieceCarousel` monta dentro do dialog visível (dialog do shadcn já renderiza só quando aberto, então `useEffect` no mount basta).
- Adicionar `useEffect` que chama `autoplay.current.reset()` quando `api` fica disponível.
- Trocar `stopOnMouseEnter: true` por `false` (no mobile não há hover, mas garante consistência) — ou manter, já que não é o culpado.
- Adicionar `playOnInit: true` explicitamente.
- Garantir `key` no `PieceCarousel` baseado em `selected.id` (já implícito porque o componente é remontado a cada peça aberta) — adicionar `key={selected.id}` ao usar `<PieceCarousel>` para forçar nova instância de autoplay por peça.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/sections/Gallery.tsx` | tudo acima — estado zoom, handlers ESC/setas, botões nav, fix botão fechar mobile, fix autoplay |

### Pontos de atenção
- Sem mudança em paleta, layout geral, tipografia ou outros componentes.
- Navegação no zoom faz wrap (última → primeira) tanto por seta quanto por botão.
- Autoplay continua pausando em hover desktop; no mobile roda contínuo.

