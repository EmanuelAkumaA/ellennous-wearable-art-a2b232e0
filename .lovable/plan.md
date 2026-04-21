

## Plano: porcentagens por imagem + aviso final no Backfill

### 1. Progresso individual (download e otimização) por linha

**Arquivos:** `src/lib/optimizerBackfill.ts`, `src/pages/admin/BackfillRunner.tsx`

- Adicionar campo `progress: number` (0–100) em `BackfillProgressItem`.
- Em `migrateLegacyImage`:
  - **Download (0–40%)**: usar `fetch` com leitura via `ReadableStream` + `Content-Length` para emitir `progress` em incrementos enquanto baixa o blob (mapeado para 0–40%).
  - **Upload (40–60%)**: emitir 50% logo antes de chamar `uploadToOptimizer` e 60% logo após resolver (a SDK do Supabase Storage não expõe progresso nativo no browser; mantemos um pulso de 50% para feedback visual).
  - **Otimização (60–99%)**: `waitForOptimization` recebe um `onPoll(elapsedMs)` que estima progresso baseado no tempo decorrido (assíntota até 99%) até o status virar `ready` → 100%.
- Cada transição já chama `onStatus`; passamos `progress` no segundo argumento.

### 2. UI por linha com barra de progresso e %

**Arquivo:** `src/pages/admin/BackfillRunner.tsx`

- Em `BackfillRow`, sob o nome da imagem, renderizar uma micro-barra `h-1` quando `status` ∈ {downloading, uploading, optimizing} com:
  - largura animada controlada por `progress`
  - rótulo à direita: `{progress}%` + verbo da etapa atual (ex: "Baixando 32%")
- Quando `status === "done"`: mostrar "100% · concluída" em verde por ~2s.

### 3. Progresso global ponderado

**Arquivo:** `src/pages/admin/BackfillRunner.tsx`

- A barra de progresso global passa a usar a média de `progress` de todos os itens (em vez de só `done/total`), refletindo download + otimização em curso.
- Mantém o número grande "Otimizadas: N/M" ao lado.

### 4. Aviso visual quando tudo estiver pronto

**Arquivo:** `src/pages/admin/BackfillRunner.tsx`

Quando `running` virar `false` e `stats.done === stats.total && stats.total > 0`:
- **Toast** já existe; trocar por `sonner` para suportar ícone de sucesso e duração maior (6s).
- Renderizar um **banner persistente** no topo (substitui o card azul informativo enquanto não for descartado): fundo `emerald/10`, ícone `CheckCircle2` grande, título **"Tudo otimizado!"**, descrição "As N imagens da galeria foram migradas para o pipeline. Recarregue o site público para ver os novos formatos AVIF/WebP." + botão **"Recarregar galeria"** (`window.location.reload()` em nova aba `/`) e **"Dispensar"**.
- Som curto opcional (sino sutil via `new Audio()`) — *só se o user quiser; padrão desligado*.

### Detalhes técnicos

- **Streamed fetch**: 
  ```ts
  const reader = resp.body!.getReader();
  const total = Number(resp.headers.get("content-length")) || 0;
  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onStatus("downloading", { progress: Math.round((received / total) * 40) });
  }
  const blob = new Blob(chunks, { type: ct });
  ```
- **Otimização estimada**: `progress = 60 + Math.min(38, Math.round(elapsedMs / 2500))` — chega a ~98% em ~95s, depois 100% no ready.

### Arquivos editados

- `src/lib/optimizerBackfill.ts` — streamed fetch, polling com estimativa, novo campo `progress`
- `src/pages/admin/BackfillRunner.tsx` — barra por linha + barra global ponderada + banner final + toast com sonner

### Validação

1. Rodar backfill: cada linha mostra "Baixando 12% → 40% → Enviando 50% → Otimizando 72% → Pronta 100%".
2. Barra global cresce continuamente em vez de saltar entre 0% → 12% → 25%.
3. Ao terminar todas: toast verde "Tudo otimizado" e banner persistente com botão de recarregar a galeria.
4. Em caso de erro numa linha, ela mantém status "Erro", barra fica vermelha e a global ainda atinge 100% das demais.

