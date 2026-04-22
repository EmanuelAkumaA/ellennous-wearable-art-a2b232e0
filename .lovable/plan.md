

## Plano: otimizador mais rápido — 3 variantes em vez de 12

### Diagnóstico

Hoje o pipeline gera **12 arquivos por imagem**: 4 larguras (400/800/1200/1600) × 3 formatos (AVIF/WebP/JPEG). AVIF é o codec mais lento (5–15s por encode em WASM). Para 8 imagens isso são **~96 encodes**, dos quais 32 são AVIF — explicando a lentidão.

### Nova estratégia: 1 variante por dispositivo, formato único WebP

| Dispositivo | Largura | Formato | Qualidade |
|-------------|---------|---------|-----------|
| 📱 Mobile   | 480px   | WebP    | 78        |
| 💻 Tablet   | 1024px  | WebP    | 80        |
| 🖥 Desktop  | 1600px  | WebP    | 82        |

**Por que WebP único:**
- Suportado por 97%+ dos navegadores (Safari 14+, Chrome, Firefox, Edge)
- Comprime 25–35% melhor que JPEG
- Encode 5–8× mais rápido que AVIF em WASM
- Elimina necessidade de fallback JPEG separado

**Ganho esperado:** de 12 → 3 arquivos por imagem, e WebP encoda em ~300ms cada vs ~5s do AVIF. Tempo total por imagem cai de ~30s para ~3–5s. Backfill das 8 imagens deve completar em ~30–40s vs ~4 minutos atuais.

### Mudanças

**1. `supabase/functions/optimize-image/index.ts`**
- Remover imports de `@jsquash/avif` e `@jsquash/jpeg` (encode) — manter só decode JPEG/PNG/WebP e encode WebP
- Constante `TARGET_VARIANTS = [{ width: 480, label: "mobile" }, { width: 1024, label: "tablet" }, { width: 1600, label: "desktop" }]`
- Loop simplificado: 1 encode WebP por largura, qualidade dinâmica
- Salvar com path `{folder}/{label}.webp` (ex: `mobile.webp`, `tablet.webp`, `desktop.webp`)
- Adicionar campo `device_label: "mobile" | "tablet" | "desktop"` nas variants

**2. `src/lib/imageSnippet.ts` + `src/components/ui/responsive-picture.tsx`**
- Simplificar: usar apenas `<img>` com `srcset` WebP + `sizes`, sem múltiplas `<source>` AVIF/WebP
- `srcset="mobile.webp 480w, tablet.webp 1024w, desktop.webp 1600w"`
- `sizes="(max-width:640px) 480px, (max-width:1024px) 1024px, 1600px"`
- Fallback `src` = desktop.webp

**3. `src/components/admin/optimizer/ImageRow.tsx` + `ImageCard.tsx`**
- 3 chips: 📱 Mobile / 💻 Tablet / 🖥 Desktop com tamanho + economia %
- Tooltip por chip: "{width}px · WebP · {economia} economizados"

**4. `src/lib/optimizerBackfill.ts`**
- Aumentar concorrência de 2 → 4 (encodes mais leves permitem)
- Reduzir polling timeout de 95s → 30s (não precisa mais)

**5. Migração leve**
- Imagens já otimizadas no formato antigo continuam funcionando (matching por basename + variantes existentes no JSON)
- Recomendar rodar BackfillRunner novamente para regenerar com o formato novo (mais leve, mais rápido)
- Adicionar botão "Regenerar todas" no ImageOptimizer que reprocessa imagens já existentes com o novo pipeline

### Arquivos editados

- `supabase/functions/optimize-image/index.ts` — pipeline simplificado WebP-only, 3 widths
- `src/lib/imageSnippet.ts` — snippet `<img>` com srcset WebP
- `src/components/ui/responsive-picture.tsx` — render WebP único com srcset
- `src/lib/optimizerUpload.ts` — atualizar `getBestUrlForPiece` para escolher desktop.webp
- `src/components/admin/optimizer/ImageRow.tsx` — chips por device_label
- `src/components/admin/optimizer/ImageCard.tsx` — chips simplificados
- `src/components/admin/optimizer/CodeSnippetDialog.tsx` — atualizar exemplo gerado
- `src/lib/optimizerBackfill.ts` — concorrência 4, timeout reduzido
- `src/pages/admin/ImageOptimizer.tsx` — botão "Regenerar com novo pipeline"

### Validação

1. Upload de 1 imagem nova → 3 arquivos WebP gerados em ~3s (vs ~30s antes)
2. Backfill de 8 imagens → completa em ~40s (vs ~4min)
3. Network tab no site público mostra **1 arquivo WebP** servido conforme viewport (mobile pega `mobile.webp`, desktop pega `desktop.webp`)
4. Lighthouse mantém score >= ao atual (WebP comprime melhor que JPEG, perde ~10% para AVIF mas com 5× menos compute)

