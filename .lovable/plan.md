

## Plano: corrigir erros do backfill + indicadores de progresso e prontidão

### Diagnóstico — por que dá "Erro" no backfill

O log da edge function `optimize-image` mostra:

```
TypeError: userClient.auth.getClaims is not a function
```

A função tenta validar o token com `userClient.auth.getClaims(token)`, mas esse método **não existe** em `@supabase/supabase-js@2.45.0`. Resultado: toda chamada do otimizador retorna 500, e:

- O backfill marca a imagem como `error` (com mensagem genérica do invoke).
- 3 imagens já estão **presas em `processing` para sempre** no banco (`1776656362618-0.jpg`, `cover-1776656408394.jpg`, `anime2.jpg`) — por isso aparecem com o spinner roxo eterno na imagem 02.

---

### 1. Corrigir a falha do `optimize-image`

**Editar `supabase/functions/optimize-image/index.ts`:**

- Trocar `userClient.auth.getClaims(token)` por `userClient.auth.getUser()` (API estável e disponível em todas as versões do supabase-js v2). A função recebe o token via `Authorization` header e devolve `{ data: { user }, error }`. `user.id` substitui `claims.sub`.
- Verificação de admin continua via RPC `has_role`.
- Redeploy automático ao salvar.

**"Reset" das 3 imagens travadas em `processing`:**

- Migration leve que faz `update optimized_images set status='error', error_message='Função de otimização indisponível (corrigida em 22/04)' where status='processing' and updated_at < now() - interval '5 minutes'`. Isso destrava as 3 órfãs e elas passam a ser **clicáveis para reprocessar** (botão refresh já existente). Após o fix da edge function, um clique em "Reprocessar" resolve cada uma.

---

### 2. Histórico de erros por imagem (clicar no chip "Erro" abre detalhes)

**Nova tabela `optimization_error_log`** (migration):

```
id uuid pk · optimized_image_id uuid · created_at timestamptz
error_message text · stage text · piece_id uuid (nullable) · meta jsonb
```

RLS: `INSERT` para `authenticated` (admin via `has_role`), `SELECT` apenas admin. Index em `(optimized_image_id, created_at desc)`.

**Onde gravar:**

- **Edge function `optimize-image`**: no `catch` final, antes de marcar `status='error'`, faz `insert` no log com `stage='processing'` e `meta` contendo `{ srcW, srcH, mime, attempted_variants }` quando disponível.
- **`optimizerBackfill.ts → migrateLegacyImage`**: no `catch` que faz `onItemUpdate(... 'error')`, também faz `insert` direto (cliente, RLS admin) com `stage` = qual etapa falhou (`download | upload | optimize | persist`) e `meta = { url, kind, pieceId }`.
- **`optimizerUpload.ts`**: idem para falhas de upload inicial.

**UI no BackfillRunner — `BackfillRow` `StatusBadge` (status `error`):**

- Hoje o badge "Erro" é um tooltip estático. Vira um **botão clicável** que abre um `<Dialog>` "Histórico de erros desta imagem":
  - Lista cronológica reversa (`created_at`, `stage`, `error_message`).
  - Inclui o erro atual da sessão (mesmo que ainda não tenha sido persistido, mostra primeiro como "Sessão atual").
  - Botão "Reprocessar agora" que dispara o mesmo fluxo do botão refresh por linha.
  - Botão "Copiar log" (copia JSON para área de transferência — útil para suporte).
- Cabeçalho do grupo (obra) também ganha contagem clicável: "1 erro(s)" → abre dialog filtrado por `pieceId` mostrando todos os erros das imagens dessa obra agregados.

**UI no ImageOptimizer (lista principal):**

- Card/Row com `status='error'` ganha o mesmo botão "Ver histórico" no badge. Reaproveita o mesmo `<Dialog>`.

---

### 3. ETA por imagem em otimização + chips verdes quando variantes prontas

**Editar `src/components/admin/optimizer/ImageRow.tsx`:**

