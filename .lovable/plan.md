

## Plano: Barra de progresso com ETA/velocidade + visualização e gestão por dispositivo

### 1. Barra agregada da fila — `QueueProgressBar`

Adicionar telemetria em tempo real:

- **Percentual estimado**: média ponderada do progresso de cada item (não só "concluídos / total"). Itens em andamento contribuem com seu `progress` parcial.
- **Velocidade**: itens/min calculados a partir do timestamp do primeiro `done`/`error` até agora. Atualiza a cada segundo via `useEffect` + `setInterval`.
- **ETA**: `(restantes / velocidade) * 60s` → exibido como `~ 2 min 30 s`. Esconde quando < 2 amostras (precisa de pelo menos 1 conclusão para estimar).
- Layout (uma linha extra):
  ```text
  Progresso da fila    3 de 7   · 1 em andamento · 1 falha
  ████████░░░░░░░  47%
  ⚡ 8 img/min   ⏱ ~ 30 s restantes
  ```

Para isso, `ImageConverter` passa também `itemProgress: Record<id, percent>` e `completionTimes: number[]` ao `QueueProgressBar`. `QueueItem` chama `onProgressChange(id, percent)` em cada `setProgress`.

### 2. Cartão do `QueueItem` — variantes por dispositivo (lista visual)

Após `done`, exibir uma seção nova "Variantes geradas" abaixo do `ComparePanel`:

```text
┌──────────┬──────────┬──────────┐
│ 📱 MOBILE│ 💻 TABLET│ 🖥 DESKTOP│
│ thumb    │ thumb    │ thumb    │
│ 480×360  │ 768×576  │ 1200×900 │
│  18 KB   │  42 KB   │  96 KB   │
│ [baixar] │ [baixar] │ [baixar] │
└──────────┴──────────┴──────────┘
```

Cada thumb usa `URL.createObjectURL(preset[key].blob)`, com cleanup no unmount. Botão "baixar" individual por variante. Quando `responsive=false`, mostra apenas o card "original".

### 3. Aba Galeria — visualização explícita das 3 variantes por imagem

Hoje cada `gallery_piece_images` mostra **uma** thumb (a desktop) e três **badges** de toggle. Vamos transformar em **3 cards lado a lado por dispositivo** dentro do mesmo registro de imagem:

```text
Imagem #2 (registro lógico)
┌─ 📱 Mobile ─────┐ ┌─ 💻 Tablet ────┐ ┌─ 🖥 Desktop ───┐
│ [thumb 480]    │ │ [thumb 768]    │ │ [thumb 1200]   │
│ ✓ Ativa        │ │ ✓ Ativa        │ │ ✓ Ativa        │
│ ⭐ Capa Mobile │ │ ⭐ Capa Tablet │ │ ⭐ Capa Desktop│
│ [↗ mover]  [🗑]│ │ [↗ mover] [🗑] │ │ [↗ mover] [🗑] │
└────────────────┘ └────────────────┘ └────────────────┘
                  Remover registro completo: [🗑 Excluir tudo]
```

Recursos:
- **Toggle "Ativa"** (mantém comportamento atual de `variant_overrides`).
- **Botão ⭐ Capa por dispositivo**: troca apenas a variante daquele device como capa da obra (ver §4).
- **Botão ↗ "Mover para outra obra"**: abre `AssociatePieceDialog` reutilizado, mas opera só sobre o registro lógico (move o trio inteiro).
- **Fallback de imagem quebrada**: `<img onError>` mostra um placeholder com mensagem "arquivo não encontrado no bucket" (evita o ícone quebrado visto no print).
- Loading skeleton no `<img>` enquanto carrega (usa `loading="lazy"`).

### 4. Capa por dispositivo

Hoje `gallery_pieces` só tem `cover_url` + `cover_storage_path` (uma capa única — usa desktop). Vamos adicionar capa específica por dispositivo:

**Migration** `add_cover_per_device.sql`:
```sql
alter table public.gallery_pieces
  add column cover_url_mobile text,
  add column cover_path_mobile text,
  add column cover_url_tablet text,
  add column cover_path_tablet text;
-- desktop continua usando cover_url / cover_storage_path (compat)
```

