

## Plano: Transformar campos da obra em accordion

### Comportamento

No modal de detalhes da obra (Galeria), os 4 campos de texto vão virar um accordion:

- **Descrição** — aberto por padrão
- **Conceito** — fechado
- **História** — fechado
- **Tempo de produção** — fechado

Comportamento "single": ao clicar em um item, ele abre e os outros fecham automaticamente. Clicar no item já aberto também fecha (permitindo todos fechados).

Visual: cada item mantém o label em maiúsculas (`tracking-wider`, `text-muted-foreground`) que já existe, agora clicável com um chevron à direita que rotaciona ao abrir. Borda sutil entre itens para separação visual.

### Implementação

**Arquivo único modificado**: `src/components/sections/gallery/Gallery.tsx`

- Importar `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` de `@/components/ui/accordion` (já existe no projeto).
- Substituir o bloco `<div className="space-y-5 text-sm">` (linhas que renderizam os 4 campos) por um `<Accordion type="single" collapsible defaultValue="descricao">`.
- Cada campo vira um `<AccordionItem value="...">` renderizado **somente se o conteúdo existir** (mantém a lógica condicional atual).
- O `AccordionTrigger` recebe o label estilizado (uppercase, tracking, cor muted) — sobrescrevendo o `font-medium hover:underline` padrão para combinar com o design existente.
- O `AccordionContent` recebe o texto com as classes atuais (`text-foreground/90 leading-relaxed`, e `whitespace-pre-line` para a história).
- Bordas: usar a `border-b` que o `AccordionItem` já traz; ajustar a cor para `border-border/40` via className para combinar com o tom da modal.

### Detalhes técnicos

- `defaultValue="descricao"` garante que descrição abre por padrão. Se a obra **não tiver descrição**, o accordion abre vazio (nenhum item) — isso é aceitável e consistente com o comportamento atual de não renderizar campos vazios.
- `collapsible` permite fechar o item ativo clicando nele de novo.
- O chevron padrão do `AccordionTrigger` (já existe no componente shadcn) é mantido — combina bem com o estilo minimalista.

### Arquivo
- `src/components/sections/gallery/Gallery.tsx`

