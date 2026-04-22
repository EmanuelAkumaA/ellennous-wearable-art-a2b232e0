

## Plano: pré-conversão para WebP no cliente + painel de tempos médios

### Conceito da nova dinâmica

Hoje: **upload do original (JPG/PNG) → edge function decodifica + redimensiona + encoda WebP**. Quando o original é pesado/grande, o decoder WASM da edge consome muita memória e dá `error` (foi a causa raiz dos travamentos recentes).

Nova dinâmica: o **navegador** faz a conversão original → WebP **antes** de subir. A edge só precisa fazer resize + encode (mais leve, mais rápido, menos erros). O original em JPG/PNG é descartado depois que as 3 variantes estão prontas.

```
[browser] file picker
   │
   ├─ 1. Convert (original → WebP master) via canvas
   │      → mostra "Convertendo… ~1.5s"
   │
   ├─ 2. Upload WebP master para optimized-images bucket
   │      → row em optimized_images com status='processing'
   │      → galeria já mostra a imagem (preview do master)
   │
   ├─ 3. Edge function gera mobile/tablet/desktop a partir do master
   │      → status='ready'
   │
   └─ 4. Cleanup: remove o master WebP (mantém só as 3 variantes)
          → galeria troca preview master pela URL desktop
```

---

### 1. Conversor cliente-side (novo: `src/lib/clientWebpConverter.ts`)

- Função `convertToWebp(file: File, quality = 0.9): Promise<{ blob: Blob; width: number; height: number; ms: number }>`.
- Usa `createImageBitmap(file)` → `OffscreenCanvas` (fallback `<canvas>` em Safari) → `canvas.convertToBlob({ type: 'image/webp', quality })`.
- Cap de dimensão máxima (3200px no maior lado) para evitar canvas absurdo e dar conversão consistente em ~1-3s.
- Se já for `image/webp` → retorna o file direto sem reprocessar.
- Se navegador não suportar canvas WebP (Safari < 14) → retorna o original e pula etapa, edge function continua aceitando JPG/PNG.
- Telemetria: grava `meta.conversionMs` no `client_telemetry` (event `webp_client_conversion`) para alimentar o painel de tempos médios.

### 2. Atualizar `uploadToOptimizer` (`src/lib/optimizerUpload.ts`)

- Antes do `supabase.storage.upload`, chama `convertToWebp(file)` quando `file.type !== 'image/webp'`.
- Path passa de `images/{id}/original.{ext}` para `images/{id}/master.webp` (nome semântico — fica claro que é descartável).
- Insere row com `original_path = master.webp`, `status='processing'`.
- Toast: "Convertido para WebP em 1.4s, otimizando…" (feedback imediato).
- Loga em `optimization_error_log` se a conversão falhar (stage `'client_convert'`) com fallback automático para upload do original.

### 3. Edge function `optimize-image` — adicionar cleanup do master

- Após gerar as 3 variantes (mobile/tablet/desktop) com sucesso, **remove o `original_path`** (`master.webp`) do bucket.
- Se alguma variante falhar, **mantém o master** (para permitir reprocesso e debug).
- Atualiza row: `original_path = null` quando deletado, mantém `original_size_bytes` para o cálculo de economia.
- A galeria não quebra: `getBestUrlForPiece` já prefere a variante `desktop` quando disponível; só cai no `original_path` quando `variants` está vazio (cenário `processing` curto).

### 4. Galeria mostra a imagem imediatamente

- Já é o caso hoje (`PiecesManager` faz `setDraftImages` com `previewUrl: result.originalUrl` antes da otimização terminar). Apenas confirmar que continua funcionando: o `previewUrl` aponta agora para o `master.webp`, que é instantaneamente mostrável no `<img>` (todo navegador moderno suporta WebP).
- Quando `optimized_images.status` vira `'ready'` via realtime, o draft atualiza para `getBestUrlForPiece(variants, previewUrl)` e a URL final passa a ser a variante desktop.
- Após o cleanup, o `previewUrl` antigo (`master.webp`) deixa de existir mas já não é mais referenciado.

### 5. Painel "Tempos médios estimados" (novo card no Image Optimizer)

Novo componente `<ProcessingTimingsCard />` em `src/pages/admin/ImageOptimizer.tsx`, ao lado do `WebpTelemetryCard`.

**Fonte de dados:** agrega métricas das últimas 30 imagens processadas com sucesso (últimos 7 dias):
- **Conversão (cliente)**: `client_telemetry` filtrado por `event_type = 'webp_client_conversion'` → média de `meta.conversionMs`.
- **Upload**: estimado pelo `optimized_images.original_size_bytes / banda média` (banda média = `original_size_bytes ÷ (created_at - upload_started)` capturado num novo campo do telemetry).
- **Otimização (edge)**: `optimized_images.updated_at - created_at` quando `status='ready'`.
- **Total p/imagem**: soma das três.

**Layout do card:**
```
┌── Tempos médios (últimas 30 imagens) ──────────────┐
│  Conversão WebP  │  Upload  │  Otimização │ Total  │
│      1.4s        │   0.8s   │    4.2s     │  6.4s  │
│  ▰▰▰▱▱▱▱▱▱▱      ▰▰▱▱▱▱▱▱▱▱   ▰▰▰▰▰▰▰▱▱▱   ▰▰▰▰▰▰▰▰│
│                                                     │
│  ⓘ Aguarde ~6s antes de reprocessar uma imagem.    │
│  ⓘ Lote de 10 imagens: ~22s (3 paralelas).         │
└─────────────────────────────────────────────────────┘
```

- Cada barra com cor (conversão = blue, upload = amber, otimização = emerald).
- Texto-guia dinâmico: "Aguarde ~Xs antes de reprocessar" usa o `Total p99` (não a média).
- Estimativa de lote leva em conta `BULK_CONCURRENCY = 3` que já existe.
- Estado vazio: "Coletando dados — processe algumas imagens para ver as estimativas".

### 6. Validação

1. **Upload de JPG 5MB**: mostra "Convertendo… 1.5s", master WebP aparece no bucket (~600KB), galeria exibe imediatamente, depois das 3 variantes o master é removido. `original_path` na DB vira `null`.
2. **Upload de PNG transparente**: WebP preserva alpha (canvas garante), variantes geradas mantêm transparência.
3. **Upload de WebP**: pula conversão, vai direto pro upload (toast "Já é WebP").
4. **Navegador sem `convertToBlob('image/webp')`** (Safari < 14): caí no fluxo antigo (envia original), nada quebra.
5. **Falha de conversão**: log em `optimization_error_log` com `stage='client_convert'`, fallback automático para upload do original.
6. **Painel**: após processar 3-4 imagens, card mostra médias e estimativa "aguarde ~6s antes de reprocessar".

### Arquivos editados/criados

**Novo:**
- `src/lib/clientWebpConverter.ts` — conversor canvas → WebP com cap dimensional.
- `src/components/admin/optimizer/ProcessingTimingsCard.tsx` — painel de tempos médios.

**Editado:**
- `src/lib/optimizerUpload.ts` — chama conversor antes do upload, path `master.webp`, toast com tempo.
- `src/lib/clientTelemetry.ts` — adicionar `'webp_client_conversion'` ao tipo `TelemetryEvent`.
- `supabase/functions/optimize-image/index.ts` — remover `original_path` do bucket após sucesso, setar `original_path = null` na row.
- `src/pages/admin/ImageOptimizer.tsx` — montar `<ProcessingTimingsCard />` ao lado do telemetry card.

