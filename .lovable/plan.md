

## Plano: 3 melhorias — auto-otimização de risco, correlação de telemetria, testes de telemetria

### 1. Auto-otimização das imagens com maior risco de fallback

**Conceito:** "imagens em risco" = imagens já marcadas como `ready` que **não têm WebP usável** pelo pipeline novo. Hoje o `isLegacyFormat` já cobre esse caso (toda imagem `ready` sem `webp + device_label='desktop'`). A novidade é **automatizar**: detectar e disparar com 1 clique, sem o usuário precisar pensar no que selecionar.

**Editar `src/pages/admin/ImageOptimizer.tsx`:**

- Adicionar botão **"Auto-otimizar em risco (N)"** ao lado de "Modernizar antigas" no cabeçalho.
- Critério ampliado de "em risco":
  1. `status === "ready"` E `isLegacyFormat(variants)` (sem WebP novo), **OU**
  2. `status === "ready"` E `variants.length === 0` (registro órfão sem nenhum arquivo otimizado), **OU**
  3. `status === "error"` (falhou anteriormente)
- Novo helper em `src/lib/imageSnippet.ts`:
  ```ts
  export const isAtRiskOfFallback = (
    status: string,
    variants: OptimizedVariant[] | null | undefined,
  ): boolean => {
    if (status === "error") return true;
    if (status !== "ready") return false;
    if (!variants?.length) return true;
    return !variants.some((v) => v.format === "webp" && v.device_label === "desktop");
  };
  ```
- Reutiliza a infra existente (`runWithConcurrency`, `BULK_CONCURRENCY = 3`, toast de progresso). Comportamento idêntico ao botão "Modernizar antigas", mas com o conjunto ampliado.
- Tooltip: "Reprocessa automaticamente as imagens com maior risco de cair no fallback original — sem WebP, com erro ou no formato antigo."
- Botão só aparece se `riskCount > 0`.

**Editar `src/pages/admin/BackfillRunner.tsx`:**
- Adicionar atalho **"Selecionar em risco"** ao lado de "Selecionar todas pendentes". Marca apenas itens com `status === "pending"` ou `status === "error"` (que já é o conceito de risco no contexto do backfill).

---

### 2. Correlação fallback WebP × tempo de carregamento do otimizador

**Objetivo:** mostrar no `WebpTelemetryCard` se sessões em fallback realmente perdem performance, comparando o **tamanho médio servido** entre sessões com e sem fallback.

Como **não temos métricas de tempo real do navegador** capturadas hoje, vamos:

**a) Estender a telemetria existente** (`src/lib/clientTelemetry.ts` + `src/components/ui/responsive-picture.tsx`):
- No evento `webp_fallback_used`, anexar no `meta`:
  - `originalBytes`: tamanho do arquivo original servido (via `performance.getEntriesByName(src)` quando disponível, ou estimativa pelo header `content-length` capturado no `onLoad`).
  - `webpBytesEstimate`: soma dos `size_bytes` das variants WebP que **deixaram de ser usadas** (perda evitada).
  - `loadMs`: `PerformanceResourceTiming.duration` da imagem servida.
- Para sessões **com WebP** (controle), criar evento novo `webp_served` (1× por sessão, no mesmo hook), capturando `loadMs` médio das primeiras N imagens. Isso dá a baseline de comparação.

**b) Atualizar `WebpTelemetryCard` em `src/pages/admin/ImageOptimizer.tsx`:**
- Nova seção **"Impacto por sessão (30d)"** dentro do card, abaixo dos `MiniStat`s atuais:
  ```
  ┌─ Sessões COM WebP ──────┐  ┌─ Sessões em FALLBACK ────┐
  │ Tempo médio: 245 ms      │  │ Tempo médio: 612 ms       │
  │ Tamanho médio: 38 KB     │  │ Tamanho médio: 184 KB     │
  └──────────────────────────┘  └───────────────────────────┘
  → Δ Latência: +367 ms · Δ Peso: +146 KB por imagem
  ```
- Cálculo client-side: agregar `meta.loadMs` e `meta.originalBytes` das duas categorias e mostrar média + delta.
- Banner de severidade:
  - Δ < 100ms → verde "Impacto mínimo"
  - Δ 100–300ms → amber "Impacto moderado"
  - Δ > 300ms → destructive "Impacto significativo — considere otimizar JPEGs originais"
