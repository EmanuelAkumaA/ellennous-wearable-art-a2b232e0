

## Plano: Conversor com fila + logs no Cloud + integração total com cadastro de Obra + aba Galeria

### 1. Fila de processamento com status por item (Conversor)

Refatorar `QueueItem` + `ImageConverter` para usar uma máquina de estados explícita por item:

- Status: `enfileirado` → `validando` → `convertendo` → `concluído` | `falhou`.
- Barra de progresso por item (0–100%) + barra agregada no topo da fila ("3 de 7 concluídos · 1 falhou").
- Botões por item: `Tentar novamente` (quando falhou), `Pausar fila`, `Limpar concluídos`.
- Concorrência limitada a 2 conversões simultâneas (evita travar o navegador com lotes grandes).

### 2. Validações antes de converter

Centralizar em `src/lib/converterValidation.ts`:

- Tamanho máximo configurável (padrão 25 MB) → erro "Arquivo X muito grande (32 MB). Limite: 25 MB."
- Formato (MIME + extensão) → JPG, PNG, WebP, HEIC apenas.
- Dimensão mínima 200 px → evita ícones/thumbnails enviados por engano.
- Validação roda no `Dropzone` (rejeita imediatamente com toast detalhado por arquivo) **e** no `QueueItem` antes do `convertResponsivePreset` (defesa em profundidade, marca status `falhou` com mensagem clara).

### 3. Logs no Lovable Cloud (visíveis a todos os admins)

Nova tabela `conversion_logs`:

| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | gen_random_uuid |
| user_id | uuid | quem disparou |
| source | text | `converter` ou `piece_upload` |
| piece_id | uuid null | quando vier do cadastro de Obra |
| filename | text | nome original |
| original_size | int | bytes |
| optimized_size | int | bytes (soma das 3 variantes) |
| original_format | text | mime detectado |
| status | text | `success` ou `error` |
| error_message | text null | quando falhar |
| duration_ms | int | tempo total |
| desktop_path | text null | caminho gravado no bucket (quando sucesso) |
| created_at | timestamptz | now() |

RLS: SELECT/INSERT só para admins (via `has_role`). Escritor: cliente após cada conversão (sucesso ou falha).

Nova aba **"Logs"** no Conversor (4ª aba: Conversor / Histórico / Galeria / Logs):
- Tabela com filtros: status (todos/sucesso/falha), origem (conversor/obra), busca por nome de arquivo, range de data.
- Coluna "Detalhes" abre painel lateral com mensagem completa do erro.
- Botão "Exportar CSV" do filtro atual.

### 4. Integração total Cadastro de Obra → Conversor → Logs

Já temos `uploadGalleryImage` chamando `convertResponsivePreset` em `PiecesManager`. Vamos:

- Adicionar barra de progresso por arquivo durante o upload no modal de Obra (hoje só tem toast no fim).
- Mostrar status em tempo real na grade de drafts: `Convertendo (40%)` → `Subindo` → `Pronto` | `Falhou ✕ Tentar novamente`.
- Aplicar as mesmas validações da seção 2 antes de chamar o uploader.
- Toda conversão (sucesso ou erro) grava em `conversion_logs` com `source='piece_upload'` e `piece_id=workingPieceId`.
- **Sem job agendado** — conforme escolhido, o upload converte na hora.

### 5. Nova aba "Galeria" dentro do Conversor

Vista única dividida em duas seções:

**Topo — Staging (não-associadas)**
- Imagens convertidas pelo Conversor avulso e que o admin marcou "Enviar para galeria" (botão novo no `QueueItem`).
- Sobem para o bucket `gallery` em `staging/{uuid}/{mobile,tablet,desktop}.webp`.
- Cada cartão permite: visualizar variantes, **associar a uma obra existente** (select de obras → vira `gallery_piece_images` ou capa), descartar.

**Abaixo — Listagem completa por obra**
- Agrupada por obra (accordion), mostra capa + cada `gallery_piece_images` + suas 3 variantes (mobile/tablet/desktop) com badges clicáveis.
- Ações por imagem: **Re-associar** (mover para outra obra), **Definir como capa**, **Remover**, **Reconverter** (regera as 3 variantes a partir da desktop existente).
- Marcação manual: cada variante tem toggle "ativa/inativa" gravado em nova coluna `variant_overrides jsonb` em `gallery_piece_images` (permite forçar o site a só servir certas larguras).

Para o staging precisamos de uma nova tabela `gallery_staging_images` (id, user_id, desktop_url, desktop_path, mobile_path, tablet_path, original_filename, sizes jsonb, created_at) com RLS admin-only.

### 6. Diagrama de dados

```text
[Conversor avulso] ──► IndexedDB (histórico local, mantido)
       │
       ├─► (botão "Enviar p/ galeria") ──► storage gallery/staging/* ──► gallery_staging_images
       │                                                                       │
       │                                                                       ▼
       │                                                              [Aba Galeria - Staging]
       │                                                                       │ (associar)
       │                                                                       ▼
       │                                                              gallery_piece_images
       │
       └─► conversion_logs (toda conversão)

[Cadastro de Obra] ──► uploadGalleryImage ──► gallery/{pieceId}/{uuid}/{mobile,tablet,desktop}.webp
                                          └─► conversion_logs (source=piece_upload)
```

### Detalhes técnicos

**Arquivos novos**
- `src/lib/converterValidation.ts` — funções `validateFile(file, opts)` retornando `{ ok, errors }`.
- `src/lib/conversionLogs.ts` — `logConversion({...})` com fallback silencioso (logs nunca quebram upload).
- `src/lib/galleryStaging.ts` — `uploadStaging`, `listStaging`, `attachStagingToPiece`, `discardStaging`.
- `src/components/admin/converter/QueueProgressBar.tsx` — barra agregada.
- `src/components/admin/converter/LogsTable.tsx` — tela de logs com filtros.
- `src/components/admin/converter/GalleryTab.tsx` — staging + listagem por obra.
- `src/components/admin/converter/AssociatePieceDialog.tsx`.

**Arquivos editados**
- `src/components/admin/converter/QueueItem.tsx` — refatorar para máquina de estados; adicionar botão "Enviar p/ galeria".
- `src/components/admin/converter/Dropzone.tsx` — chamar `validateFile`, mostrar erros por arquivo rejeitado.
- `src/pages/admin/ImageConverter.tsx` — 4 abas: Conversor / Histórico / Galeria / Logs.
- `src/pages/admin/PiecesManager.tsx` — barra de progresso + status por draft + log no Cloud.
- `src/lib/galleryUploader.ts` — emitir callbacks de progresso (`onProgress`).

**Migration `add_conversion_pipeline.sql`**
```sql
create table public.conversion_logs (...);
alter table public.conversion_logs enable row level security;
create policy "Admins read logs"   on public.conversion_logs for select to authenticated using (has_role(auth.uid(),'admin'));
create policy "Admins insert logs" on public.conversion_logs for insert to authenticated with check (has_role(auth.uid(),'admin') and user_id = auth.uid());
create index conversion_logs_created_idx on public.conversion_logs (created_at desc);

create table public.gallery_staging_images (...);
alter table public.gallery_staging_images enable row level security;
-- 4 policies (select/insert/update/delete) restritas a admin

alter table public.gallery_piece_images add column variant_overrides jsonb;
```

**Larguras**: mantidas em 480 / 768 / 1200 (sem alterações em `imageConverter.ts`).

**Nada de cron / pg_cron** — confirmado.

**Sem mudanças** em `src/integrations/supabase/client.ts` nem em `types.ts` (regenera automático).

