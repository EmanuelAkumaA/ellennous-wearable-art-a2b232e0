

## Plano — Progress bar, swipe no zoom, sem zoom no mobile

### 1. Barra de progresso fina no carrossel do modal (`PieceCarousel`)

- Estado `progress` (0-100) atualizado via `requestAnimationFrame` enquanto o autoplay roda.
- Usar `autoplay.current.timeUntilNext()` (API do `embla-carousel-autoplay`) a cada frame para calcular `progress = 100 - (timeUntilNext / 4000) * 100`.
- Resetar `progress` para 0 no evento `select` do Embla (transição de slide).
- Pausar a animação quando autoplay está parado (hover desktop) — checar `autoplay.current.isPlaying()`.
- UI: `<div>` absoluto no topo do carrossel, `h-0.5 w-full bg-white/10`, com filho `bg-primary-glow` cujo `width: ${progress}%` e `transition-none` (movimento contínuo via rAF).
- Renderizar apenas quando `images.length > 1`.

### 2. Swipe horizontal no overlay de zoom + remoção das setas

- Detectar mobile via hook `useIsMobile()` (já existe em `src/hooks/use-mobile.tsx`).
- Adicionar handlers `onTouchStart` / `onTouchEnd` no container do overlay:
  - Guardar `touchStartX` em ref.
  - No `touchEnd`, comparar `deltaX`; se `|deltaX| > 50px` → `nextZoom()` (swipe esquerda) ou `prevZoom()` (swipe direita).
- **Remover os botões `ChevronLeft`/`ChevronRight`** do overlay completamente (em todos os tamanhos, conforme pedido).
- Manter o **contador "N / Total"** discreto no rodapé (ainda útil como indicador).
- Manter navegação por teclado (setas) no desktop — já existe.

### 3. Remover zoom no mobile

- Em `PieceCarousel`, **não chamar `onZoom`** quando `useIsMobile()` for `true`:
  - `onClick={isMobile ? undefined : () => onZoom?.(images, i)}`
  - Trocar classe `cursor-zoom-in` por `cursor-default` no mobile (ou condicional).
- Aplicar tanto no caso `images.length <= 1` quanto no carrossel.
- O overlay de zoom continua existindo (caso desktop dispare), mas no mobile nunca abre.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/sections/Gallery.tsx` | progress bar + swipe handlers + remover botões prev/next + bloquear zoom no mobile via `useIsMobile` |

### Pontos de atenção
- Sem mudanças em paleta, tipografia, layout ou outros componentes.
- Contador "1 / 3" mantido no overlay como referência visual.
- Progress bar reseta visualmente a cada novo slide; `transition-none` evita "voltar suave" indesejado.