- Mantém estado vazio elegante quando ainda não há eventos suficientes (< 3 sessões em cada bucket): "Aguardando mais dados para correlação confiável."

**Nenhuma migração de DB necessária** — `client_telemetry.meta` já é `jsonb` e aceita os novos campos. O novo `event_type` `webp_served` precisa ser adicionado ao tipo `TelemetryEvent` em `clientTelemetry.ts` e ao filtro `.in("event_type", [...])` no card.

---

### 3. Testes do `trackClientEvent` — 1 evento por sessão

**Novo arquivo:** `src/lib/clientTelemetry.test.ts`

Cenários cobertos com Vitest + mocks:
- **Mock do `supabase.from("client_telemetry").insert`** via `vi.mock("@/integrations/supabase/client")` retornando `{ error: null }`.
- **Mock de `sessionStorage`** (já existe `setup.ts` com jsdom — reset entre testes via `beforeEach(() => sessionStorage.clear())`).

Casos:
1. **Primeira chamada de `webp_unsupported`** → `insert` chamado 1×.
2. **Segunda chamada de `webp_unsupported` na mesma sessão** → `insert` NÃO é chamado novamente (total = 1).
3. **`webp_unsupported` + `webp_fallback_used` na mesma sessão** → `insert` chamado 2× (eventos diferentes têm dedupe independente).
4. **`oncePerSession: false`** → múltiplas chamadas do mesmo evento → cada uma dispara `insert`.
5. **`sessionStorage` lança exceção** (simulado via `vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error() })`) → não quebra, ainda envia.
6. **`supabase.insert` rejeita** → função não lança (fire-and-forget).
7. **`meta` é forwarded corretamente** → `expect(insert).toHaveBeenCalledWith(expect.objectContaining({ meta: { foo: "bar" } }))`.

**Novo bloco no arquivo existente** `src/components/ui/responsive-picture.test.tsx`:
- Adicionar `describe("telemetry integration", ...)` com 2 testes:
  1. **Renderiza com `webpOk = false` + variants não vazias** → `trackClientEvent` foi chamado com `"webp_fallback_used"` exatamente 1×. Mock de `clientTelemetry` via `vi.mock("@/lib/clientTelemetry")`.
  2. **Re-render do mesmo componente sem mudar o estado** → `trackClientEvent` ainda foi chamado apenas 1× (por causa do `void` no render — verificar que não há loop).
  3. **Renderiza com `webpOk = true`** → `trackClientEvent` NÃO é chamado.

---

### Arquivos editados/criados

**Novo:**
- `src/lib/clientTelemetry.test.ts` — 7 testes do dedupe e fire-and-forget.

**Editado:**
- `src/lib/imageSnippet.ts` — helper `isAtRiskOfFallback`.
- `src/lib/clientTelemetry.ts` — novo `TelemetryEvent: "webp_served"`.
- `src/components/ui/responsive-picture.tsx` — captura `loadMs`/`originalBytes` no `onLoad` e envia `webp_fallback_used` enriquecido + `webp_served` no caminho feliz.
- `src/components/ui/responsive-picture.test.tsx` — adicionar `describe("telemetry integration", …)`.
- `src/pages/admin/ImageOptimizer.tsx` — botão "Auto-otimizar em risco" + seção "Impacto por sessão" no `WebpTelemetryCard`.
- `src/pages/admin/BackfillRunner.tsx` — atalho "Selecionar em risco".

### Validação

1. `npm run test` → todos os testes passam (`clientTelemetry.test.ts` cobre dedupe; `responsive-picture.test.tsx` cobre integração).
2. No Optimizer: se houver imagens `ready` sem WebP novo OU com erro OU órfãs → botão **"Auto-otimizar em risco (N)"** aparece. Clicar dispara reprocessamento em paralelo.
3. Forçar `__setWebpSupportForTests(false)` no console + recarregar galeria → após uns segundos, card de Telemetria mostra a nova seção "Impacto por sessão" com `loadMs` e bytes capturados.
4. No Backfill: novo botão "Selecionar em risco" marca apenas pending + error.

