

## Plano — Stagger maior + paginação "Ver mais / Fechar" também no desktop

### 1. Stagger 80ms → 150ms

Em `Gallery.tsx`, alterar o cálculo `(idx - animateFromRef.current) * 80` para `* 150`. Cascata mais arejada.

### 2. Paginação no desktop (a partir de 6 obras)

Hoje a paginação só roda no mobile. Vamos torná-la **universal**, com tamanho de página diferente:

- **Mobile**: `MOBILE_STEP = 5` (mantém)
- **Desktop**: `DESKTOP_STEP = 6` (3 colunas × 2 linhas — visualmente equilibrado no grid `lg:grid-cols-3`)

Ajustes em `Gallery.tsx`:
- Adicionar constante `DESKTOP_STEP = 6`.
- Calcular `step = isMobile ? MOBILE_STEP : DESKTOP_STEP`.
- Estado inicial `visibleCount = step` (re-sincronizar quando `isMobile` mudar via `useEffect`).
- Trocar todas as ocorrências de `MOBILE_STEP` na lógica por `step`:
  - `visible = sorted.slice(0, visibleCount)` (sem o `isMobile ?`)
  - `hasMore = visibleCount < sorted.length`
  - `canClose = visibleCount > step`
  - `handleShowMore`: `+ step`
  - `handleClose`: volta para `step`
  - `handleFilter`: reset para `step`
- Ref do "fechar" passa a apontar para o **último item da primeira página** (`idx === step - 1`), não fixo no 5º.

Comportamento resultante:
- Categoria com ≤6 obras no desktop: nenhum botão.
- Categoria com 7+ obras: aparece "Ver mais obras" → revela mais 6 → quando atinge o total, só "Fechar" → "Fechar" volta ao 6º card com scroll suave.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/sections/gallery/Gallery.tsx` | stagger 150ms + step dinâmico (5 mobile / 6 desktop) + ref no último da 1ª página |

### Pontos de atenção
- "Todas" tem 7 peças → no desktop vai mostrar 6 + botão "Ver mais obras" revelando a 7ª → depois só "Fechar".
- Categorias com poucas obras (ex.: Anime/Geek tem 2): nenhum botão, igual hoje.
- Animação fade-up continua aplicada apenas nos cards revelados depois do clique.

