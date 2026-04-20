

## Plano — Formulário público de avaliação + integração com site + reordenação

### 1. Página pública `/avaliar/:token` (formulário completo)

Substituir o stub atual do `ReviewSubmit.tsx` por um formulário completo, mantendo o pré-check do token via GET na edge function.

**Estrutura do formulário** (aparece só quando `status === "valid"`):
- **Nome do cliente** (input, obrigatório, max 120)
- **Papel/relação** (input opcional, ex: "cliente", "noiva", "tatuador parceiro", max 60)
- **Avaliação em estrelas** (1–5) — componente custom com 5 ícones `Star` clicáveis (hover preview + estado selecionado), cor `primary-glow`.
- **Depoimento** (textarea, obrigatório, max 2000, com contador)
- **Foto opcional** — input file (image/*, max 5MB). Preview circular. Upload direto ao bucket `reviews` (público) com nome `public/{token}-{timestamp}.{ext}`. Como o bucket é público e RLS de storage permite insert anônimo? Vou conferir — se não permitir, faço upload via FormData para a edge function (extensão da mesma) ou crio policy de insert no bucket `reviews` para `anon`.
- **Botão Enviar** (disabled enquanto envia)

**Validação client-side**: zod schema com trim + limites + rating 1–5.

**Envio**: POST para `submit-review` com `{ token, client_name, client_role, rating, content, photo_url, photo_storage_path }`. Em sucesso: troca o estado para `submitted` e mostra tela de agradecimento ("Obrigado! Sua avaliação foi recebida e aparecerá após aprovação."). Em erro: toast com a mensagem mapeada (`invite_used`, `invite_expired`, `invite_revoked`, `insert_failed`).

**Storage RLS**: vou precisar adicionar policy no bucket `reviews` permitindo INSERT a `anon` no path `public/*` (com limite de tamanho). Migration nova.

### 2. Testimonials puxando do banco

Refatorar `Testimonials.tsx`:
- Query: `supabase.from("reviews").select("*").eq("status","approved").order("ordem").order("created_at", { ascending: false })`.
- Mapear para o formato existente do card. Como o schema atual não tem `city`, `category`, nem `handle`, vou:
  - **Remover** o badge de categoria e a linha do Instagram (não temos esses dados ainda).
  - **Manter**: foto (photo_url), nome, papel (client_role no lugar da cidade), depoimento, rating (renderizar 5 estrelas baseadas no `rating`).
- **Fallback**: se a query retornar 0 resultados, manter os 6 mocks atuais como conteúdo estático (já existe no arquivo). Boolean `useStatic = data.length === 0`.
- Estado: `useQuery` do react-query (já tem `QueryClient` no app).
- Loading: skeleton simples ou nada (carrossel só aparece quando carrega).

### 3. Reordenar avaliações aprovadas (drag-and-drop)

No `ReviewsManager.tsx`, na aba "Aprovadas":
- Usar **`@dnd-kit/core` + `@dnd-kit/sortable`** (libs leves, padrão React).
- Cada card vira `SortableItem` com handle de arrasto (ícone `GripVertical`).
- Ao soltar: recalcular `ordem` (0..N) localmente, atualizar UI otimista, fazer `supabase.from("reviews").update({ ordem }).eq("id", id)` em batch (Promise.all).
- Em pendentes/recusadas: sem drag (só ordem por data).

**Dependência nova**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

### 4. Botão "Visualizar página de avaliação"

No `ReviewsManager.tsx`, no topo (perto do gerador de link), adicionar um botão secundário **"Ver página base"** que abre `/avaliar/preview` em nova aba.

**Como funcionar sem token real**: 
- Opção A: rota especial `/avaliar/preview` que renderiza o mesmo formulário em modo demo (não envia nada, só mostra a UI). Vou por essa — adiciono check no `ReviewSubmit`: se `token === "preview"` pula a validação e marca `status = "valid"` + `previewMode = true`. No submit, em vez de chamar a função, mostra toast "Modo demonstração — nada foi enviado".
- Botão usa `<a href="/avaliar/preview" target="_blank">`.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| migration nova | RLS de storage no bucket `reviews` para INSERT anônimo no prefixo `public/` |
| `package.json` (auto via add) | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `src/pages/ReviewSubmit.tsx` | Formulário completo + modo preview + upload de foto |
| `src/components/sections/Testimonials.tsx` | Fetch de reviews aprovadas + fallback para mocks |
| `src/pages/admin/ReviewsManager.tsx` | Drag-and-drop nas aprovadas + botão "Ver página base" |
| `src/App.tsx` | (já cobre `/avaliar/:token`, `preview` é só um valor de token) |

### Validação
1. `/admin` → Avaliações → clicar "Ver página base" → abre nova aba mostrando o formulário em modo demo.
2. Gerar link real → abrir → preencher nome, papel, 4 estrelas, texto, foto → enviar → tela de obrigado.
3. Voltar ao admin → avaliação aparece em "Pendentes" com a foto.
4. Aprovar → conferir na home (`/`) seção "Quem veste a Ellennous": carrossel mostra a nova avaliação no lugar dos mocks.
5. Aprovar 3+ avaliações → arrastar para reordenar → recarregar → ordem persiste.
6. Tentar reusar o mesmo link → erro "já utilizado".

