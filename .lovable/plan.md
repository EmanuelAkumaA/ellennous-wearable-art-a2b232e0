

## Plano: Fallback de capa + telemetria de carregamento + pré-carregamento no hover + remover anel animado

### 1. Remover a animação que circula o card (referência da imagem 01)

Em `src/index.css`, remover o pseudo-elemento `.card-glow-ring::before` (anel cônico rotativo) e o `::after` (glow radial). Manter o wrapper `.card-glow-ring` apenas como container neutro (ou remover completamente). Resultado: card limpo, sem borda animada nem halo.

- Remove `.card-glow-ring::before`, `.card-glow-ring:hover::before`, `.card-glow-ring::after`, `.card-glow-ring:hover::after`, `@keyframes ring-rotate` e a regra `[data-loading="true"]::before`.
- Em `Gallery.tsx` (`PieceCard`): remove o atributo `style={{ "--ring-color": ringColor }}` e o cálculo de `ringColor`. Mantém `data-loading` (não usado pelo CSS, mas inofensivo) — opcionalmente removido.
- O hook `useDominantColor` continua sendo chamado **apenas** para alimentar telemetria (próximo item) e o pré-carregamento. Não controla mais visual.

### 2. Fallback robusto quando a capa falha (CORS / 404 / rede)

Em `Gallery.tsx` (`PieceCard`):

- Novo estado `imgError: boolean`.
- `<ResponsivePicture onError={...} />` — adicionar prop `onError` ao `ResponsivePicture` (encadeada igual ao `onLoad`) e propagar para o `<img>`. Quando dispara:
  - Marca `imgError = true`.
  - Remove o card do estado de skeleton: `isReady = true` forçado quando `imgError`.
  - Renderiza um placeholder estético (Dragon + nome da peça em opacidade baixa, fundo `bg-card`) no lugar da imagem.
  - Loga em `client_telemetry` via novo evento `gallery_image_load_error` com `{ url, pieceId, reason }`. Registra também em `conversion_logs` via `logConversion({ source: "image_load", filename: url, status: "error", errorMessage: reason, ... })` (já existe esse caminho).
- O motivo (`reason`) é inferido: se `image.naturalWidth === 0` e o navegador não fornece detalhe, gravamos `"network_or_cors"`. Caso `crossOrigin` venha bloqueado pelo Supabase (raro), o resource timing reportará `transferSize === 0`.
- `isReady` agora é `(imgLoaded || imgError) && (dominantColor !== null || skeletonTimeout)` — o skeleton sai imediatamente em erro.

### 3. Telemetria de tempo de carregamento e tempo até cor dominante

**Novo evento em `clientTelemetry.ts`** — ampliar `TelemetryEvent`:
```ts
| "gallery_image_load_slow"
| "gallery_dominant_color_slow"
| "gallery_image_load_error"
```

**Em `PieceCard`** (Gallery.tsx):
- `mountAtRef = useRef(performance.now())`.
- No `onLoad` da capa: calcula `imgMs = performance.now() - mountAtRef.current`. Se `> 2500 ms`, dispara `gallery_image_load_slow` com `{ pieceId, ms: Math.round(imgMs), url }` (sem `oncePerSession` — queremos saber por peça, mas com debounce próprio: usar um `Set` em módulo `loggedSlowImg` para evitar repetir a mesma peça).
- `useEffect` que observa `dominantColor`: quando muda de `null → string`, calcula `colorMs = performance.now() - mountAtRef.current`. Se `> 1500 ms`, dispara `gallery_dominant_color_slow` com `{ pieceId, ms, url }` (mesma deduplicação por peça).
- Constantes no topo: `IMG_SLOW_MS = 2500`, `COLOR_SLOW_MS = 1500`.
- Os limiares são exportados para fácil ajuste futuro.

**Importante**: passar `oncePerSession: false` para esses três novos eventos no `trackClientEvent` (a deduplicação por peça é feita localmente). Atualizar `clientTelemetry.ts` para que `oncePerSession` seja respeitado (já é).

### 4. Pré-carregamento da imagem e da cor ao hover/focus

Objetivo: quando o usuário passa o cursor sobre o card (ou foca via teclado/tap no mobile), iniciamos o download da imagem em **resolução do modal** (a maior do `imagensData[0].variants` desktop) e disparamos o `useDominantColor` para a próxima peça.

**Estratégia**:

1. **Novo helper** `src/lib/imagePrefetch.ts`:
   ```ts
   const prefetched = new Set<string>();
   export const prefetchImage = (url: string) => {
     if (!url || prefetched.has(url)) return;
     prefetched.add(url);
     const link = document.createElement("link");
     link.rel = "prefetch";
     link.as = "image";
     link.href = url;
     link.crossOrigin = "anonymous";
     document.head.appendChild(link);
   };
   ```
   Usa `<link rel="prefetch" as="image">` — ignora se já prefetched. Cache global (Set) compartilhado.

2. **Em `PieceCard`** — adicionar handlers no `<button>`:
   - `onMouseEnter`, `onFocus`, `onTouchStart` → executa **uma vez por peça** (ref `prefetchedRef`):
     - Chama `prefetchImage(piece.imagens[0])` (a primeira imagem do carrossel — a que aparece quando abrir o modal).
     - Dispara também `prefetchImage` para `piece.imagens[1]` se existir (próximo slide).
     - Chama `void warmDominantColor(coverUrl)` — função exportada nova do hook que força o cálculo (ignorando o debounce de 150 ms) e popula o cache.

3. **Em `use-dominant-color.ts`** — exportar:
   ```ts
   export const warmDominantColor = (url: string | null | undefined) => {
     if (!url) return;
     hydrate();
     if (CACHE.has(url) || PENDING.has(url)) return;
     const p = computeColor(url).then((c) => {
       CACHE.set(url, { color: c, ts: Date.now() });
       PENDING.delete(url);
       schedulePersist();
       return c;
     });
     PENDING.set(url, p);
   };
   ```
   Reutiliza o pipeline existente. Não bloqueia o caller.

### 5. Atualização do `ResponsivePicture`

Adicionar prop opcional `onError?: (e: SyntheticEvent<HTMLImageElement>) => void` e encadear nos três `<img>` retornados (igual ao `onLoad`). Sem mudanças visuais.

### Arquivos

**Novos**
- `src/lib/imagePrefetch.ts` — helper `prefetchImage` com Set global.

**Editados**
- `src/index.css` — remove `.card-glow-ring::before/::after`, `@keyframes ring-rotate` e `[data-loading="true"]` (mantém `.gallery-skeleton`).
- `src/components/sections/gallery/Gallery.tsx` (`PieceCard`):
  - Remove `--ring-color`/`ringColor`.
  - Adiciona `imgError` state, `onError` handler com fallback artístico (Dragon + nome) e logs.
  - Adiciona telemetria de tempo (`IMG_SLOW_MS`, `COLOR_SLOW_MS`) com dedup por peça.
  - Adiciona `onMouseEnter` / `onFocus` / `onTouchStart` no `<button>` chamando `prefetchImage` e `warmDominantColor`.
- `src/components/ui/responsive-picture.tsx` — aceitar/encadear `onError` nos três `<img>`.
- `src/lib/clientTelemetry.ts` — ampliar `TelemetryEvent` com 3 novos tipos.
- `src/hooks/use-dominant-color.ts` — exportar `warmDominantColor`.

**Sem migration. Sem mudanças em libs externas.**

