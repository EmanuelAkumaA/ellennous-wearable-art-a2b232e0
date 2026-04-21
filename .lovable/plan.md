

## Plano: Otimizar transição de imagens do carrossel no mobile

### Diagnóstico

No mobile (390px), a transição entre imagens do carrossel da obra está lenta e travando. Causas identificadas no código atual:

1. **Imagens em alta resolução sem versão otimizada para mobile** — `loading="lazy"` ajuda no carregamento inicial, mas as imagens são as mesmas do desktop (até 1024×1280px), pesadas para decodificar em CPU mobile a cada swipe.
2. **Sem `decoding="async"`** — o navegador decodifica as imagens de forma síncrona durante o swipe, bloqueando o thread principal e causando o travamento perceptível.
3. **Animação de progresso roda em `requestAnimationFrame` contínuo** mesmo com 1 frame por slide — no mobile isso compete com o gesto de swipe.
4. **`transition-transform duration-1000` nas thumbs do grid** continua rodando enquanto o modal abre.
5. **Embla sem otimizações para touch** — falta `duration` reduzido e `skipSnaps` para resposta mais rápida ao gesto.

### Correções

**Arquivo:** `src/components/sections/gallery/PieceCarousel.tsx`

1. **Adicionar `decoding="async"` e `fetchPriority`** nas tags `<img>`:
   - Imagem ativa: `fetchPriority="high"`, `decoding="async"`
   - Demais imagens: `fetchPriority="low"`, `decoding="async"`
   - Isso evita bloqueio do thread principal durante o swipe.

2. **Pre-carregar imagens adjacentes (próxima/anterior)** com `loading="eager"` apenas para o slide atual ±1; manter `loading="lazy"` para o restante. Reduz o "branco" entre slides.

3. **Otimizar opções do Embla para mobile:**
   ```ts
   opts={{
     align: "start",
     loop: true,
     dragFree: false,
     containScroll: "trimSnaps",
     duration: 20,        // padrão é 25 — mais responsivo
     skipSnaps: false,
     watchDrag: true,
   }}
   ```
   `duration: 20` deixa a transição ~20% mais rápida sem perder suavidade.

4. **Pausar a animação do progresso (`requestAnimationFrame`) quando o documento estiver hidden ou durante o gesto de drag.** Adicionar listener `pointerDown` que cancela o `raf` e `pointerUp` que retoma — assim o gesto não compete com o frame loop.

5. **Reduzir trabalho do progress bar no mobile:** trocar atualização por RAF para `setInterval` de ~50ms (20fps) apenas quando `isMobile` — invisível ao olho mas muito mais leve.

6. **Adicionar `will-change: transform` no `CarouselContent` apenas durante o swipe** (via classe que entra no `pointerDown` e sai no `select`). Isso promove a layer pra GPU só quando necessário, sem manter compositing custoso permanente.

7. **Adicionar `contain: layout paint` no container do carrossel** para isolar repaints do resto do modal durante o swipe.

### Detalhes técnicos

- `decoding="async"` é a otimização de maior impacto: evita o "freeze" de 100-300ms ao trocar de slide em CPUs mobile fracas.
- `fetchPriority` é suportado em todos os navegadores modernos; nos antigos vira no-op (fallback seguro).
- O `requestAnimationFrame` do progress hoje roda mesmo quando autoplay está pausado (verifica `isPlaying` mas o loop continua) — vou adicionar `cancelAnimationFrame` quando `!playing` para zerar o custo.
- `will-change` aplicado permanentemente é prejudicial; aplicar/remover dinamicamente preserva performance.
- A imagem do single-slide (quando `images.length <= 1`) também recebe `decoding="async"`.

### Validação

1. Mobile 390px: swipe entre imagens deve ser fluido, sem travadinha de ~200ms ao soltar o dedo.
2. Slides de obras com 5+ imagens: troca contínua sem stutter.
3. Desktop: comportamento idêntico ao atual (otimizações são neutras ou positivas).
4. DevTools Performance: tempo do thread principal durante swipe deve cair de ~150ms para <50ms por transição.

### Arquivos modificados

- `src/components/sections/gallery/PieceCarousel.tsx` — todas as otimizações descritas

