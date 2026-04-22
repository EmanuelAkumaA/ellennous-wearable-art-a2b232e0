

## Plano: rodar conversão WebP + otimização em todas as imagens do Backfill

### Contexto

A pré-conversão WebP no cliente (que implementamos no plano anterior) **já está integrada** em `optimizerUpload.ts`. Toda imagem que passa pelo backfill hoje **já é convertida para WebP no navegador** antes do upload e antes da edge gerar as 3 variantes. O fluxo no backfill é:

```
[backfill] cada imagem
   ├─ download do legado (JPG/PNG do bucket gallery)
   ├─ uploadToOptimizer  ← já chama convertToWebp() internamente
   │     → master.webp no bucket optimized-images
   ├─ edge function gera mobile/tablet/desktop
   ├─ atualiza gallery_pieces / gallery_piece_images com a URL nova
   └─ master.webp é removido após sucesso
```

Então o que falta é só **disparar isso para todas as imagens detectadas** com um único clique e dar feedback claro de que a conversão WebP está acontecendo etapa por etapa.

### 1. Botão "Converter tudo para WebP e otimizar"

**Editar `src/pages/admin/BackfillRunner.tsx`:**

- Novo botão primário no topo da barra de ações: **"Converter tudo para WebP e otimizar (N)"** onde N = `atRiskCount` (pendentes + erros).
- Clicar no botão:
  1. Chama `selectAtRisk()` para marcar todos os elegíveis.
  2. Imediatamente chama `start()` para disparar o backfill.
  3. Toast: "Iniciando conversão WebP + otimização de N imagens".
- Protegido pelo mesmo `runWithLock("optimizer:backfill")` que já existe — cliques duplos / multi-aba são bloqueados.
- Botão fica `disabled` quando `running || atRiskCount === 0` (e visualmente "concluído" se 0).

### 2. Status "Convertendo WebP" visível no progresso

Hoje o `BackfillProgressItem.status` tem: `pending | downloading | uploading | optimizing | done | skipped | error`. A conversão WebP acontece **dentro** do `uploading` (em `uploadToOptimizer`), invisível para o usuário.

**Adicionar status `"converting"`** entre `downloading` e `uploading`:

- `src/lib/optimizerBackfill.ts → migrateLegacyImage`: após `downloading` (40%), emitir `onStatus("converting", { progress: 45 })` antes de chamar `uploadToOptimizer`.
- `uploadToOptimizer` ganha um callback opcional `onConversionDone?: (ms: number) => void` — quando o WebP fica pronto, o backfill move para `uploading` (50%).
- `STATUS_LABEL.converting = "Convertendo WebP"` e `STATUS_TONE.converting = "text-blue-400"`.
- Ícone: `Sparkles` ou `Wand2` para destacar a etapa nova.

### 3. Mostrar tempo de conversão por imagem

- `BackfillProgressItem` ganha campo opcional `conversionMs?: number`.
- Após a conversão, `migrateLegacyImage` faz `onStatus("uploading", { conversionMs })`.
- `BackfillRow` exibe sutilmente "WebP em 1.4s" ao lado do nome do arquivo quando disponível, dando feedback do ganho.

### 4. Reaproveitar painel de tempos médios

O `<ProcessingTimingsCard />` que adicionamos no `ImageOptimizer` já agrega o tempo de conversão (`webp_client_conversion`). Sem mudança extra: a cada imagem do backfill, ele alimenta as métricas e o card mostra a média atualizada.

### Validação

1. Detectar imagens legadas → ver contagem N no botão "Converter tudo para WebP e otimizar".
2. Clicar uma vez → todas selecionadas, run inicia.
3. Cada linha mostra fluxo completo: `Baixando → Convertendo WebP (azul) → Enviando → Otimizando → Pronta`.
4. Após o run, `<ProcessingTimingsCard />` no Otimizador mostra média de conversão calculada com os dados do backfill.

### Arquivos editados

- `src/lib/optimizerBackfill.ts` — novo status `"converting"`, callback de conversão, captura de `conversionMs`.
- `src/lib/optimizerUpload.ts` — aceita callback `onConversionDone`.
- `src/pages/admin/BackfillRunner.tsx` — novo botão "Converter tudo para WebP e otimizar", labels/ícones do status `converting`, exibição de `conversionMs`.

