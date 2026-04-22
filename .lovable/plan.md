

## Plano: novo Conversor de Imagens WEBP + remoção do otimizador atual

### Visão geral

1. **Novo módulo "Conversor de Imagens"** (client-side puro, com IndexedDB) substituindo Otimizador + Backfill.
2. **PiecesManager** passa a usar o motor de conversão do novo módulo: gera 3 variantes (mobile/tablet/desktop) no navegador antes de subir, grava direto em `gallery_piece_images.url` (sem `optimized_images`).
3. **Galeria pública** lê 3 variantes fixas via convenção de nomes (`{base}-mobile.webp`, `-tablet.webp`, `-desktop.webp`) — sem depender mais da tabela `optimized_images`.
4. Edge function `optimize-image`, tabelas `optimized_images` / `optimization_error_log` e bucket `optimized-images` são apagados.

---

### 1. Motor de conversão `src/lib/imageConverter.ts` (novo)

Função única reaproveitável tanto pela ferramenta quanto pelo PiecesManager:

```ts
convertImage(file: File, opts: {
  quality: number;            // 0–100
  maxWidth?: number;          // se omitido, mantém original
}): Promise<{ blob: Blob; width: number; height: number; ms: number }>
```

- `image/heic` ou `.heic` → carrega `heic2any` via `import()` (lazy) e converte para JPEG antes do canvas.
- Decode com `createImageBitmap`, encode em `OffscreenCanvas` → `convertToBlob({ type: 'image/webp', quality })`.
- Mantém proporção; usa `imageSmoothingQuality = 'high'`.
- Helper `convertResponsivePreset(file, quality)` retorna `{ mobile, tablet, desktop, original }` (480 / 768 / 1200 / sem cap).

Adicionar dependência: **`heic2any`** (lazy-loaded só quando necessário).

### 2. Página `src/pages/admin/ImageConverter.tsx` (nova)

Layout SaaS com `<Tabs>` ("Conversor" | "Histórico"):

**Tab Conversor**
- Dropzone (drag-and-drop + botão) — aceita JPG/JPEG/PNG/HEIC/WEBP.
- Lista de itens em fila; cada item:
  - Preview thumbnail + nome/dimensões/tamanho original.
  - Slider de qualidade (0–100, default 82) com atualização debounced.
  - Switch "Gerar variantes responsivas (mobile/tablet/desktop)".
  - Barra de progresso por etapa (decode → resize × N → encode).
  - Comparação lado a lado: original vs. WebP principal + delta KB e % redução.
  - Estimativa de ganho: `Carregamento ~X% mais rápido` (calculado por `1 - newSize/oldSize`).
  - Botões: **Baixar WebP**, **Baixar todas (.zip)**, **Usar no site** (placeholder/toast).
- Botão global "Converter todas" + "Baixar tudo (.zip)" usando **`jszip`** (nova dep).
- Nomenclatura automática: `nome-mobile.webp`, `nome-tablet.webp`, `nome-desktop.webp`, `nome.webp`.

**Tab Histórico**
- Lê IndexedDB (`src/lib/conversionHistoryDb.ts`, novo): store `conversions` com `{ id, name, createdAt, presets[], blobs }`.
- Tabela: nome, data, variantes, tamanho total → botões **Baixar** e **Excluir**.
- Botão "Limpar histórico".

**Feedback visual**: skeletons, spinners, toasts, animação `animate-fade-up`. Tema claro/escuro respeita o sistema (já existe via `next-themes` no app).

### 3. Substituição no `PiecesManager`

`handleUpload` e `handleCoverUpload` deixam de usar `uploadToOptimizer`. Novo fluxo via `src/lib/galleryUploader.ts` (novo):

```
file → convertResponsivePreset(quality=82)
     → upload paralelo de 3 variantes para bucket `gallery`:
        gallery/{pieceId}/{uuid}-mobile.webp
        gallery/{pieceId}/{uuid}-tablet.webp
        gallery/{pieceId}/{uuid}-desktop.webp
     → grava gallery_piece_images.url = URL pública da -desktop
       (storage_path = caminho da -desktop)
     → para capa: cover_url + cover_storage_path análogos
```