- **Tempo médio de processamento** vem do `liveStats.avgMs` quando há um run em andamento, mas no `ImageRow` (lista principal do Otimizador), criar um cálculo simples:
  - Quando `image.status === 'processing'`: calcular `elapsed = now - new Date(image.updated_at).getTime()`.
  - Mostrar ao lado do spinner: **"~Xs decorridos · ETA ~Ys"** onde `Ys = max(0, AVG_PROCESS_MS - elapsed)` e `AVG_PROCESS_MS = 6000` (constante calibrada com base no log das ~3-5s reais por imagem). Uma vez por segundo via `setInterval` que **só roda se houver alguma imagem `processing` visível** (gating de performance).
  - Se `elapsed > AVG_PROCESS_MS * 3` (ex: > 18s), mostrar texto âmbar "Demorando mais que o normal" + botão "Marcar como erro" (faz update local `status=error`).
- **DeviceChips ficam verdes quando a variante específica está disponível** — a lógica do tone hoje só leva em conta `savedPct`. Mudar para:
  - Sem variante → `bg-secondary/20 text-muted-foreground/50` + ícone do dispositivo apagado (cinza), badge "—" (atual).
  - Com variante → tom **`bg-emerald-500/20 text-emerald-300`** com **ícone do dispositivo verde** + um pequeno `<CheckCircle2>` no canto + bytes economizados.
  - Tooltip atualizado: "Variante mobile pronta · 245 KB · −62%" / "Variante mobile ainda não disponível".
- Em estado `processing`: cada chip mostra `<Loader2 class="animate-spin">` em vez do tamanho, sinalizando claramente "ainda gerando esta variante específica". Se uma variante já chegou no banco (incremental), só aquela fica verde — as outras continuam com spinner.

**Editar `src/components/admin/optimizer/ImageCard.tsx`** (modo grade):
- Mesma melhoria: estado `processing` mostra ETA "~Xs · ETA Ys" por baixo do spinner.

**Editar `src/pages/admin/BackfillRunner.tsx` → `BackfillRowImpl`:**
- Quando `status` está em `ACTIVE_STATUSES`, a barra atual já mostra %. Adicionar **3 mini-pontos coloridos** (mobile/tablet/desktop) ao lado da barra. Cada ponto vira verde **assim que a variante correspondente chega via update do `optimized_images`** (o `optimizedImageId` já é capturado em `trackedUpdate`). Como o backfill já faz polling de `waitForOptimization`, ampliar esse polling para **emitir progresso por variante** (3 ticks visuais: mobile → tablet → desktop) e expor isso no `BackfillProgressItem` como `readyDevices: Set<DeviceLabel>`.

---

### Arquivos editados/criados

**Novo:**
- `supabase/migrations/<ts>_optimization_error_log.sql` — tabela + RLS.
- `supabase/migrations/<ts>_unstuck_processing.sql` — destrava as 3 imagens.
- `src/components/admin/optimizer/ErrorHistoryDialog.tsx` — modal reutilizável.

**Editado:**
- `supabase/functions/optimize-image/index.ts` — `auth.getUser()` + `insert` no log de erro.
- `src/lib/optimizerBackfill.ts` — log no catch, `readyDevices` no progress item.
- `src/lib/optimizerUpload.ts` — log no catch de upload.
- `src/pages/admin/BackfillRunner.tsx` — badge "Erro" clicável + dialog, mini-pontos por dispositivo.
- `src/components/admin/optimizer/ImageRow.tsx` — chips verdes quando variante pronta + ETA + dialog de erro.
- `src/components/admin/optimizer/ImageCard.tsx` — ETA no spinner + dialog de erro.
- `src/integrations/supabase/types.ts` — regenerado automaticamente para a nova tabela.

### Validação

1. Após redeploy, log do `optimize-image` para de mostrar `getClaims is not a function`.
2. As 3 imagens órfãs aparecem como "Erro" → clicar em **Reprocessar** gera as 3 variantes WebP em ~5s cada.
3. No backfill, badge "Erro" fica clicável → abre histórico cronológico com mensagem da edge function.
4. Em qualquer imagem `processing`, aparece "~3s decorridos · ETA ~3s" e cada chip dispositivo está com spinner; quando a variante mobile chega, o chip mobile vira verde com `−65%` mostrado, os outros continuam carregando.
5. Após 18s sem terminar, chip âmbar "Demorando mais que o normal" + botão para marcar erro manualmente, evitando novos zumbis em `processing`.

