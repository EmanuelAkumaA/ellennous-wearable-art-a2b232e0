

## Plano — Indicador de pausa no carrossel

Adicionar um ícone discreto de pause que aparece durante os 5s de pausa do autoplay, para sinalizar visualmente o estado pausado.

### Implementação em `PieceCarousel.tsx`

**Estado novo:**
- `isPaused: boolean` — true enquanto o `pauseTimeoutRef` está ativo.

**Lógica:**
- Em `pauseAutoplay()`: setar `setIsPaused(true)`.
- No callback do `setTimeout` (após 5s): setar `setIsPaused(false)` antes de retomar o `play()`.
- No cleanup do unmount: setar `false` (não estritamente necessário, mas seguro).

**UI — ícone de pause:**
- Importar `Pause` do `lucide-react`.
- Renderizar absolutamente posicionado no canto superior direito do carrossel (`top-2 right-2`), acima da progress bar (`z-20`).
- Tamanho discreto: ícone `h-3 w-3` dentro de um círculo `h-7 w-7` com `bg-background/60 backdrop-blur-sm border border-primary/30`.
- Cor do ícone: `text-primary-glow`.
- Transição suave de opacidade: `transition-opacity duration-300`, `opacity-100` quando `isPaused`, `opacity-0 pointer-events-none` quando não.
- Renderizar apenas se `images.length > 1` (igual aos dots/progress bar).

### Arquivo afetado

| Arquivo | Ação |
|---|---|
| `src/components/sections/gallery/PieceCarousel.tsx` | adicionar estado `isPaused`, ícone `Pause` posicionado top-right |

### Pontos de atenção
- Sem mudanças em paleta, layout, tipografia ou outros componentes.
- Indicador some suavemente quando o autoplay retoma após 5s.
- Posicionado top-right para não competir com a progress bar (top) nem com os dots (bottom).

