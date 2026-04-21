

## Plano: integrar otimização ao modal de "Nova obra" + reformular histórico do Otimizador

### O que muda na UX

**Antes:** Cria obra → salva → reabre → faz upload de capa/imagens em outro bucket (`gallery`) → não otimiza.

**Depois:** Abre "Nova obra" → preenche identidade + capa + galeria (tudo no mesmo modal, mesmo antes de salvar) → ao soltar uma imagem ela já vai para o pipeline do Otimizador em segundo plano → quando salvar, a obra é criada e as imagens (já otimizadas ou em processamento) são vinculadas.

---

### Parte 1 — Modal "Nova obra" gerencia capa + galeria desde o início

**Arquivo:** `src/pages/admin/PiecesManager.tsx`

- **Remover** o botão `"Criar e gerenciar imagens"` como rótulo e a lógica `{editing && (…)}` que esconde as seções **Capa** e **Galeria** durante a criação. Essas seções passam a aparecer sempre.
- Botão final do modal vira simplesmente **"Salvar obra"** / **"Salvar alterações"**.
- Para suportar "obra ainda não criada", adicionar estado local `draftPieceId: string | null` — gerado com `crypto.randomUUID()` no momento que o usuário abre "Nova obra". Esse ID é usado tanto para o caminho do storage quanto como `id` da row de `gallery_pieces` no momento do save (passamos o id explícito no insert).
- Adicionar estado local `draftCover` e `draftImages` (arrays em memória) que armazenam:
  - `{ optimizedImageId, name, previewUrl, status, ordem }` para cada imagem subida
  - Antes de salvar a obra, ficam só no estado React.
  - No momento do save: insere `gallery_pieces` com o `draftPieceId` e em seguida insere as `gallery_piece_images` (e atualiza `cover_url`) usando as URLs **das variantes otimizadas** (jpeg 1200w como `url`, ou fallback para original enquanto estiver processando).

**Fluxo de upload no modal (substitui `handleUpload` e `handleCoverUpload`):**

1. User seleciona arquivo(s) no modal.
2. Cliente roda exatamente o mesmo fluxo do `UploadDropzone` atual, mas marcando metadados extras (ver Parte 3): sobe original em `optimized-images/images/{newId}/original.{ext}`, insere row em `optimized_images` com `status='processing'` + `piece_draft_id = draftPieceId` + `image_role = 'cover' | 'gallery'`, dispara `optimize-image` em background.
3. Adiciona à lista local `draftImages` (ou define `draftCover`) com preview imediato (object URL + URL pública do original).
4. Realtime channel já existente em `useGalleryData` cobre o site público. No modal, dispara `setDraftImages` reactivo escutando `optimized_images` para `piece_draft_id = draftPieceId` para atualizar o preview quando ficar `ready`.

**Ao salvar obra:**

- `INSERT INTO gallery_pieces (id, ...)` com `draftPieceId`.
- Para cada imagem no `draftImages`: `INSERT INTO gallery_piece_images (piece_id, url, storage_path, ordem)` onde `url` é a **JPEG 1200w** otimizada (ou a URL pública do original como fallback se ainda processando — o map por basename do `useGalleryData` já cuida de servir variantes assim que ficarem prontas).
- Para a capa: atualiza `cover_url` da row recém-criada.
- Atualiza no banco: `optimized_images SET piece_id = draftPieceId, used_count = 1` para todas as imagens vinculadas (marca como "ativas").

**Ao editar uma obra existente:** mesma UI; uploads novos seguem o mesmo fluxo, mas usando o `editing.id` no lugar de `draftPieceId`.

---

### Parte 2 — Histórico do Otimizador em modo lista, com aparelhos e marcador ativo/desativado

**Arquivo:** `src/pages/admin/ImageOptimizer.tsx`

- Manter as estatísticas e a barra de bulk no topo. Remover a `UploadDropzone` (uploads agora vêm do modal de obras). Manter aviso explicando que o upload migrou.
- Adicionar **toggle de visualização** (Grid / Lista) ao lado dos filtros. Padrão: **Lista** (atende ao briefing).

**Novo componente:** `src/components/admin/optimizer/ImageRow.tsx`
- Layout: `flex` de uma linha por imagem
- Coluna 1 — **Pré-via** (thumb 64×64) usando a variante webp 400w
- Coluna 2 — **Nome + ID truncado**
- Coluna 3 — **Tamanhos por aparelho** (3 chips lado a lado):
  - 📱 **Mobile**: tamanho da JPEG 400w (ex: `42 KB`)
  - 💻 **Tablet**: JPEG 800w (ex: `98 KB`)
  - 🖥️ **Desktop**: JPEG 1200w (ex: `180 KB`)
  - cada chip mostra `{width}px · {format}` no hover
