
## Plano

O usuário quer botões de mover ↑/↓ ao lado de cada obra no mobile, como alternativa ao long-press drag (que é menos descoberto). Ao clicar na seta, a obra troca de posição com a vizinha (acima ou abaixo).

### Mudanças em `src/pages/admin/PiecesManager.tsx`

**1. Adicionar handler de "mover por clique"**
Já existe a função `handleDragEnd` que usa `arrayMove` e persiste via `update_pieces_order`. Vou criar uma função reutilizável:

```ts
const movePiece = (currentIndex: number, direction: "up" | "down") => {
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= filteredPieces.length) return;
  // arrayMove + persist (mesmo fluxo do handleDragEnd)
};
```

Importante: como há filtro/busca, mover deve operar sobre a lista **filtrada visível** mas persistir respeitando os ids — mesma lógica do drag atual.

**2. Adicionar 2 botões ao card (variante mobile)**
Ao lado da thumb/handle, na coluna mobile, dois botões pequenos empilhados:
- `<ChevronUp>` — desabilitado se for o primeiro
- `<ChevronDown>` — desabilitado se for o último

Tamanho compacto (`h-7 w-7` cada), `variant="outline"`, com `aria-label="Mover para cima/baixo"`.

**3. Manter long-press drag funcionando**
Os botões são adicionais, não substituem. Quem preferir arrastar segura 1s; quem preferir clicar usa as setas. No desktop, manter o `GripVertical` + drag normal.

**4. Posicionamento no card mobile**
Layout horizontal atual: `[thumb] [info] [editar][excluir]`. Vou inserir as setas entre info e os botões de ação, ou logo após a thumb. Decisão: **após a thumb**, alinhadas verticalmente, para virar o "controle de ordem" claro.

```
┌─────────────────────────────────────────────┐
│ [thumb] [↑] Nome da obra        [edit][del] │
│         [↓] Categoria · #01                 │
└─────────────────────────────────────────────┘
```

No desktop (grid de cards), manter como está — só drag handle, sem setas (espaço já é grande e drag funciona bem com mouse).

**5. Feedback visual**
Reutilizar o mesmo `setItems` otimista + `update_pieces_order` que o drag já faz. Toast de sucesso/erro idêntico.

### Arquivo a modificar
- `src/pages/admin/PiecesManager.tsx`

### Validação (390px, /admin/pieces)
- Cada obra tem ↑ e ↓ ao lado da thumb
- Clicar ↑ na primeira obra: botão desabilitado (não faz nada)
- Clicar ↓ na última obra: botão desabilitado
- Clicar ↑ no meio: troca com a obra acima, número #N atualiza, persiste no banco
- Long-press drag continua funcionando em paralelo
- Desktop sem mudanças visuais nos cards
