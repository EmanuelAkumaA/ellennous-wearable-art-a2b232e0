

## Plano: telemetria de fallback WebP + Backfill agrupado por obra com seleção

### Parte 1 — Telemetria de fallback WebP

Já existe `useWebpSupport` em `responsive-picture.tsx` e `webpSupport.ts` (com `console.warn` único). Vou adicionar telemetria persistida:

**Nova tabela** `client_telemetry` (migration):
- `id uuid pk`, `created_at timestamptz`, `event_type text`, `session_id text`, `user_agent text`, `meta jsonb`
- RLS: `INSERT` aberto para `anon/authenticated`, `SELECT` apenas para admins.

**Novo arquivo** `src/lib/clientTelemetry.ts`:
- `trackClientEvent(eventType, meta?)` — insert fire-and-forget (try/catch silencioso, mesmo padrão do `analytics.ts`).
- Deduplicação por sessão: usa `sessionStorage` para enviar `webp_unsupported` apenas 1× por sessão, evitando flood.

**Editar** `src/lib/webpSupport.ts`:
- Quando detecção resolve `false`, chamar `trackClientEvent("webp_unsupported", { ua: navigator.userAgent })` além do `console.warn`.

**Editar** `src/components/ui/responsive-picture.tsx`:
- Quando `webpOk === false` E `variants` existem (ou seja, perdemos uma otimização), incrementar contador local + emitir `trackClientEvent("webp_fallback_used", { variantCount })` 1× por sessão.

**Nova aba "Telemetria"** em `src/pages/admin/ImageOptimizer.tsx` (ou banner no topo):
- Card mostrando: total de eventos `webp_unsupported`, total `webp_fallback_used`, % do tráfego nos últimos 7/30 dias, top user agents.
- Query: `select event_type, count(*), count(distinct session_id) from client_telemetry where created_at > now() - interval '7 days' group by event_type`.
- Permite correlacionar: se a taxa de fallback for alta, o ganho do otimizador é menor para parte do público.

---

### Parte 2 — Backfill agrupado por obra, com seleção e status por item

**Editar** `src/pages/admin/BackfillRunner.tsx` — reestruturar a lista plana atual num layout agrupado:

```text
┌─ Ações ────────────────────────────────────┐
│ [▶ Otimizar selecionadas (N)] [Selecionar │
│  todas pendentes] [Limpar seleção]        │
└────────────────────────────────────────────┘

▼ Colar Negro · 3 imagens · 2 pendentes · 1 otimizada
  ☐ [thumb] cover.jpg          [Capa]    Pronta ✓ 100%
  ☑ [thumb] detail-1.jpg       [Galeria] Pendente ▓▓▓░░ 0%
  ☑ [thumb] detail-2.jpg       [Galeria] Otimizando ▓▓▓▓░ 72%

▼ Anel Sangria · 2 imagens · 0 pendentes
  (todas otimizadas — colapsado por padrão)

▼ Brinco Pétala · 4 imagens · 4 pendentes
  ☐ Selecionar todas desta obra
  ☐ [thumb] ...
```

**Mudanças concretas:**

1. **Estado de seleção**: novo `selected: Set<string>` no componente.
2. **Agrupamento**: `useMemo` que agrupa `items` por `pieceId` → `Map<pieceId, { pieceName, items, pending, done, error }>`; ordenado por nome.
3. **UI**: cada grupo vira um `<Collapsible>` (já temos `@/components/ui/collapsible`) com cabeçalho clicável (chevron, nome, contadores). Auto-colapsa quando todos `done`.
4. **Checkboxes**:
   - Por imagem: marca/desmarca no `Set`.
   - Por obra ("Selecionar todas desta obra"): marca todos os `pending`/`error` do grupo.
   - Global: "Selecionar todas pendentes".
5. **Botão principal vira "Otimizar selecionadas (N)"** — usa `selected` em vez de todos os pendentes. Se nada selecionado, ele vira "Selecionar tudo" (atalho).
6. **Status por linha (`BackfillRow` ampliado)**:
   - Badge à direita com 3 estados visuais distintos:
     - 🟢 **Otimizada** (verde, ícone CheckCircle2) quando `status === "done"` ou já estava no formato novo.
     - 🟡 **Otimizando…** (amarelo pulsante) com barra de progresso + percentual em tempo real (`item.progress`).
     - ⚪ **Não otimizada** (cinza) quando `pending`.
     - 🔴 **Erro** (vermelho) com tooltip do `item.error`.
   - Mostrar etapa atual em texto pequeno: "Baixando 32%", "Enviando", "Otimizando 78%".
   - Barra inline já existente vira mais grossa (h-1.5) e colorida conforme estado.
7. **Persistência visual**: imagens já `done` permanecem visíveis no grupo com badge verde, não somem.
8. **Header de grupo** mostra mini-progresso agregado da obra (ex: "2/3 otimizadas") + barra horizontal pequena.

**Arquivos novos/editados:**

- **Novo**: `supabase/migrations/<ts>_client_telemetry.sql` — tabela + RLS.
- **Novo**: `src/lib/clientTelemetry.ts` — helper de envio com dedupe por sessão.
- **Editado**: `src/lib/webpSupport.ts` — dispara telemetria no fallback.
- **Editado**: `src/components/ui/responsive-picture.tsx` — telemetria quando perde otimização por falta de WebP.
- **Editado**: `src/pages/admin/BackfillRunner.tsx` — agrupamento por obra, seleção, status por linha.
- **Editado**: `src/pages/admin/ImageOptimizer.tsx` — card "Telemetria do navegador" com contadores 7d/30d.

### Validação

1. Forçar `__setWebpSupportForTests(false)` no console → ao recarregar galeria, aparece registro em `client_telemetry` com `event_type='webp_fallback_used'` (apenas 1 por sessão).
2. Card "Telemetria" no admin mostra contagem agregada.
3. Em `/admin/backfill`: imagens aparecem agrupadas por obra com chevron expansível; checkboxes aparecem em cada linha; "Otimizar selecionadas" só roda nas marcadas; cada linha mostra etapa + % em tempo real; badges Otimizada / Otimizando / Não otimizada / Erro aparecem corretamente.
4. Marcar 2 imagens de obras diferentes → rodar → apenas elas processam, demais permanecem "Não otimizada".

