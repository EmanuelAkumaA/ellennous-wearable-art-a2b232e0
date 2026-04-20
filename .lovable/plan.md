

## Diagnóstico

As avaliações **estão sendo retornadas** pela API (vi nos network logs: 6 avaliações aprovadas — Rafael, Marina, Lucas, Beatriz, Daniel, Helena, todas com status approved). O problema não é dados nem RLS.

Olhando o console:
```
Warning: Function components cannot be given refs.
Check the render method of `Testimonials`.
at StarRating
```

E no `Testimonials.tsx`, o componente está envolto em `<section ref={ref}>` onde `ref` vem de `useReveal()`. A seção tem a classe `reveal` aplicada nos filhos. O `useReveal` provavelmente adiciona uma classe `is-visible` quando entra no viewport, mas como a section inteira só fica visível quando a animação dispara — e se o IntersectionObserver não disparar (ou se os elementos `.reveal` filhos começam com `opacity: 0`) — os cards ficam invisíveis mesmo estando no DOM.

Preciso confirmar olhando `use-reveal.ts` e o CSS `.reveal` em `index.css`.

## Causa provável

Os elementos com classe `.reveal` começam com `opacity: 0` aguardando a classe `is-visible`. Se o carrossel está dentro de um `.reveal` que nunca recebe `is-visible` (ou recebe tarde porque o IntersectionObserver só dispara ao scrollar até lá), os cards ficam invisíveis. Mas como o usuário diz que "não aparece", pode ser um dos dois:

1. **Animação reveal travada** — o div `<div className="reveal">` que envolve o `<Carousel>` nunca fica visível.
2. **Warning do StarRating com ref** — improvável de quebrar render, mas vale corrigir junto.

## Plano

Vou inspecionar os arquivos críticos antes de propor o fix definitivo:
- `src/hooks/use-reveal.ts` — entender quando `is-visible` é adicionado
- `src/index.css` — ver regras `.reveal`
- Confirmar se o ref do `useReveal` está aplicado corretamente

### Correções a aplicar

1. **Garantir que o carrossel sempre renderiza visível** — remover dependência de `.reveal` no wrapper do `<Carousel>` (ou forçar `opacity-100`), já que os dados já vêm do banco. A animação reveal pode ficar só no header.
2. **Corrigir warning do `StarRating`** — não é a causa raiz mas limpa o console; envolver em `forwardRef` ou simplesmente garantir que nada passa ref pra ele (provável que o Carousel/Embla esteja injetando refs nos filhos diretos).
3. **Adicionar fallback de loading visível** — se `isLoading` for `true`, mostrar skeleton em vez de tela vazia.
4. **Forçar refetch on focus** — para garantir que mudanças no admin apareçam mesmo sem realtime.

## Resumo técnico

- Investigar `use-reveal.ts` e CSS de `.reveal`
- Em `Testimonials.tsx`: aplicar `useReveal` apenas no header (`text-center mb-16`), deixar o carrossel sempre visível
- Adicionar estado de loading com skeleton (3 cards placeholder)
- Manter realtime + query (já funciona)

Resultado: as 6 avaliações reais aparecem imediatamente ao carregar a página, sem depender de animação de scroll.

