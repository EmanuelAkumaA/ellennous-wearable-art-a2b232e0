

## Plano: aba "Image Optimizer" no admin

### Escopo realista (o que dá pra fazer aqui)

O Lovable Cloud Storage **não tem** transformação on-the-fly nem CDN com query params (`?width=800&format=webp`). Por isso o item 5 do briefing ("URL dinâmica") **não é viável** sem reescrever a infra. A solução prática: **pré-gerar todas as variantes no upload** via edge function usando `@jsquash/avif`, `@jsquash/webp` e `@jsquash/jpeg` (rodam em Deno/WASM, sem dependências nativas). Tudo o resto do briefing fica completo.

### 1. Banco — nova tabela `optimized_images`

```sql
create table public.optimized_images (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- nome amigável
  original_path text not null,           -- /images/{id}/original.ext
  original_size_bytes integer not null,
  original_width integer,
  original_height integer,
  status text not null default 'processing',  -- processing | ready | error
  error_message text,
  variants jsonb not null default '[]',  -- [{width, format, path, url, size_bytes}]
  total_optimized_bytes integer,         -- soma das variantes (para % economia)
  used_count integer not null default 0, -- marcação manual de "usada no site"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS: admin full access; público pode `SELECT` (porque as URLs servidas no site público precisam funcionar mesmo sem login).

Trigger `set_updated_at` no update.

### 2. Storage — novo bucket `optimized-images` (público)

Estrutura: `images/{id}/original.{ext}`, `images/{id}/{width}.avif|webp|jpg`. Bucket separado de `gallery` para não misturar com obras existentes.

### 3. Edge Function `optimize-image`

`supabase/functions/optimize-image/index.ts` — recebe `{ imageId }`, baixa o original do storage, gera variantes em paralelo:

- **Larguras**: 400, 800, 1200, 1600 (pula larguras maiores que o original)
- **Formatos por largura**: AVIF (q60), WebP (q75), JPEG (q85)
- **Libs**: `@jsquash/avif`, `@jsquash/webp`, `@jsquash/jpeg`, `@jsquash/resize` via esm.sh
- **Strip EXIF**: automático (re-encoding já remove)
- Faz upload de cada variante, monta `variants[]`, atualiza row para `status='ready'` com `total_optimized_bytes`.
- Em erro: `status='error'` + `error_message`.
- `verify_jwt = true` (só admin chama).

Tempo esperado: ~5-15s por imagem dependendo do tamanho. Função roda assíncrona — UI mostra status "processando".

### 4. Frontend — nova aba "Image Optimizer"

**Arquivos novos:**
- `src/pages/admin/ImageOptimizer.tsx` — página principal
- `src/components/admin/optimizer/UploadDropzone.tsx` — drag-and-drop + botão (aceita JPG/PNG/WebP, max 10MB)
- `src/components/admin/optimizer/ImageCard.tsx` — card no grid com preview, status, % economia, ações
- `src/components/admin/optimizer/CodeSnippetDialog.tsx` — modal com `<picture>` gerado + botão copiar
- `src/components/admin/optimizer/ImageDetailSheet.tsx` — sheet lateral com variantes, antes/depois, marcar como "usada"

**Integração no admin shell:**
- `src/components/admin/AdminShell.tsx` — adicionar nav item `optimizer` com ícone `Wand2`
- `src/pages/admin/Dashboard.tsx` — adicionar `tab === "optimizer"` e incluir em `VALID_TABS`

**Funcionalidades da aba:**

| Briefing | Implementação |
|---|---|
| Upload drag-and-drop + botão | UploadDropzone com `react-dropzone` (já não tá instalado — uso HTML5 nativo `onDragOver/onDrop`) |
| Limite 10MB | validação client-side antes de subir |
| Histórico em grid | grid responsivo com paginação simples (limite 50, "carregar mais") |
| Filtros: Recentes / Mais usadas | tabs em cima do grid |
| Busca por nome/ID | input com debounce |
| Status (processando/pronto) | badge colorido + skeleton enquanto `status='processing'` |
| Realtime de status | `supabase.channel().on('postgres_changes')` na tabela para atualizar sem refresh |
| % economia | `((original_size - total_optimized) / original_size * 100).toFixed(1)` |
| Antes vs depois | tabela no detail sheet com cada variante e seu peso |
| Copiar código `<picture>` | gera snippet com `<source type="image/avif">`, `<source type="image/webp">`, `<img>` fallback, `srcset` com 1x/2x, `sizes="(max-width:640px) 400px, (max-width:1024px) 800px, 1200px"`, `loading="lazy"`, `decoding="async"` |
| Marcar como usada | botão toggle que incrementa/zera `used_count` (uso simples, não auto-detect) |
| Reprocessar | re-invoca `optimize-image` mantendo o original |
| Excluir | apaga linha + remove pasta `images/{id}/` do storage |

### 5. Fluxo de upload

1. User arrasta arquivo → validação tamanho/formato
2. Insere row em `optimized_images` com `status='processing'`
3. Sobe original para `optimized-images/images/{id}/original.{ext}`
4. Chama `supabase.functions.invoke('optimize-image', { body: { imageId } })` (sem await — fire-and-forget; UI já mostra card "processando")
5. Realtime notifica quando a row vira `ready`, card atualiza com preview e ações

### 6. Snippet `<picture>` gerado (exemplo)

```html
<picture>
  <source type="image/avif"
    srcset="URL_400.avif 400w, URL_800.avif 800w, URL_1200.avif 1200w, URL_1600.avif 1600w"
    sizes="(max-width:640px) 400px, (max-width:1024px) 800px, 1200px" />
  <source type="image/webp"
    srcset="URL_400.webp 400w, URL_800.webp 800w, URL_1200.webp 1200w, URL_1600.webp 1600w"
    sizes="(max-width:640px) 400px, (max-width:1024px) 800px, 1200px" />
  <img src="URL_800.jpg"
    srcset="URL_400.jpg 400w, URL_800.jpg 800w, URL_1200.jpg 1200w, URL_1600.jpg 1600w"
    sizes="(max-width:640px) 400px, (max-width:1024px) 800px, 1200px"
    loading="lazy" decoding="async" alt="" />
