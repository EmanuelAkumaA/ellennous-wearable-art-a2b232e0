
## Plano

Duas mudanças independentes.

### 1. Slide animado ao reordenar obras

**Problema**: hoje o dnd-kit anima durante o drag, mas quando o usuário clica nas setas ↑/↓ o array muda via `setPieces` e os cards "saltam" instantaneamente, sem transição.

**Solução**: usar a técnica FLIP (First-Last-Invert-Play) sem instalar nada. Em `SortablePieceCard`:

- Manter um `ref` ao DOM node de cada card.
- Antes de cada reordenação (no `movePiece`), capturar `getBoundingClientRect()` de todos os cards visíveis (via um Map indexado por `piece.id`).
- Depois do `setPieces` (no `useLayoutEffect` do componente pai), comparar a nova posição com a antiga: aplicar `transform: translateY(deltaY)` instantâneo + `transition: none`, depois em `requestAnimationFrame` setar `transform: ''` + `transition: transform 350ms cubic-bezier(0.22, 1, 0.36, 1)` para o card deslizar suavemente até o novo lugar.

Encapsular isso num pequeno hook `useFlipAnimation(items, getId)` em `src/hooks/use-flip-animation.ts`, alimentado com `pieces` e usado no container da lista mobile e do grid desktop.

A animação `animate-move-highlight` já existente (glow) continua disparando em paralelo — slide + flash combinam bem.

### 2. Trocar imagem de fundo do Hero pela imagem enviada

A imagem enviada é a peça preta com o personagem branco/amarelo "Aero Por Vero". Vou:

1. **Remover o fundo** da imagem usando o modelo Nano Banana (`google/gemini-2.5-flash-image`) com prompt do tipo "Remove background completely, keep only the jacket and person, transparent PNG, preserve all artwork details, sharp edges". Salvar o resultado como PNG transparente.
2. Salvar em `src/assets/hero-ellennous-aero.png`.
3. Atualizar `src/components/sections/Hero.tsx`:
   - Trocar `import heroImage from "@/assets/hero-ellennous.jpg"` para o novo PNG.
   - Manter exatamente o mesmo nível de sobreposição: `opacity-60` na `<img>` + o gradiente `bg-gradient-to-b from-background/30 via-background/60 to-background` por cima + o splash drift. Sem alterar tamanhos, posicionamento (`object-cover`), nem o glow roxo.
   - Atualizar o `alt` para algo como "Jaqueta Ellennous com arte autoral 'Aero por Vero' em preto, branco e amarelo".

A imagem original `hero-ellennous.jpg` fica preservada no repo (não excluo) caso seja útil depois.

### Arquivos a modificar/criar
- `src/hooks/use-flip-animation.ts` (novo)
- `src/pages/admin/PiecesManager.tsx` (usar o hook na lista de obras)
- `src/assets/hero-ellennous-aero.png` (novo, gerado via Nano Banana sem fundo)
- `src/components/sections/Hero.tsx` (trocar import e alt)

### Validação
1. **/admin/pieces no celular**: clicar ↑ ou ↓ — o card desliza suavemente até a nova posição (não salta) e ainda recebe o flash de highlight.
2. **Desktop**: drag-and-drop continua animado normalmente; clicar e arrastar entre posições no grid também desliza.
3. **Home (/)**: o hero passa a exibir a peça "Aero por Vero" sem fundo, com a mesma camada escura/gradiente — texto continua legível por cima.
