

## Plano: Fade no accordion + memória da seção aberta

### 1. Animação fade no conteúdo do accordion

Hoje o `AccordionContent` já tem o slide (`accordion-down`/`accordion-up`), mas só anima a altura. Vamos adicionar opacidade ao keyframe para o conteúdo aparecer suavemente além do slide.

**Arquivo:** `tailwind.config.ts`

Atualizar os keyframes existentes:

```ts
"accordion-down": {
  from: { height: "0", opacity: "0" },
  to:   { height: "var(--radix-accordion-content-height)", opacity: "1" },
},
"accordion-up": {
  from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
  to:   { height: "0", opacity: "0" },
},
```

E suavizar a duração das animações para ficar mais elegante:

```ts
"accordion-down": "accordion-down 0.3s ease-out",
"accordion-up":   "accordion-up 0.25s ease-out",
```

Nenhuma mudança no componente `accordion.tsx` é necessária — as classes `data-[state=open]:animate-accordion-down` já estão lá.

### 2. Memória da seção aberta por obra

A última seção aberta de cada obra fica salva em `localStorage` sob a chave `ellennous:gallery:lastSection:<pieceId>`. Ao reabrir o modal da mesma obra, o accordion abre direto naquela seção. Se a obra nunca foi aberta antes (ou a seção salva não existe mais no conteúdo), cai no comportamento atual: abre "Descrição" (ou o primeiro campo disponível).

**Arquivo:** `src/components/sections/gallery/Gallery.tsx`

Implementação:

1. Criar um pequeno helper `getStoredSection(pieceId)` / `setStoredSection(pieceId, value)` com try/catch para `localStorage` (SSR-safe + privacy mode).

2. Substituir o `defaultValue` (estático no primeiro render) por um `value` controlado:
   - Estado local `const [openSection, setOpenSection] = useState<string | undefined>(undefined)`.
   - `useEffect` que dispara quando `selected` muda: lê do localStorage, valida que a seção ainda tem conteúdo na obra atual, senão escolhe o primeiro disponível (`descricao` → `conceito` → `historia` → `tempo`).
   - `onValueChange` do `Accordion` salva no localStorage e atualiza estado.

3. Salvar **string vazia** quando o usuário fecha tudo (Radix passa `""` em `type="single" collapsible`), para respeitar a escolha de "tudo fechado" na próxima abertura.

### Detalhes técnicos

- Chave de storage prefixada (`ellennous:gallery:lastSection:`) para não colidir com outros dados.
- Validação ao restaurar: se a seção salva for `historia` mas a obra não tem `historia` preenchido, fazemos fallback automático para o primeiro campo disponível em vez de abrir vazio.
- O `useEffect` depende apenas de `selected?.id` para evitar re-execução quando o objeto é recriado mas o id é o mesmo.
- A animação de fade fica visível tanto na abertura quanto no fechamento, sincronizada com a transição de altura existente.

### Arquivos modificados

- `tailwind.config.ts` — keyframes do accordion com opacidade + duração ajustada
- `src/components/sections/gallery/Gallery.tsx` — accordion controlado + persistência por obra