- `draftImages` perde campos `optimizedImageId / variants / status` (sempre `ready` na hora).
- Toast: "Convertido em 1.4s · −62%".
- Picker reusável (`ImagePicker`) é removido; substituído por listagem simples do bucket `gallery` se necessário.

### 4. Galeria pública sem `optimized_images`

`src/components/sections/gallery/useGalleryData.ts` e `src/lib/optimizedImageMap.ts`:

- Remover `loadOptimizedMap` / `findVariantsForUrl`.
- Nova função `deriveResponsiveVariants(url)`: dado `…/{uuid}-desktop.webp`, deriva os outros dois trocando o sufixo. Retorna 3 variantes WebP (mobile 480, tablet 768, desktop 1200) usadas pelo `<picture>`/`srcset` existente em `responsive-picture.tsx`.
- Realtime do `optimized_images` removido.
- Imagens legadas (sem sufixo `-desktop`) caem no fallback de URL única — continuam funcionando, apenas sem srcset.

### 5. Limpeza (remoção)

**Apagar arquivos:**
- `src/pages/admin/ImageOptimizer.tsx`, `src/pages/admin/BackfillRunner.tsx`
- `src/components/admin/optimizer/*` (UploadDropzone, ImagePicker, ImageRow, ImageCard, ImageDetailSheet, CodeSnippetDialog, ErrorHistoryDialog, ProcessingTimingsCard)
- `src/lib/optimizerUpload.ts`, `src/lib/optimizerBackfill.ts`, `src/lib/optimizedImageMap.ts`, `src/lib/clientWebpConverter.ts`, `src/hooks/useOptimizedImages.ts`
- `supabase/functions/optimize-image/` (e chamar `delete_edge_functions`)

**Editar `AdminShell` / `Dashboard`:**
- `AdminTab` passa a ser `"pieces" | "categories" | "reviews" | "stats" | "converter" | "user"`.
- Item de menu "Conversor" (ícone `Wand2`); Backfill removido.

**Migration SQL:**
- `DROP TABLE optimization_error_log;`
- `DROP TABLE optimized_images CASCADE;` (a função-trigger `clear_optimized_piece_link_on_delete` também é removida).
- Bucket `optimized-images` removido (`DELETE FROM storage.buckets WHERE id = 'optimized-images';` após esvaziar via storage API).
- `client_telemetry`: mantida (usada em outros lugares); apenas paramos de gravar eventos `webp_client_conversion`.

### 6. Dependências novas

- `heic2any` (lazy import)
- `jszip` (download em lote)

### 7. Validação

1. Upload JPG 5MB no Conversor → 4 WebP gerados (480/768/1200/orig), comparação mostra "−68%".
2. Upload HEIC do iPhone → converte via heic2any → mesmas 4 variantes.
3. Slider de qualidade re-encoda em < 1s e atualiza preview/tamanho.
4. "Baixar tudo" → ZIP `imagem-bundle.zip` com 4 arquivos.
5. Histórico persiste após F5; "Excluir" remove a entrada.
6. Subir capa de uma Obra → 3 arquivos `-mobile/-tablet/-desktop.webp` aparecem em `gallery/{pieceId}/`; site público mostra `<picture>` com `srcset` correto.
7. Galeria pública carrega normalmente sem `optimized_images` no banco.
8. Build TypeScript limpo (`tsc --noEmit`); nenhuma referência órfã às libs antigas.

### Arquivos resumidos

**Novos:** `src/pages/admin/ImageConverter.tsx`, `src/lib/imageConverter.ts`, `src/lib/galleryUploader.ts`, `src/lib/conversionHistoryDb.ts`, `src/components/admin/converter/{Dropzone,QueueItem,ComparePanel,HistoryTable}.tsx`.

**Editados:** `src/components/admin/AdminShell.tsx`, `src/pages/admin/Dashboard.tsx`, `src/pages/admin/PiecesManager.tsx`, `src/components/sections/gallery/useGalleryData.ts`, `src/components/ui/responsive-picture.tsx` (apenas se precisar ajustar geração de srcset), `package.json`.

**Removidos:** ver seção 5.

**Migration:** `drop_optimizer_artifacts.sql`.

