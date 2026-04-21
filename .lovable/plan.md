

## Plano: Indicador de seções + fix de travamento no mobile

### 1. Indicador visual de seções preenchidas

No header do modal (logo abaixo do nome da obra), adicionar uma linha discreta de 4 micro-pontos — um para cada seção possível (Descrição, Conceito, História, Tempo). Cada ponto tem dois estados:

- **Preenchido** (`bg-primary-glow`, opacidade total) → seção tem conteúdo
- **Vazio** (`bg-muted-foreground/30`, sem brilho) → seção sem conteúdo

Tooltip nativo (`title="Descrição"`) em cada ponto para acessibilidade. Visualmente fica um traço sutil tipo "•••○" que comunica de relance o que está disponível, sem competir com o título.

Posicionamento: flex row com `gap-1.5`, abaixo do `<h3>` e acima do `<Accordion>`, com `mb-4`.

### 2. Fade no accordion (revalidação)

A animação já foi configurada na rodada anterior em `tailwind.config.ts` com opacity nos keyframes. Vou **verificar** se está realmente ativa e, se necessário, garantir que `AccordionContent` (em `src/components/ui/accordion.tsx`) não tenha `overflow-hidden` cortando a transição de opacidade durante o slide. Se o componente estiver aplicando `overflow-hidden` no wrapper externo (que é o que recebe a animação), está tudo certo — só preciso confirmar visualmente que a opacidade está aparecendo. Se não estiver, adiciono `transition-opacity duration-300` direto no children container.

### 3. Travamento no mobile (carrossel da obra)

Causa identificada (390px viewport): o `PieceCarousel` dentro do `DialogContent` tem `aspect-square md:aspect-auto`, mas o **DialogContent** está com `max-h-[90vh] overflow-y-auto`. No mobile, o conteúdo total (imagem quadrada de ~390px + texto + accordion) ultrapassa 90vh, então o usuário precisa scrollar **vertical**. Mas o carrossel internamente captura gestos **horizontais** com Embla, e o navegador fica confuso entre scroll vertical da modal e swipe horizontal do carrossel — resultado: a tela "trava" em alguns toques.

**Correção** sem mexer na imagem nem no layout visual:

- Adicionar `touch-action: pan-y` no container do carrossel (`<div className="relative aspect-square md:aspect-auto bg-secondary/30">`) → diz ao browser "este elemento só recebe pan vertical do sistema; o pan horizontal é da aplicação". Isso elimina a briga de gestos.
- O Embla, internamente, escuta `pointerdown/move/up` — não depende de touch-action para funcionar. Continua reconhecendo swipe horizontal.
- Adicionar `overscroll-behavior: contain` no `DialogContent` para que o scroll da modal não "vaze" para o body (que também trava em alguns Androids).
- Verificar se `PieceCarousel` está com `dragFree: false` e `containScroll: "trimSnaps"` — se não estiver, ajustar para reduzir jitter no fim do swipe.

Resultado: scroll vertical da modal flui livre, swipe horizontal do carrossel funciona, sem travamento.

### Arquivos modificados

- `src/components/sections/gallery/Gallery.tsx` — indicador de pontos no header + classes `touch-pan-y` e `overscroll-contain`
- `src/components/sections/gallery/PieceCarousel.tsx` — verificar/ajustar opções do Embla se necessário
- `src/components/ui/accordion.tsx` — apenas se a opacidade não estiver visível; adicionar `transition-opacity` redundante

### Validação

1. Modal aberto em desktop: pontos aparecem abaixo do título, preenchidos só nas seções com conteúdo.
2. Mobile (390px): scroll vertical da modal funciona suave, swipe horizontal nas imagens funciona sem travar, accordion abre com fade visível.
3. Obra com só 2 campos preenchidos: 2 pontos brilhantes + 2 apagados.

