

## Plano: 4 melhorias no Otimizador + backfill da galeria

### 1. Filtro "Apenas inativas (órfãs)" no Otimizador

**Arquivo:** `src/pages/admin/ImageOptimizer.tsx`

- Novo estado `statusFilter: "all" | "active" | "orphan"` ao lado dos filtros de ordenação.
- Pílulas/tabs adicionais: **Todas · Na galeria · Órfãs**.
- Lógica do `filtered`: imagem é "órfã" quando `pieceLinks.get(id)` é nulo **e** `used_count === 0`.
- Quando `statusFilter === "orphan"`, expor um botão extra na barra de bulk: **"Selecionar todas órfãs"** (seleciona todas as visíveis filtradas → permite excluir em massa com 1 clique).

### 2. Chips por dispositivo com economia (% smaller)

**Arquivo:** `src/components/admin/optimizer/ImageRow.tsx`

- Cada `DeviceChip` (Mob/Tab/Desk) recebe uma nova linha de info com a economia comparada ao **original**:
  ```
  📱 Mob   42 KB   −78%
  💻 Tab   98 KB   −52%
  🖥 Desk  180 KB  −12%
  ```
- Cálculo: `savedPct = round((original_size_bytes − variant.size_bytes) / original_size_bytes * 100)`. Se negativo (variante maior que original — raro em widths altos), mostra `+X%` em amber.
- Cor: verde para >50%, amber para 0–50%, destrutivo para crescimento.
- Tooltip já existente passa a mostrar `{width}px · {format} · {original_size_bytes - variant.size_bytes formatBytes} economizados`.

### 3. Botão "Reaproveitar imagem do histórico" no modal de obras

**Arquivo:** `src/pages/admin/PiecesManager.tsx` + novo `src/components/admin/optimizer/ImagePicker.tsx`

- No modal de obra, abaixo do botão de upload de **Galeria** e da seção de **Capa**, novo botão secundário: **"Reaproveitar do histórico"** (ícone `Library` ou `History`).
- Clicar abre um `Dialog` (`ImagePicker`) com:
  - Busca por nome/ID
  - Filtro `status='ready'`, ordenação por mais recentes
  - Grid de thumbnails 80×80 com checkbox para múltipla seleção
  - Indicador visual quando já vinculada a outra obra ("Vinculada à obra X" — ainda assim selecionável: a vinculação se torna "compartilhada")
  - Botão **Adicionar (N)** no rodapé
- Ao confirmar:
  - Para uso na **galeria**: cria draft `DraftImage` para cada imagem escolhida, reusando `optimizedImageId`, `originalPath`, `variants` e a melhor URL — não faz upload novo.
  - Para uso como **capa**: separar com toggle no topo do picker (Capa | Galeria). Modo capa permite selecionar 1.
- No save da obra: insere normalmente em `gallery_piece_images` usando a melhor URL. Não sobrescreve `optimized_images.piece_id` se já houver um (preserva vínculo original); pode usar coluna nova `used_count` incrementando para sinalizar reuso.

### 4. Backfill: otimizar todas as 8 imagens já existentes na galeria

**Migração de dados via script no admin** (executável uma vez), arquivo novo: `src/pages/admin/BackfillRunner.tsx` — botão escondido no Dashboard ou rodando no mount do Otimizador caso `optimized_images.piece_id` ainda não cubra `gallery_piece_images`.

Fluxo automatizado (para cada `gallery_piece_images` cuja `storage_path` ainda não está no Otimizador):
1. Baixa o blob da URL pública (`fetch`).
2. Reconstrói um `File` e roda `uploadToOptimizer({ file, pieceId, role: 'gallery' })` — mesma função usada no modal.
3. Após processado, atualiza `gallery_piece_images.url` para o JPEG 1200w novo (`getBestUrlForPiece`) e `storage_path` para o caminho otimizado. Mantém o original em `gallery/seed/` intocado (sem deletar — segurança).
4. Para `cover_url` de `gallery_pieces`, repete o fluxo com `role: 'cover'` e atualiza `cover_url` + `cover_storage_path`.

UI do backfill (página `/admin/backfill` ou banner no Otimizador):
- Lista as imagens detectadas como "antigas" (`storage_path` começa com `seed/` ou bucket = gallery)
- Botão **"Otimizar todas (N)"** com barra de progresso e concorrência 2
- Linha por linha mostra status: pendente → enviando → otimizando → pronto → URL atualizada
- Idempotente: se rodar de novo, pula imagens já vinculadas

Após o backfill, `useGalleryData` (que já faz matching por basename) automaticamente serve as variantes AVIF/WebP no carrossel e nos thumbnails da grade.

---

### Detalhes técnicos

- **Filtro "órfã" precisa do `pieceLinks`**: já está carregado em `ImageOptimizer.tsx`. Sem custo extra.
- **% smaller**: `original_size_bytes` já existe na row; só precisa do cálculo no chip.
- **ImagePicker modal**: reutiliza a mesma listagem do Otimizador (consulta `optimized_images` `status='ready'`), evita duplicar lógica criando hook `useOptimizedImages({ readyOnly: true })`.
- **Backfill: por que client-side?** A edge function `optimize-image` exige que o original já esteja no bucket `optimized-images`. O cliente baixa do `gallery` bucket (público), reupload para `optimized-images`, e dispara a edge function — exatamente o caminho do upload normal.
- **Atualização de URL não quebra nada**: o `useGalleryData` já trata fallback por basename; manter a URL antiga também funcionaria, mas atualizar para a JPEG otimizada melhora o LCP do fallback `<img>` interno do `<picture>`.

### Arquivos modificados/criados

**Novos:**
- `src/components/admin/optimizer/ImagePicker.tsx` — dialog de seleção
- `src/pages/admin/BackfillRunner.tsx` — UI de backfill (linkada no Dashboard como aba ou rota `/admin/backfill`)
- `src/lib/optimizerBackfill.ts` — helper que detecta + processa imagens antigas

**Editados:**
- `src/pages/admin/ImageOptimizer.tsx` — filtro órfãs + tabs
- `src/components/admin/optimizer/ImageRow.tsx` — chips com `−X%`
- `src/pages/admin/PiecesManager.tsx` — botão "Reaproveitar do histórico" + integração com `ImagePicker`
- `src/pages/admin/Dashboard.tsx` — registrar nova aba/rota do Backfill (provisório, removível depois)

### Validação

1. **Filtro órfãs**: clicar em "Órfãs" → lista só imagens sem `piece_id` e `used_count=0`. Clicar "Selecionar todas órfãs" → "Excluir (N)" → todas somem.
2. **% por chip**: ler chip Mobile mostra ex. `−78%` em verde; passando o mouse vê `400px · JPEG · 142 KB economizados`.
3. **Reaproveitar**: criar nova obra, abrir picker, escolher 2 imagens existentes, salvar → `gallery_piece_images` recebe rows com URLs já otimizadas; nenhum upload novo aparece no Otimizador.
4. **Backfill**: rodar uma vez → 8 imagens da galeria atual viram 8 rows `optimized_images` com `status='ready'` e `piece_id` setado; ao recarregar o site público, Network mostra AVIF/WebP em mobile e 1200w JPG em desktop para todas as obras.

