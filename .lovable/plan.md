

## Plano: blindar "Auto-otimizar em risco" + deixar o admin/galeria fluido

### Diagnóstico

Investiguei o ImageOptimizer, BackfillRunner, hooks de realtime e a galeria pública. Encontrei **três causas reais de travamento**:

1. **Sem trava de execução real** no "Auto-otimizar em risco" (e nos irmãos: "Modernizar antigas", "Reprocessar"). O `disabled={!!bulkBusy}` só protege o botão **dentro do mesmo render**: cliques rápidos, dois admins simultâneos ou o mesmo admin em duas abas conseguem disparar o pipeline em paralelo na mesma imagem.
2. **Tempestade de realtime durante bulk runs**. Cada update no `optimized_images` aciona um `load()` que rebusca até 100 linhas + nomes das obras. Com 50 imagens reprocessando, são **~100 eventos × `load()` completo**, congelando a UI.
3. **Re-renders descontrolados**. `setBulkProgress({done,total})` re-renderiza a lista inteira (100 cards) a cada imagem concluída. Mesmo padrão na galeria pública via `useGalleryData`.

---

### 1. Travar "Auto-otimizar em risco" contra execuções simultâneas

**Editar `src/pages/admin/ImageOptimizer.tsx`:**

- **Trava em ref síncrona** (`runningRef = useRef(false)`): primeira coisa que `handleAutoOptimizeAtRisk` faz é `if (runningRef.current) return; runningRef.current = true;`. Refs atualizam **sincronicamente**, então cliques duplos no mesmo tick são bloqueados antes do React rodar.
- **Trava cross-tab via lock distribuído**: usar `navigator.locks.request("optimizer:bulk", { ifAvailable: true }, …)`. Se outro admin/aba já estiver rodando, retorna `null` imediatamente e mostramos toast: "Outra otimização em massa já está em andamento."
- **Botão desabilitado de verdade** durante qualquer operação bulk (`bulkBusy` cobre os 4 modos: reprocess, delete, modernize, atrisk) e adicionar `aria-busy={!!bulkBusy}`.
- **Cancelamento limpo**: `try/finally` libera `runningRef.current = false` mesmo em erro, e o lock é liberado automaticamente quando a callback retorna.
- Aplicar o mesmo padrão (ref + `navigator.locks`) em `handleModernizeLegacy`, `handleBulkReprocess`, `handleBulkDelete` — todos compartilham o lock `"optimizer:bulk"`, então só um roda por vez.
- Mesma trava em `BackfillRunner.start()` com lock `"optimizer:backfill"` (separado, pois opera em outra fila).

**Fallback** para navegadores sem `navigator.locks` (Safari < 15.4): a ref + `bulkBusy` continuam servindo de barreira local. Toast informa "Trava cross-tab indisponível neste navegador."

---

### 2. Eliminar a tempestade de realtime durante bulk runs

**Editar `src/pages/admin/ImageOptimizer.tsx`, `src/hooks/useOptimizedImages.ts`, `src/components/sections/gallery/useGalleryData.ts`:**

Padrão único e reutilizável: **coalescer eventos + suspender durante bulk**.

- Novo helper `src/lib/useCoalescedRealtime.ts`:
  ```ts
  // Junta todos os eventos que chegarem em até 800ms numa única chamada de `onChange`.
  // Aceita `paused` para suspender refetches enquanto o bulk roda — quando despausa,
  // dispara um único `onChange` se houver eventos pendentes.
  useCoalescedRealtime({ table, onChange, paused, debounceMs })
  ```
- `ImageOptimizer` passa `paused={!!bulkBusy}` → durante o bulk, **0 refetches**. Quando termina, faz **1 refetch único** com o estado final. Hoje são ~100.
- `useGalleryData` aumenta debounce de 500ms → 1500ms (galeria pública não precisa de updates instantâneos).
- `useOptimizedImages` ganha o mesmo padrão.

**Resultado mensurável**: bulk de 50 imagens vai de **~100 fetches + 100 re-renders** para **1 fetch + ~50 re-renders progressivos** (apenas o `setBulkProgress`).

---

### 3. Reduzir re-renders e melhorar a fluidez geral

**Editar `src/pages/admin/ImageOptimizer.tsx`:**

