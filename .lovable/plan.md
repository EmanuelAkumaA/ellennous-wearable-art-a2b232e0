

## Plano: Skeleton artístico + cache persistente e debounce no `useDominantColor`

### 1. Skeleton/placeholder artístico no card da galeria

Hoje o card mostra a imagem com `loading="lazy"` direto e a borda colorida começa cinza/glow padrão até o hook `useDominantColor` resolver — gera um leve "flicker" no primeiro hover.

**Mudanças em `src/components/sections/gallery/Gallery.tsx`** (componente `PieceCard`):

- Estado local `imgLoaded` (`onLoad` no `<img>` real → `true`).
- Estado derivado `isReady = imgLoaded && dominantColor !== null` (ou timeout de 600 ms para não travar caso o hook falhe).
- Renderizar um overlay **absoluto** dentro do card, por cima da imagem, enquanto `!isReady`:
  - Gradiente sutil em diagonal usando a paleta da marca + shimmer:
    `bg-gradient-to-br from-card via-secondary/40 to-card`
  - Faixa de shimmer animada (keyframe `shimmer` translateX -100% → 100%, 1.6 s linear infinite) com `bg-gradient-to-r from-transparent via-primary-glow/15 to-transparent`.
  - Ícone discreto centralizado (silhueta do `Dragon` em `opacity-10 w-24 h-24`) reforçando a identidade premium.
  - `transition-opacity duration-700` e fade-out (`opacity-0 pointer-events-none`) quando `isReady`.
- Antes de pintar, o `--ring-color` cai para `hsl(var(--primary-glow))` com `opacity` reduzida no anel — o anel só "acende" depois que a cor dominante chega (já é o comportamento; vamos só travar a opacidade do `::before` para 0 enquanto `!dominantColor`).

**Novo CSS em `src/index.css`** (camada `components`):

```css
.gallery-skeleton {
  position: absolute; inset: 0; z-index: 2;
  background: linear-gradient(135deg,
    hsl(var(--card)) 0%, hsl(var(--secondary) / 0.5) 50%, hsl(var(--card)) 100%);
  overflow: hidden;
}
.gallery-skeleton::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg,
    transparent 0%, hsl(var(--primary-glow) / 0.18) 50%, transparent 100%);
  transform: translateX(-100%);
  animation: gallery-shimmer 1.6s linear infinite;
}
@keyframes gallery-shimmer { to { transform: translateX(100%); } }
.card-glow-ring[data-loading="true"]::before { opacity: 0 !important; }
```

O wrapper `card-glow-ring` recebe `data-loading={!isReady}` para suprimir o anel até a cor estar pronta — elimina o flicker de cinza-para-cor ao passar o mouse.

### 2. Cache persistente + debounce no `useDominantColor`

**Mudanças em `src/hooks/use-dominant-color.ts`:**

#### 2a. Cache persistente (localStorage)

- Chave única: `ellennous:dominantColor:v1` → `Record<url, { color: string | null; ts: number }>`.
- Hidratação **lazy** (apenas uma vez no módulo) para o `Map<string, string | null>` em memória existente:
  ```ts
  const STORAGE_KEY = "ellennous:dominantColor:v1";
  const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
  let hydrated = false;
  const hydrate = () => {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, { color: string | null; ts: number }>;
      const now = Date.now();
      for (const [url, v] of Object.entries(obj)) {
        if (now - v.ts < TTL_MS) CACHE.set(url, v.color);
      }
    } catch { /* ignore */ }
  };
  ```
- Persistência **debounced**: após `CACHE.set(url, color)`, agendar `flushPersist()` em 400 ms (clearTimeout/setTimeout). `flushPersist` serializa o `CACHE` inteiro (com timestamps) e grava em `localStorage` com `try/catch` (quota silencioso).
- Limite de tamanho: se `CACHE.size > 200`, descartar os 50 mais antigos antes de gravar.

#### 2b. Debounce do cálculo (canvas)

Hoje, ao filtrar a galeria, vários cards montam/desmontam rapidamente e cada um inicia um `Image()` + canvas. Vamos atrasar o início:

- Dentro do `useEffect`, em vez de chamar `computeColor(url)` imediatamente, agendar via `setTimeout` de **150 ms**. Se o componente desmontar antes (filtro mudou, scroll rápido), `clearTimeout` cancela e nenhum canvas é criado.
- Cache em memória continua sendo consultado **antes** do `setTimeout` (hits permanecem instantâneos).
- O `PENDING` Map já evita cálculos duplicados para a mesma URL — manter.

```ts
useEffect(() => {
  if (!url) { setColor(null); return; }
  hydrate();
  if (CACHE.has(url)) { setColor(CACHE.get(url) ?? null); return; }
  let cancelled = false;
  const handle = setTimeout(() => {
    let promise = PENDING.get(url);
    if (!promise) {
      promise = computeColor(url).then((c) => {
        CACHE.set(url, c);
        PENDING.delete(url);
        schedulePersist();
        return c;
      });
      PENDING.set(url, promise);
    }
    promise.then((c) => { if (!cancelled) setColor(c); });
  }, 150);
  return () => { cancelled = true; clearTimeout(handle); };
}, [url]);
```

### 3. Integração

- `PieceCard` em `Gallery.tsx`: adicionar `imgLoaded` state, atributo `data-loading` no wrapper, overlay `<div className="gallery-skeleton">` com `Dragon` interno, fade-out controlado.
- `ResponsivePicture` já expõe o `<img>` final mas não emite `onLoad` para o consumidor — vamos passar um `onLoad` opcional pela prop e encadeá-lo ao `handleLoad` interno (alteração mínima retrocompatível).

### Arquivos

**Editados**
- `src/hooks/use-dominant-color.ts` — hidratação lazy do `localStorage`, persistência debounced (400 ms), TTL de 30 dias, limite de 200 entradas, debounce de 150 ms no `computeColor`.
- `src/components/sections/gallery/Gallery.tsx` — `PieceCard` com `imgLoaded`, overlay de skeleton, `data-loading` no wrapper.
- `src/components/ui/responsive-picture.tsx` — aceitar e encadear prop `onLoad` opcional.
- `src/index.css` — utilitário `.gallery-skeleton`, keyframe `gallery-shimmer`, regra `data-loading="true"` que suprime o `::before` do anel.

**Sem migration. Sem mudanças em libs externas.**

