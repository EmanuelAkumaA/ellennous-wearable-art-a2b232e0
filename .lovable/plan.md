

## Plano — Paginação incremental "Ver mais / Fechar" no mobile

### Comportamento (só mobile)

- Inicial: 5 obras visíveis.
- Clicar **"Ver mais obras"**: revela +5 (10, 15, 20...).
- Botão **"Fechar"** aparece a partir da 2ª leva (quando já clicou "Ver mais" pelo menos 1x).
- **"Fechar"** sempre volta para as 5 primeiras e faz scroll até a **5ª obra** (última da leva inicial), pra página não ficar gigante.
- Quando todas as obras já estiverem visíveis (chegou no fim), **só "Fechar"** aparece (sem "Ver mais").
- No meio do caminho (já expandiu mas ainda tem mais): **ambos** os botões aparecem lado a lado.
- Trocar de filtro reseta para 5 obras visíveis.

### Estados em `Gallery.tsx`

Substituir `showAll: boolean` por:
- `visibleCount: number` (inicial: 5).
- Constante `MOBILE_STEP = 5`.

Derivações:
- `visible = isMobile ? sorted.slice(0, visibleCount) : sorted`.
- `hasMore = isMobile && visibleCount < sorted.length`.
- `canClose = isMobile && visibleCount > MOBILE_STEP` (já clicou "Ver mais" pelo menos 1x).

Handlers:
- `handleShowMore`: `setVisibleCount(c => Math.min(c + MOBILE_STEP, sorted.length))`.
- `handleClose`: `setVisibleCount(MOBILE_STEP)` + scroll suave até a 5ª obra (ref no card de índice 4) com `scrollIntoView({ behavior: "smooth", block: "center" })`.
- `handleFilter`: também reseta `visibleCount = MOBILE_STEP`.

### Scroll para a 5ª obra ao fechar

- Criar `fifthItemRef = useRef<HTMLButtonElement | null>(null)`.
- No `.map(visible, idx)`, atribuir `ref={idx === 4 ? fifthItemRef : undefined}` no botão da peça.
- `handleClose` chama `fifthItemRef.current?.scrollIntoView(...)` após setar o estado (usar `setTimeout(..., 0)` ou `requestAnimationFrame` pra garantir que o DOM já recolheu antes do scroll).

### UI dos botões

Container abaixo do grid, `flex justify-center gap-3 mt-10`:
- Renderiza `"Ver mais obras"` se `hasMore`.
- Renderiza `"Fechar"` se `canClose`.
- Mesma estética atual (font-accent, tracking-[0.15em], borda + hover glow). "Fechar" usa borda mais sutil (`border-border/60`) pra hierarquia visual com o primário.

### Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/sections/gallery/Gallery.tsx` | trocar `showAll` por `visibleCount`, adicionar `fifthItemRef`, lógica de "Ver mais"/"Fechar" com scroll |

### Pontos de atenção
- Desktop não muda (mostra tudo sempre).
- Categorias com ≤5 obras: nenhum botão aparece.
- Categorias com 6–10 obras: aparece "Ver mais" → depois só "Fechar".
- Reset ao trocar filtro mantém UX previsível.

