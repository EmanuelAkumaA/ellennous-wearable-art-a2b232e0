

## Plano — Aba Avaliações com links únicos e moderação

### Conceito
Nova aba "Avaliações" no admin onde o administrador gera **links únicos com validade configurável** (padrão 24h, ajustável). Cada link abre uma página pública de avaliação para o cliente preencher. Avaliações enviadas ficam **pendentes**, e o admin aprova/recusa — só as aprovadas aparecem na seção "Quem veste a Ellennous" do site público.

### 1. Schema (migration)

**Tabela `review_invites`** — links gerados:
| coluna | tipo | descrição |
|---|---|---|
| `id` | uuid PK | |
| `token` | text unique | string aleatória da URL |
| `expires_at` | timestamptz | validade |
| `used_at` | timestamptz null | quando o cliente enviou |
| `revoked` | boolean default false | admin pode invalidar |
| `created_at` | timestamptz | |
| `note` | text null | nota interna (ex: nome do cliente) |

**Tabela `reviews`** — avaliações:
| coluna | tipo | descrição |
|---|---|---|
| `id` | uuid PK | |
| `invite_id` | uuid FK → review_invites | |
| `client_name` | text | nome de quem avalia |
| `client_role` | text null | "cliente", "noiva", etc (opcional) |
| `rating` | int 1–5 | |
| `content` | text | depoimento |
| `photo_url` | text null | foto opcional |
| `photo_storage_path` | text null | |
| `status` | text default 'pending' | `pending` / `approved` / `rejected` |
| `ordem` | int default 0 | ordem na seção pública |
| `created_at`, `updated_at` | timestamptz | |

**RLS**:
- `review_invites`: admin full CRUD; **público pode SELECT por token** (validar link).
- `reviews`: admin full CRUD; **público pode INSERT** se invite válido (via edge function que valida); **público pode SELECT só os `approved`** (para aparecer no site).

**Bucket storage**: reusar `gallery` ou criar `reviews` (público).

### 2. Edge function `submit-review`
Valida o token (não expirado, não usado, não revogado), marca invite como `used_at = now()`, insere review com `status='pending'`. Evita que cliente insira diretamente sem passar pela validação.

### 3. Aba "Avaliações" no admin

**Arquivos**:
- `src/components/admin/AdminShell.tsx` — adicionar nav item `reviews` (ícone `Star`).
- `src/pages/admin/Dashboard.tsx` — montar `<ReviewsManager />` quando `tab === "reviews"`.
- `src/pages/admin/ReviewsManager.tsx` — NOVO.

**UI ReviewsManager** (3 seções em tabs internos ou colapsáveis):

a) **Gerar link**:
- Input "Validade" (number) + select "horas/dias" (default 24h).
- Input opcional "Nota interna" (ex: nome do cliente).
- Botão "Gerar link" → cria invite, mostra URL pronta `https://.../avaliar/{token}` com botão copiar e botão WhatsApp (`wa.me/?text=...`).
- Aviso se já existir invite ativo (não usado e não expirado): mostra esse e oferece "Revogar e gerar novo".

b) **Links ativos**:
- Lista compacta: nota, expira em X, copiar, revogar.

c) **Avaliações recebidas**:
- Tabs: Pendentes / Aprovadas / Recusadas.
- Card por avaliação: foto, nome, estrelas, texto, data.
- Ações: Aprovar / Recusar / Excluir / reordenar (drag nas aprovadas).

### 4. Página pública (placeholder agora, completa no próximo passo)
Apenas reservar a rota `/avaliar/:token` em `App.tsx` apontando para um `<ReviewSubmit />` stub. A construção completa vem na próxima etapa, conforme combinado.

### 5. Integração com Testimonials
Apenas garantir que `Testimonials.tsx` consiga ler `reviews` aprovadas (query simples via supabase). Refactor pleno fica para depois — o foco agora é o admin.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| migration nova | tabelas + RLS + storage |
| edge `submit-review/index.ts` | NOVO |
| `src/components/admin/AdminShell.tsx` | nav item "Avaliações" |
| `src/pages/admin/Dashboard.tsx` | render ReviewsManager |
| `src/pages/admin/ReviewsManager.tsx` | NOVO — gerar/listar/moderar |
| `src/App.tsx` | rota `/avaliar/:token` (stub) |
| `src/pages/ReviewSubmit.tsx` | NOVO stub |

### Validação
1. Aba "Avaliações" aparece na sidebar.
2. Gerar link com 24h → URL copiável e funcional (abre stub).
3. Link expirado/usado/revogado não permite envio.
4. Lista de avaliações pendentes recebe novos envios.
5. Aprovar avaliação → fica disponível para a seção pública.

