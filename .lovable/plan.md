
## Plano

Dois ajustes pontuais.

### 1. Reverter imagem do Hero

Voltar para a imagem original do homem (`hero-ellennous.jpg` ou o arquivo anterior). Em `src/components/sections/Hero.tsx`:
- Trocar `import heroImage from "@/assets/hero-ellennous-aero.png"` de volta para o asset original.
- Restaurar o `alt` antigo.

Preciso confirmar qual era o arquivo anterior — vou verificar o histórico/assets disponíveis ao executar. Pelo código atual o anterior era `@/assets/hero-ellennous.jpg`.

### 2. Desativar drag por toque no mobile (apenas setas reordenam)

**Problema**: hoje o `SortablePieceCard` no mobile usa o `TouchSensor` do dnd-kit (long-press 1s). Mesmo com delay, isso pode interferir/segurar o scroll e o usuário não quer essa interação no celular — só as setas ↑/↓.

**Solução em `src/pages/admin/PiecesManager.tsx`**:
- Detectar se é mobile via `useIsMobile()` (hook já existe em `src/hooks/use-mobile.tsx`).
- No mobile: **não** registrar `TouchSensor` nem aplicar `attributes`/`listeners` do dnd-kit nos cards. Renderizar os cards sem o wrapper sortable (ou com `disabled: true` no `useSortable`).
- Remover `touch-action: none` / `touch-none` dos cards no mobile — assim o scroll vertical com o dedo funciona naturalmente em qualquer parte do card.
- Manter `PointerSensor` ativo apenas no desktop (drag com mouse continua funcionando lá).
- As setas ↑/↓ continuam sendo o único meio de reordenar no celular (já implementadas).

A animação FLIP de slide continua funcionando normalmente porque ela é independente do dnd-kit.

### Arquivos a modificar
- `src/components/sections/Hero.tsx`
- `src/pages/admin/PiecesManager.tsx`

### Validação
1. **Home (/)**: hero volta a mostrar a foto original do homem com a jaqueta.
2. **/admin/pieces no celular**: passar o dedo verticalmente sobre qualquer card faz scroll normalmente, sem ativar drag. Só clicando nas setas ↑/↓ a obra muda de posição (com slide animado).
3. **Desktop**: drag-and-drop com mouse continua funcionando normalmente.