</picture>
```

### Item 5 do briefing — URL dinâmica

**Não vai ser implementado.** O storage do Lovable Cloud não suporta image transformation via query params, e implementar uma edge function que faz transform on-the-fly + cache seria caro (cold start de 5-10s a cada miss de cache, pesado em CPU). O pré-processamento no upload entrega o mesmo resultado prático (todas as variantes prontas, servidas do CDN do storage) com performance muito melhor. Aviso isso no card de boas-vindas da aba.

### Arquivos modificados/criados

**Novos:**
- `supabase/migrations/{timestamp}_optimized_images.sql` — tabela + bucket + RLS
- `supabase/functions/optimize-image/index.ts` — pipeline de processamento
- `supabase/config.toml` — bloco `[functions.optimize-image]` com `verify_jwt = true`
- `src/pages/admin/ImageOptimizer.tsx`
- `src/components/admin/optimizer/UploadDropzone.tsx`
- `src/components/admin/optimizer/ImageCard.tsx`
- `src/components/admin/optimizer/ImageDetailSheet.tsx`
- `src/components/admin/optimizer/CodeSnippetDialog.tsx`
- `src/lib/imageSnippet.ts` — helper que gera o HTML

**Editados:**
- `src/components/admin/AdminShell.tsx` — adicionar nav item
- `src/pages/admin/Dashboard.tsx` — adicionar tab + VALID_TABS

### Validação

1. Upload de JPG 4MB → 12 variantes (4 larguras × 3 formatos) geradas em ~10s, status vira "ready" via realtime.
2. Snippet copiado → cola no `<body>` de qualquer HTML, navegador escolhe AVIF se suportar.
3. Reprocessar mantém o original e regenera as variantes.
4. Excluir limpa storage e tabela.
5. Filtro "Mais usadas" ordena por `used_count desc`.
6. Tentar subir 15MB → bloqueado client-side com toast.

