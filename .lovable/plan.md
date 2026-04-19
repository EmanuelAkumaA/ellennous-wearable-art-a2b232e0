

## Plano — Melhorias no admin de obras

### 1. DragOverlay nas imagens da obra
No `DndContext` existente em `PiecesManager.tsx`, adicionar `<DragOverlay>` com preview da imagem sendo arrastada (estado `activeId` setado em `onDragStart`, limpo em `onDragEnd`/`onDragCancel`).

### 2. Drag-and-drop nas obras (listagem)
Envolver a lista de peças em outro `DndContext` + `SortableContext` (vertical strategy). Cada linha vira `SortableItem` com handle `GripVertical`. Após drop, persistir nova `ordem` em batch (`update` em cada peça cuja ordem mudou) e atualizar estado local.
- Remover o campo "Ordem" do form de edição (item 5 do pedido).
- A `ordem` passa a ser controlada exclusivamente por drag-and-drop.

### 3. Estrela ao lado da lixeira (toggle capa ↔ imagens)
Comportamento solicitado: marcar uma imagem como capa **promove** ela pra `cover_url`/`cover_storage_path` (sai da grade de imagens), e a capa anterior **desce** pra grade de imagens.

Implementação:
- Em cada `SortableImage`, adicionar botão estrela ao lado do botão lixeira (mesmo overlay hover).
- Ao clicar:
  1. Capturar a imagem selecionada (`url`, `storage_path`).
  2. Se já existe capa atual (`cover_url` + `cover_storage_path`), inserir um novo registro em `gallery_piece_images` com esses valores (no fim da ordem).
  3. Deletar o registro de `gallery_piece_images` da imagem promovida (sem remover do storage — o arquivo continua sendo usado como capa).
  4. `update gallery_pieces set cover_url = <nova>, cover_storage_path = <nova>`.
  5. Refresh.
- A capa é mostrada apenas no bloco "Imagem capa" (já existe). Garantir que só uma imagem é capa (modelo já força isso — coluna única).
- O bloco capa atual já tem botão "Trocar capa" / "Remover capa"; mantemos.

Observação: como movemos o storage_path entre tabelas (sem re-upload), ao remover capa pelo botão "Remover capa" continuamos deletando o arquivo do storage como hoje. Ao remover uma imagem promovida a capa, o arquivo antigo da capa (que voltou pra galeria) também é tratado normalmente.

### 4. Remover campo "Ordem" do form
Tirar o input numérico `Ordem` do grid do form. Ao criar nova peça, setar `ordem = pieces.length` automaticamente.

### 5. Adicionar categoria inline no form de edição
Ao lado do `Select` de categoria, botão `+` que abre um pequeno popover/inline com `Input` + `Salvar`. Ao salvar:
- Insert em `gallery_categories` com `nome` + `ordem = categories.length`.
- Atualizar lista local de categorias.
- Auto-selecionar a nova categoria no form (`form.categoria_id = nova.id`).
- Toast de sucesso.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/pages/admin/PiecesManager.tsx` | DragOverlay; DnD nas obras; botão estrela; remoção campo ordem; categoria inline |

### Banco
Nenhuma migration nova — todas as colunas necessárias já existem (`cover_url`, `cover_storage_path`, `ordem`).

### Validação
1. Arrastar imagem dentro do form → ver preview no cursor.
2. Arrastar uma obra na listagem → confirmar persistência após reload.
3. Clicar estrela em imagem → ela sobe pra capa, capa antiga vira imagem normal.
4. Editar obra → não há mais campo Ordem.
5. No select de categoria, clicar + → digitar nome → salvar → categoria aparece selecionada.

