

## Plano: Reprocessamento em lote + integração automática no PieceCarousel

### Parte 1 — Seleção múltipla e reprocessar em lote no Otimizador

**Arquivo:** `src/pages/admin/ImageOptimizer.tsx`

- Novo estado `selectedIds: Set<string>` no nível da página.
- Barra de ações flutuante (`sticky top-0 z-10`) que aparece quando `selectedIds.size > 0`, com:
  - Contador "N selecionadas"
  - Botão **Selecionar todas** / **Limpar seleção**
  - Botão **Reprocessar (N)** — chama `optimize-image` para cada ID em paralelo (com `Promise.allSettled`, limitando a 3 invocações simultâneas via batching simples para não sobrecarregar a edge function)
  - Botão **Excluir (N)** — confirmação única, depois remove storage + linhas em batch
- Toast de progresso "Reprocessando 3/8…" durante a operação.

**Arquivo:** `src/components/admin/optimizer/ImageCard.tsx`

- Nova prop `selected: boolean` e `onToggleSelect: (id) => void`.
- Checkbox no canto superior esquerdo do card (visível sempre; quando `selected`, aplica anel `ring-2 ring-primary` no card).
- Clique no checkbox não dispara abrir snippet/detalhe (stopPropagation).
- Em modo seleção (`selectedIds.size > 0`), o clique no card em área vazia também alterna a seleção, para UX rápida no mobile.

### Parte 2 — Integração automática das variantes no PieceCarousel

**Estratégia de matching (sem mudar schema):** vincular por **nome do arquivo**. Quando o admin sobe uma imagem no Otimizador com o mesmo nome do arquivo já presente em `gallery_piece_images` (ex: `realismo.jpg`), o site passa a servir as variantes automaticamente. Não invasivo, sem migração.

**Novo helper:** `src/lib/optimizedImageMap.ts`
- Função `loadOptimizedMap()` que busca `optimized_images` com `status='ready'` e devolve `Map<basename, OptimizedVariant[]>` indexado pelo basename de `original_path` (ex: `realismo.jpg` → variantes).
- Função utilitária `getBasenameFromUrl(url)` que extrai `realismo.jpg` de qualquer URL pública.
- Função `findVariantsForUrl(url, map)` que retorna `OptimizedVariant[] | null`.

**Arquivo:** `src/components/sections/gallery/useGalleryData.ts`
- Após carregar pieces, chamar `loadOptimizedMap()` em paralelo.
- Estender `PieceData` com `imagensData: Array<{ url: string; variants: OptimizedVariant[] | null }>` mantendo `imagens: string[]` para retro-compatibilidade (ZoomOverlay continua usando URLs).
- Realtime subscription opcional na tabela `optimized_images` para refrescar o map quando uma nova variante fica pronta (debounced 500ms).

**Arquivo:** `src/components/sections/gallery/PieceCarousel.tsx`
- Nova prop opcional `imagesData?: Array<{ url: string; variants: OptimizedVariant[] | null }>`.
- Quando uma imagem tem variantes, renderiza `<picture>` com `<source type="image/avif" srcset>` e `<source type="image/webp" srcset>`, `<img>` JPEG fallback. `sizes` adaptado ao layout do modal (metade da viewport em desktop, full em mobile): `sizes="(max-width:768px) 100vw, 50vw"`.
- Quando não tem variantes (imagem antiga não otimizada), mantém `<img>` simples como hoje.
- `loading`/`fetchPriority`/`decoding` continuam aplicados ao `<img>` interno do `<picture>`.

**Arquivo:** `src/components/sections/gallery/Gallery.tsx`
- Ao montar `<PieceCarousel>`, passa `imagesData={selected.imagensData}`.

### Detalhes técnicos

- **Por que matching por basename**: o admin já trabalha com nomes de arquivo significativos (`realismo.jpg`), e isso evita criar uma coluna `optimized_image_id` em `gallery_piece_images` (que exigiria UI de vincular manualmente). Funciona "sozinho": basta subir no Otimizador um arquivo com o mesmo nome.
- **Conflito de nomes**: se houver dois originais com o mesmo nome, o map fica com o mais recente (sobrescreve). Aceitável para o caso de uso.
- **Cache**: o map é carregado uma vez no mount do `useGalleryData`. Realtime atualiza incrementalmente.
- **Bulk reprocess concurrency**: 3 chamadas paralelas para evitar timeout da edge function em lotes grandes.
- **Otimista no UI de bulk**: ao iniciar reprocess, marca cards como `status='processing'` localmente; o realtime confirma quando terminam.

### Validação

1. Selecionar 5 cards no Otimizador, clicar **Reprocessar (5)** → todos viram "processando" e voltam a "ready" via realtime.
2. Subir no Otimizador uma imagem chamada `realismo.jpg` → ao abrir a obra que usa essa imagem na galeria pública, a aba Network mostra `realismo` sendo servido em AVIF/WebP no breakpoint apropriado.
3. Imagens sem versão otimizada continuam funcionando como antes (fallback `<img>` simples).
4. Mobile (390px): `<picture>` escolhe variante 400px AVIF; sem regressão de performance no swipe.

### Arquivos modificados/criados

**Novos:**
- `src/lib/optimizedImageMap.ts` — helper de matching por basename

**Editados:**
- `src/pages/admin/ImageOptimizer.tsx` — estado de seleção + barra de ações em lote
- `src/components/admin/optimizer/ImageCard.tsx` — checkbox de seleção + ring visual
- `src/components/sections/gallery/useGalleryData.ts` — carrega optimized map, expõe `imagensData`
- `src/components/sections/gallery/PieceCarousel.tsx` — renderiza `<picture>` quando há variantes
- `src/components/sections/gallery/Gallery.tsx` — passa `imagesData` para `PieceCarousel`

