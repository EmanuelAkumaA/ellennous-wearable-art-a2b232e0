

## Plano — Indicadores de drop, DnD em categorias, busca, usuário e estatísticas

### 1. Indicador visual de drop (drag-and-drop)
Em todos os `SortableItem` (imagens da obra, lista de obras, lista de categorias), adicionar:
- `isOver` do `useSortable` → borda/linha de destaque no slot alvo.
- Para grade (imagens): borda lateral esquerda 2px na cor `primary`.
- Para listas verticais (obras/categorias): linha horizontal 2px na cor `primary` no topo do item alvo.
- Item sendo arrastado fica com `opacity-40` (já existe nas imagens; aplicar igual nas obras e categorias).

### 2. Drag-and-drop em categorias
Em `src/pages/admin/CategoriesManager.tsx`:
- Envolver `<ul>` em `DndContext` + `SortableContext` (vertical).
- Cada `<li>` vira `SortableCategory` com handle `GripVertical`.
- Ao soltar, recalcular `ordem` e fazer `update` em batch das que mudaram.
- Remover/ocultar o input "Ordem" (passa a ser controlado por DnD). Manter no form de criação opcionalmente — vou remover para consistência; a nova categoria entra com `ordem = items.length`.

### 3. Busca/filtro na listagem de obras
Em `PiecesManager.tsx`, acima da lista:
- `Input` de busca por nome (filtra client-side, case-insensitive).
- `Select` de categoria ("Todas" + categorias existentes).
- Botão "Limpar".
- A lista filtrada é o que entra no `SortableContext`. **Importante:** quando há filtro ativo, desabilitar drag (ordem só faz sentido com lista completa) e mostrar aviso pequeno "Reordenação desativada com filtros".

### 4. Aba "Usuário" — alterar senha
Nova `TabsTrigger` em `Dashboard.tsx`. Conteúdo: novo componente `src/pages/admin/UserSettings.tsx` com:
- Mostra email atual (`user.email`).
- Form: "Nova senha" + "Confirmar nova senha" → `supabase.auth.updateUser({ password })`.
- Validação mínima 6 caracteres + match.
- Toast de sucesso/erro.

### 5. Aba "Estatísticas" — métricas de obras
**Banco** (nova migration):
- Tabela `gallery_piece_events`:
  - `id uuid pk default gen_random_uuid()`
  - `piece_id uuid not null` (referência lógica a `gallery_pieces`)
  - `event_type text not null check in ('modal_open','cta_click','modal_close')`
  - `session_id text not null` (gerado client-side, persistido em `sessionStorage`)
  - `duration_ms integer` (preenchido só em `modal_close`)
  - `created_at timestamptz default now()`
- Índices em `(piece_id)` e `(event_type)`.
- RLS:
  - `INSERT` público (anon + authenticated) com `with check (true)` — site é público, precisamos coletar de visitantes.
  - `SELECT` apenas admin.

**Tracking (frontend público)**:
- `ZoomOverlay.tsx` (modal da obra):
  - Ao abrir: insert `modal_open` + guarda timestamp local.
  - Ao fechar: insert `modal_close` com `duration_ms`.
- Botão "Quero algo nesse nível" (CTA dentro do modal — vou localizar; provavelmente em `ZoomOverlay` ou `PieceCarousel`):
  - On click: insert `cta_click`.
- `session_id`: helper `getSessionId()` em `src/lib/session.ts` — `sessionStorage` ou gera novo `crypto.randomUUID()`.

**Estatísticas (admin)**:
- Novo componente `src/pages/admin/StatsManager.tsx`.
- Faz 1 query agregada via `supabase.rpc` ou client-side reduce sobre os eventos (limite 5000 últimos eventos para começar; depois podemos criar uma view).
- Mostra tabela ordenável por:
  - Obra (nome + categoria)
  - Aberturas do modal (count `modal_open`)
  - Cliques no CTA (count `cta_click`)
  - Tempo médio no modal (avg `duration_ms` onde > 0)
  - Taxa de conversão (cta_click / modal_open)
- Filtro por período (últimos 7d / 30d / 90d / tudo).

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/pages/admin/CategoriesManager.tsx` | DnD + indicador |
| `src/pages/admin/PiecesManager.tsx` | indicadores; busca/filtro |
| `src/pages/admin/Dashboard.tsx` | 2 abas novas (Usuário, Estatísticas) |
| `src/pages/admin/UserSettings.tsx` | novo — alterar senha |
| `src/pages/admin/StatsManager.tsx` | novo — métricas |
| `src/lib/session.ts` | novo — session id |
| `src/components/sections/gallery/ZoomOverlay.tsx` | tracking de open/close/CTA |
| `src/components/sections/gallery/PieceCarousel.tsx` | possível ajuste se CTA mora aqui |
| nova migration | tabela `gallery_piece_events` + RLS + índices |

### Validação
1. Arrastar imagem/obra/categoria → ver linha azul indicando onde vai cair.
2. Reordenar categorias → recarregar → persistido.
3. Buscar "rosa" → só obras com "rosa" no nome aparecem; mudar categoria filtra.
4. Aba Usuário → alterar senha → relogar com nova senha.
5. Abrir e fechar modais de obras no site público; clicar no CTA.
6. Aba Estatísticas → ver contagens, tempo médio, conversão; filtro por período funciona.

