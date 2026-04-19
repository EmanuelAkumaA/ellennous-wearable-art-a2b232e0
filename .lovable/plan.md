

## Plano — Mini sistema admin para gerenciar a Galeria

### Stack
- **Lovable Cloud** (Supabase gerenciado): auth + banco + storage de imagens.
- Sem cadastro público — primeiro usuário a se registrar vira admin (via trigger), depois o signup é bloqueado.

### 1. Botão discreto de acesso

Novo `FloatingAdmin.tsx`, fixo em `bottom-5 right-24` (à esquerda do WhatsApp), círculo `h-10 w-10`, ícone `Lock` (lucide), borda sutil sem glow. Clique → `/admin` (rota protegida que redireciona para `/admin/login` se não autenticado).

### 2. Backend (Lovable Cloud)

**Tabelas:**
- `gallery_categories` — `id`, `nome` (unique), `ordem`, `created_at`.
- `gallery_pieces` — `id`, `nome`, `categoria_id` (fk), `descricao`, `conceito`, `historia` *(novo campo)*, `tempo`, `destaque`, `novo`, `ordem`, `created_at`.
- `gallery_piece_images` — `id`, `piece_id` (fk cascade), `url`, `ordem`.
- `user_roles` — padrão seguro (enum `app_role`, função `has_role()` security definer).

**RLS:** SELECT público em todas as 3 tabelas da galeria; INSERT/UPDATE/DELETE só para `has_role(auth.uid(), 'admin')`.

**Storage:** bucket `gallery` público para leitura, upload restrito a admins via policy.

**Bootstrap admin:** trigger no `auth.users` insere role `admin` se for o primeiro usuário; signup desabilitado depois (ou só você cria via dashboard).

### 3. Páginas admin

- `/admin/login` — email + senha (shadcn Form + zod, validação trim/length).
- `/admin` — layout protegido com 2 abas:
  - **Categorias**: listar / adicionar / editar / remover (input + ordem).
  - **Obras**: listar / criar / editar / remover. Form com nome, categoria (select), descrição, conceito, **história**, tempo, flags `destaque`/`novo`, e gerenciador de imagens (upload múltiplo, reordenar, remover).
- `ProtectedRoute` que checa sessão + role admin.

### 4. Refatoração da Galeria pública

- Remover `pieces.ts` estático.
- Novo hook `useGalleryData()` busca categorias + obras + imagens via Supabase.
- Modal exibe novo campo **História** entre Conceito e Tempo.
- Skeleton enquanto carrega.

### 5. Seed inicial

As 7 obras atuais (`gallery-*.jpg` em `src/assets`) serão migradas para o banco + storage automaticamente, mantendo a galeria funcional desde o primeiro deploy.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/FloatingAdmin.tsx` | novo — botão discreto |
| `src/pages/Index.tsx` | renderiza `<FloatingAdmin />` |
| `src/hooks/useAuth.ts` | novo — sessão + isAdmin |
| `src/components/admin/ProtectedRoute.tsx` | novo |
| `src/pages/admin/Login.tsx` | novo |
| `src/pages/admin/Dashboard.tsx` | novo (abas) |
| `src/pages/admin/CategoriesManager.tsx` | novo |
| `src/pages/admin/PiecesManager.tsx` | novo (com upload) |
| `src/components/sections/gallery/useGalleryData.ts` | novo — fetch Supabase |
| `src/components/sections/gallery/Gallery.tsx` | usa hook + exibe história |
| `src/components/sections/gallery/pieces.ts` | remover |
| `src/App.tsx` | rotas `/admin/login` e `/admin` |
| Migrações Cloud | tabelas + RLS + bucket + role + seed |

### Pergunta importante
Para isso funcionar preciso habilitar o **Lovable Cloud** (banco + auth + storage gerenciados). Aprovando o plano, habilito automaticamente.

