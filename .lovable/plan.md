

## Plano: 4 melhorias no pipeline de imagens

### 1. Testes do `ResponsivePicture`

**Novo:** `src/components/ui/responsive-picture.test.tsx`

Cenários cobertos com Vitest + Testing Library:
- **Pipeline novo (com `device_label`)**: passa 3 variantes WebP marcadas mobile/tablet/desktop → `srcset` deve conter as 3 URLs ordenadas por largura, `src` aponta pra desktop, `sizes` definido.
- **Apenas device_label parcial**: passa só mobile + desktop → `srcset` mantém ordem por largura, sem quebrar.
- **Legado sem `device_label`**: passa 4 variantes WebP de larguras diferentes → seleciona todas ordenadas, fallback = maior largura.
- **Sem WebP, só JPEG (legado puro)**: cai no fallback `<img src=jpeg>` sem `srcset`.
- **`variants` nulo/vazio**: renderiza `<img>` plano com `src` recebido.
- **Atributos passados**: `loading`, `fetchPriority`, `alt`, `className`, `onClick` propagam corretamente.

Já existe `vitest.config.ts` + `src/test/setup.ts`, então não há setup novo.

---

### 2. Botão "Reprocessar variantes faltantes"

**Editar:** `src/pages/admin/ImageOptimizer.tsx`

- Acima da lista, novo botão **"Modernizar antigas (N)"** que aparece somente quando há imagens detectadas como "antigo formato".
- Critério de "formato antigo": `status === "ready"` E (não tem nenhuma variante com `device_label === "desktop"` OU possui formato `avif`/`jpeg` mas nenhum WebP marcado por device).
- Ao clicar:
  1. Filtra os IDs candidatos
  2. Marca status `processing` na UI + DB
  3. Dispara `optimize-image` com concorrência 3 (reusa `runWithConcurrency` existente)
  4. Mostra progresso `{done}/{total}` no botão
  5. Toast final com sucesso/erros
- Tooltip: "Reprocessa imagens que ainda não têm variantes mobile/tablet/desktop no novo pipeline WebP."

Helper novo em `src/lib/imageSnippet.ts`:
```ts
export const isLegacyFormat = (variants: OptimizedVariant[]): boolean => {
  if (!variants.length) return false;
  const hasNewPipeline = variants.some(v => v.format === "webp" && v.device_label === "desktop");
  return !hasNewPipeline;
};
```

---

### 3. Detecção de suporte a WebP no frontend

**Novo:** `src/lib/webpSupport.ts`

```ts
let cached: boolean | null = null;
export const supportsWebP = async (): Promise<boolean> => {
  if (cached !== null) return cached;
  if (typeof window === "undefined") return false;
  // Browser modern check via canvas
  try {
    const canvas = document.createElement("canvas");
    if (canvas.toDataURL) {
      cached = canvas.toDataURL("image/webp").startsWith("data:image/webp");
      return cached;
    }
  } catch { /* ignore */ }
  cached = false;
  return false;
};
```

**Editar:** `src/components/ui/responsive-picture.tsx`
- Hook `useWebpSupport()` (estado local + efeito) → enquanto não resolver, assume `true` (97% dos navegadores suportam).
- Se `false`, ignora WebP e usa o fallback original (`src` recebido como prop, que é a URL do arquivo original em JPEG/PNG no bucket).
- Telemetria: log único `console.warn("WebP unsupported, using original fallback")` para depuração.

Como o pipeline novo gera **só WebP**, navegadores sem suporte (IE, Safari muito antigo) caem no `original_path` que é o JPEG/PNG enviado pelo admin — já preservado no Storage.

**Ajuste em `getBestUrlForPiece`** (`src/lib/optimizerUpload.ts`): expor variante `getBestUrlForPieceWithWebpSupport(variants, fallback, supportsWebp)` que respeita a flag.

---

### 4. Tela "Status" do BackfillRunner

**Editar:** `src/pages/admin/BackfillRunner.tsx`

Adicionar painel de **Estatísticas em tempo real** acima da lista (visível durante e após o run):

| Métrica | Como calcula |
|---|---|
| **Tempo médio por imagem** | soma de `(end - start)` por item concluído / contagem |
| **Taxa de sucesso** | `done / (done + failed) * 100` |
| **Imagens por minuto** | `done / elapsedMin` (atualiza a cada 1s via `setInterval`) |
| **Tempo total decorrido** | `now - runStart` formatado mm:ss |
| **ETA restante** | `pendingCount * avgMs` formatado |
| **Bytes economizados** | acumula `original_size - tablet.size_bytes` por item concluído |

Implementação:
- Novos estados: `runStartedAt`, `runEndedAt`, `perItemTimings: Map<id, {start, end?}>`, `bytesOriginal`, `bytesOptimized`.
- Wrap `migrateLegacyImage` em hook que registra início/fim por id.
- Card grid 2x3 com cores: tempo (primary), sucesso (emerald se ≥95%, amber se 80-95%, destructive abaixo).
- Mantido após o run, com botão "Limpar estatísticas" que reseta os timings.
- Auto-refresh do "tempo decorrido" via `setInterval(1000)` enquanto `running === true`.

---

### Arquivos editados/criados

**Novo:**
- `src/components/ui/responsive-picture.test.tsx` — 6 cenários
- `src/lib/webpSupport.ts` — detecção via canvas com cache
- `src/components/ui/__tests__/webpSupport.test.ts` (opcional, smoke test)

**Editado:**
- `src/components/ui/responsive-picture.tsx` — integra `useWebpSupport`
- `src/lib/imageSnippet.ts` — helper `isLegacyFormat`
- `src/lib/optimizerUpload.ts` — versão com flag webp
- `src/pages/admin/ImageOptimizer.tsx` — botão "Modernizar antigas"
- `src/pages/admin/BackfillRunner.tsx` — painel de estatísticas em tempo real

### Validação

1. `npm run test` → `responsive-picture.test.tsx` passa todos os cenários.
2. No Otimizador, botão "Modernizar antigas" só aparece se houver imagens sem `device_label === "desktop"`. Clicar reprocessa apenas elas.
3. DevTools → simular Safari 13 (sem WebP) ou definir `cached = false` manualmente → galeria carrega o JPEG original em vez do WebP, sem broken images.
4. Rodar Backfill → painel mostra "00:12 decorrido · 2.3s/img · 100% sucesso · 4.2 imgs/min · 1.8 MB economizados"; números atualizam a cada segundo.

