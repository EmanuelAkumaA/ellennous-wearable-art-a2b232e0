
## Plano — Campo "Imagem capa" nas obras

### Objetivo
Permitir que o admin defina explicitamente qual imagem é a capa da obra (mostrada nos cards da galeria e na lista do admin), em vez de sempre usar a primeira imagem por ordem.

### Mudanças no banco
Adicionar coluna `cover_image_id` (uuid, nullable) em `gallery_pieces` referenciando uma imagem de `gallery_piece_images`. Sem FK rígida (pra evitar problemas de ordem de delete) — limpamos via trigger quando a imagem capa é removida.

- Migration:
  - `ALTER TABLE gallery_pieces ADD COLUMN cover_image_id uuid;`
  - Trigger `BEFORE DELETE` em `gallery_piece_images`: se a imagem deletada é capa de alguma peça, setar `cover_image_id = NULL`.
  - Backfill: para peças existentes, setar `cover_image_id` = id da imagem com menor `ordem`.

### Mudanças no admin (`src/pages/admin/PiecesManager.tsx`)
- Incluir `cover_image_id` no `Piece`, `form` e payload de save.
- Na grade de imagens (dentro do form de edição), em cada card adicionar um botão "Definir como capa" (ícone estrela). A imagem capa atual recebe um badge "CAPA" e borda destacada.
- Ao clicar em "definir capa": update direto em `gallery_pieces.cover_image_id` + refresh local.
- Ao remover imagem que é capa: trigger do banco já limpa; UI re-fetch.
- Na listagem de obras, o thumbnail usa `cover_image_id` se existir, senão fallback pra primeira por ordem.

### Mudanças na galeria pública (`src/components/sections/gallery/useGalleryData.ts`)
- Selecionar `cover_image_id` e expor `capa: string` no `PieceData` (URL da imagem capa, ou primeira como fallback).
- Verificar consumidores (`PieceCarousel`, `Gallery`) e usar `capa` no thumbnail/preview, mantendo `imagens[]` para o carrossel interno.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| migration nova | adiciona coluna + trigger + backfill |
| `src/pages/admin/PiecesManager.tsx` | UI "definir capa", thumb usa capa |
| `src/components/sections/gallery/useGalleryData.ts` | expõe campo `capa` |
| `src/components/sections/gallery/PieceCarousel.tsx` (e/ou `Gallery.tsx`) | usa `capa` no card |

### Notas
- Não é um campo de upload separado: a "capa" é uma das imagens já enviadas, marcada como capa. Isso evita duplicação de upload e mantém consistência. Se você quiser literalmente um upload separado e independente das outras imagens, me avise que eu mudo a abordagem (coluna `cover_url` + `cover_storage_path` próprios).