- **`setBulkProgress` em throttle de 250ms** (`requestAnimationFrame`-friendly). Com 50 imagens não precisamos de 50 re-renders, 4–8 atualizações visuais bastam.
- **`React.memo` no `ImageRow` e `ImageCard`** com comparator raso em `(prev.image.id, prev.image.status, prev.image.variants.length, prev.selected)`. Hoje os cards re-renderizam todos a cada `setItems`.
- **Estado local otimista**: ao marcar como `processing`, fazer `setItems` 1× com todos os IDs no mesmo update (já é o caso, mantém). Evitar o map repetido dentro do loop de update.

**Editar `src/components/sections/gallery/useGalleryData.ts`:**

- `buildPieces` é puro — memoizar via `useMemo([rawPieces, optimizedMap])` em vez de recomputar dentro do callback de realtime + dentro do load inicial.
- Mover assinatura realtime **só para admin** ou pelo menos suspender quando a aba está oculta (`document.visibilityState !== "visible"`). Visitantes não precisam de updates ao vivo da galeria — a próxima navegação carrega a versão mais recente.

**Editar `src/pages/admin/BackfillRunner.tsx`:**

- O setInterval de tick (a cada 1s) já é leve, mas trocar `setNow(Date.now())` por `setNow((n) => n + 1000)` (evita criar nova Date) e só rodar quando a aba está visível.
- `BackfillRow` em `React.memo` (são até centenas de linhas em backfill grande).

---

### 4. Sinal visual claro de "em execução"

- Sticky bar no topo do Optimizer (`Bulk action bar` já existe) ganha estado para "Auto-otimização em andamento — aguarde" enquanto `bulkBusy === "atrisk"`. Botões `Auto-otimizar`, `Modernizar antigas` e `Reprocessar` ficam com `cursor-not-allowed` + `pointer-events-none` para evitar 100% qualquer clique acidental enquanto roda.
- Toast com `id` fixo (sonner aceita `id`) para não empilhar 5 toasts do mesmo bulk.

---

### Arquivos editados/criados

**Novo:**
- `src/lib/useCoalescedRealtime.ts` — hook de assinatura realtime com debounce + pause.
- `src/lib/runtimeLock.ts` — wrapper sobre `navigator.locks` com fallback síncrono via ref/module-singleton (`Map<string, boolean>`).

**Editado:**
- `src/pages/admin/ImageOptimizer.tsx` — refs de execução + `runtimeLock` em `handleAutoOptimizeAtRisk`/`handleModernizeLegacy`/`handleBulkReprocess`/`handleBulkDelete`; usar `useCoalescedRealtime` com `paused`; throttle no `setBulkProgress`.
- `src/pages/admin/BackfillRunner.tsx` — `runtimeLock("optimizer:backfill")` em `start`; `BackfillRow` memoizado; tick só com aba visível.
- `src/components/admin/optimizer/ImageRow.tsx` — `React.memo` com comparator raso.
- `src/components/admin/optimizer/ImageCard.tsx` — `React.memo` com comparator raso.
- `src/hooks/useOptimizedImages.ts` — migra para `useCoalescedRealtime`.
- `src/components/sections/gallery/useGalleryData.ts` — `useCoalescedRealtime` (debounce 1500ms) + `useMemo` em `buildPieces` + pause quando aba oculta.

### Validação

1. **Trava**: clicar 5× rápido no botão "Auto-otimizar em risco" → apenas 1 execução começa (verificar no Network tab: 1 batch de chamadas `optimize-image`, não 5×).
2. **Cross-tab**: abrir o admin em duas abas, clicar simultaneamente → segunda aba mostra toast "Outra otimização em massa já está em andamento" e o botão volta ao normal sem disparar nada.
3. **Tempestade de realtime**: rodar bulk de 30 imagens → no DevTools Performance, ver **1 chamada a `load()`** durante todo o bulk (em vez de ~30+) e re-renders < 10.
4. **Galeria pública**: enquanto admin reprocessa, navegar pela galeria pública em outra aba — sem stutters; refresh debounce de 1.5s mantém atualização eventual sem travar.
5. **Cliques durante run**: tentar clicar em "Modernizar antigas" enquanto "Auto-otimizar em risco" roda → botão visualmente desabilitado e sem efeito.