- Coluna 4 — **Marcador ativo/desativado**: 
  - Switch (`@/components/ui/switch`) que reflete `used_count > 0` e/ou existência da row vinculada em `gallery_piece_images` por basename
  - Label visual: ✅ "Na galeria" (verde) ou ⭕ "Inativa" (cinza)
  - Toggle só altera `used_count` (não remove da obra) — clicável apenas quando a imagem **não está vinculada a uma obra**; quando vinculada, vira readonly com tooltip "Vinculada à obra X"
- Coluna 5 — Ações compactas (Código, Detalhes, Reprocessar, Excluir) — ícones só, sem texto
- Checkbox de seleção idêntico ao do `ImageCard` no canto esquerdo

**Detecção de "ativo" (vinculação real):** carregar uma vez no mount um `Map<optimizedImageId, { pieceId, pieceName }>` consultando `gallery_piece_images` + `gallery_pieces` e cruzando por `piece_id` da `optimized_images` (nova coluna — Parte 3) ou, fallback, por basename matching com URLs em `gallery_piece_images`/`cover_url`. Esse map alimenta o badge "Vinculada à obra X".

---

### Parte 3 — Pequeno schema add (sem migration de dados, só colunas opcionais)

**Migration nova:**
```sql
alter table public.optimized_images
  add column if not exists piece_id uuid,
  add column if not exists image_role text;  -- 'cover' | 'gallery' | null (uploads avulsos do dropzone, retro)

create index if not exists idx_optimized_images_piece_id
  on public.optimized_images(piece_id);
```

Sem FK para evitar bloqueio quando uma obra é deletada (a row da imagem otimizada pode sobreviver como histórico). Quando uma obra é apagada, um trigger `on delete` em `gallery_pieces` opcionalmente zera `piece_id` (incluído na migration).

Esse vínculo direto torna o histórico do Otimizador 100% determinístico: "esta imagem pertence à obra X" ↔ status ativo no marcador.

---

### Parte 4 — Limpeza/auxiliares

- **Remover** o `UploadDropzone` da `ImageOptimizer.tsx` (uploads passam a vir do modal de obras). O componente em si pode ficar no projeto (não removo), mas a aba não exibe mais.
- Adicionar no topo da aba um aviso curto:  
  > _As imagens são enviadas pelo modal de cada obra em **Criar e gerenciar Imagens**. Esta tela mostra o histórico e o estado de otimização._
- O snippet de copiar continua funcionando como hoje (útil para usos avulsos no futuro).

---

### Arquivos modificados / criados

**Novos:**
- `supabase/migrations/{timestamp}_optimized_images_piece_link.sql`
- `src/components/admin/optimizer/ImageRow.tsx` — visualização em lista

**Editados:**
- `src/pages/admin/PiecesManager.tsx` — modal mostra Capa + Galeria sempre; novo fluxo de upload integrado ao Otimizador; estado de draft
- `src/pages/admin/ImageOptimizer.tsx` — toggle Grid/Lista, remove dropzone, banner explicativo, fetch de vínculo com obras
- `src/components/admin/optimizer/ImageCard.tsx` — apenas pequeno ajuste para receber `pieceLink` e mostrar tag "Obra: X"
- `src/integrations/supabase/types.ts` — gerado automaticamente pela migration

### Validação

1. **Modal nova obra**: ao abrir, seções "Capa" e "Galeria" aparecem imediatamente. Subir 3 imagens → cada uma já entra no Otimizador com `status='processing'` e `image_role='gallery'`. Salvar → `gallery_pieces` é criada e `gallery_piece_images` ficam vinculadas. Ao recarregar a página pública, as imagens são servidas em AVIF/WebP via o map por basename.
2. **Capa no modal**: subir 1 imagem na seção Capa → `image_role='cover'`. Ao salvar, `cover_url` aponta para a JPEG 1200w (ou original como fallback temporário). Ao terminar a otimização, `<picture>` no carrossel/grid já serve as variantes.
3. **Histórico em lista**: aba Otimizador no modo lista mostra cada imagem com pré-via, três chips de peso (mobile/tablet/desktop) e o switch ✅ "Na galeria" ativo para imagens que vieram via modal de obras. Imagens antigas avulsas aparecem como ⭕ "Inativa".
4. **Excluir obra**: trigger zera `piece_id` da row otimizada → switch passa a "Inativa" mas o histórico mantém o registro.
5. **Mobile**: todo o fluxo funciona em viewport 390px (lista vira cards empilhados em `< sm`).

