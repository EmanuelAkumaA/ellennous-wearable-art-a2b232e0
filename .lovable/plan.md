

## Plano

3 ajustes simples e localizados.

### 1. Obras: voltar pra lista vertical + drag só com long-press

**Arquivo**: `src/pages/admin/PiecesManager.tsx`

Hoje tem dois problemas no mobile:
- Layout em **grid** + cards com `touch-none` — qualquer toque arrasta, impedindo scroll.
- O drag handle no mobile usa `TouchSensor` com delay de 150ms, mas o card inteiro tem `touch-none`, então mesmo onde não tem handle o scroll trava.

**Mudanças:**
- Trocar grid (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`) por **lista vertical** (`flex flex-col gap-3`) no mobile, mantendo opção de grid só no desktop (`md:grid md:grid-cols-2 xl:grid-cols-3`).
- Criar variante `ListPieceCard` (ou ajustar `SortablePieceCard`) com layout horizontal no mobile: thumb pequena à esquerda + nome/categoria/#ordem à direita + botões editar/excluir.
- **Remover `touch-none`** do card raiz. Mover o `{...listeners}` do botão handle para o **card inteiro**, mas só ativar via `TouchSensor` com `delay: 1000ms` (1 segundo) e `tolerance: 5px`. Assim toque rápido faz scroll, toque longo de 1s ativa drag.
- Manter `PointerSensor` com `distance: 5` para desktop (mouse continua arrastando normalmente).
- Remover o handle visual `<GripVertical>` no mobile (fica redundante com long-press); manter no desktop.

### 2. Avaliações: tabs em grid 2x2 no mobile

**Arquivo**: `src/pages/admin/ReviewsManager.tsx` (linhas 676-686)

Hoje as 3 tabs ficam em linha e estouram no mobile.

**Mudança:** trocar `<TabsList>` para usar `grid grid-cols-2 sm:flex sm:w-auto h-auto gap-1 w-full`. Aprovadas ocupa as 2 colunas da primeira linha (`col-span-2`), Pendentes e Recusadas ficam lado a lado na segunda linha. Cada tab com `w-full` para preencher.

Resultado:
```
[      Aprovadas      ]
[Pendentes][Recusadas ]
```

### 3. "Gerar link de avaliação": reorganizar header

**Arquivo**: `src/pages/admin/ReviewsManager.tsx` (linhas 539-549)

Hoje o `CardHeader` usa `flex-row items-center justify-between`, fazendo o botão "Ver página base" ficar lado a lado com o título — quebra no mobile.

**Mudança:** trocar para `flex-col gap-3` — título "Gerar link de avaliação" sozinho na primeira linha, e numa segunda linha um wrapper `flex justify-end` com o botão "Ver página base" alinhado à direita.

---

## Arquivos a modificar
- `src/pages/admin/PiecesManager.tsx` — lista vertical no mobile + long-press 1s pra drag
- `src/pages/admin/ReviewsManager.tsx` — tabs em grid 2x2 no mobile + header do gerar link em 2 linhas

## Validação
1. **Mobile (390px) em /admin/pieces**: scroll vertical funciona com toque normal; segurar 1s em cima de uma obra ativa o drag e permite reordenar.
2. **Mobile em /admin/reviews**: tabs aparecem em grid 2x2; "Gerar link de avaliação" tem título em cima e botão "Ver página base" embaixo à direita.
3. **Desktop**: tudo continua funcionando como antes (grid de obras, tabs em linha, header em uma linha).