**Lógica**:
- Se `cover_url_mobile` for null, o site faz fallback para `cover_url` (desktop). Sem breaking changes.
- No `useGalleryData`/`PieceCarousel`: ao montar `<picture>` da capa, usa `cover_url_mobile` para `(max-width: 480px)`, `cover_url_tablet` para `(max-width: 768px)`, `cover_url` (desktop) como default.
- Botão "⭐ Capa Mobile" no GalleryTab grava em `cover_url_mobile`/`cover_path_mobile` apontando para a variante correta daquele registro (`{folder}/mobile.webp`). Mesma lógica para tablet e desktop.

### 5. Galeria — Staging também por dispositivo

No card de cada item de staging, substituir a única thumb por mini-grid 3×1 igual ao do §3 (sem botões de capa, mas com label `📱 Mobile · 18 KB` por baixo). Mantém os botões "Associar" e "Descartar" globais por registro.

### Diagrama: fluxo de capa por dispositivo

```text
Galeria por obra → registro de imagem (3 variantes no bucket)
                                │
            ┌───────────────────┼────────────────────┐
            ▼                   ▼                    ▼
       ⭐ Capa Mobile      ⭐ Capa Tablet       ⭐ Capa Desktop
            │                   │                    │
            ▼                   ▼                    ▼
   gallery_pieces.       gallery_pieces.      gallery_pieces.
   cover_url_mobile      cover_url_tablet     cover_url
                                │
                                ▼
                  Site público (<picture>)
                  - <source media="(max-width:480px)" → mobile
                  - <source media="(max-width:768px)" → tablet
                  - <img src=desktop> fallback
```

### Detalhes técnicos

**Arquivos novos**
- `src/components/admin/converter/VariantGrid.tsx` — grid 3×1 reutilizável (recebe URLs/sizes/widths e botões opcionais por slot).
- `src/components/admin/converter/QueueSpeedometer.tsx` — exibe ⚡ velocidade e ⏱ ETA usando `completionTimes[]`.

**Arquivos editados**
- `src/components/admin/converter/QueueProgressBar.tsx` — recebe `itemProgress` e `completionTimes`; renderiza `QueueSpeedometer`.
- `src/components/admin/converter/QueueItem.tsx` — emite `onProgressChange`; renderiza `VariantGrid` quando `done`.
- `src/pages/admin/ImageConverter.tsx` — mantém `itemProgress` em state; calcula `completionTimes` quando status vira `done|error`.
- `src/components/admin/converter/GalleryTab.tsx`:
  - Substitui o card único por `VariantGrid` com botões "Capa Mobile/Tablet/Desktop".
  - Adiciona `<img onError>` com placeholder quando o arquivo não existe.
  - Renomeia "Definir como capa" para "Capa Desktop" (consistência).
  - Atualiza staging cards para usar `VariantGrid` (somente leitura + sizes).
- `src/components/sections/gallery/PieceCarousel.tsx` (ou onde a capa é renderizada): trocar `<img src=cover_url>` por `<picture>` com sources mobile/tablet/desktop, com fallback para `cover_url` quando colunas novas estão null.
- `src/integrations/supabase/types.ts` — regenerado automaticamente após a migration.

**Migration**
- `add_cover_per_device.sql`: 4 colunas novas em `gallery_pieces` (todas nullable, sem default — fallback para cover_url).

**Cálculo de ETA (pseudo)**
```ts
const completed = completionTimes.length;
const elapsedMs = Date.now() - completionTimes[0];
const itemsPerMin = (completed / elapsedMs) * 60_000;
const remaining = total - completed - failed;
const etaSec = remaining / itemsPerMin * 60;
```

**Performance**: thumbs do grid usam `loading="lazy"` + `decoding="async"`; URLs de blob no Conversor são revogados quando o `QueueItem` desmonta.

**Sem mudanças** em `imageConverter.ts`, `galleryUploader.ts`, `client.ts`, ou na lógica de upload do PiecesManager — só adicionamos colunas e refinamos a UI.

