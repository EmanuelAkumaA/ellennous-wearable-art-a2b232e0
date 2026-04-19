

## Plano — Fade-in das obras + mini sistema admin (Lovable Cloud)

### Parte 1 — Animação fade-in nas novas obras (Galeria)

- Adicionar keyframe `fade-up` no `tailwind.config.ts` (opacity 0→1 + translateY 20px→0, ~600ms).
- Em `Gallery.tsx`, calcular `previousCount` (via `useRef`) para identificar quais cards são "novos" após clicar em "Ver mais obras".
- Aplicar `animate-fade-up` apenas nos cards com índice `>= previousCount`. Os já visíveis não re-animam.
- Pequeno `style={{ animationDelay: '${(idx - previousCount) * 80}ms' }}` para entrada em cascata sutil.

### Parte 2 — Mini sistema admin conectado ao Lovable Cloud

#### Botão de acesso
- Novo componente `FloatingAdmin.tsx`: ícone discreto (lucide `Lock` ou `Settings`), posicionado fixo no canto inferior direito **à esquerda do WhatsApp** (`bottom-5 right-24`).
- Estilo discreto: círculo menor (h-10 w-10), borda sutil, sem glow chamativo.
- Clicar → navega para `/admin` (se logado) ou `/admin/login`.

#### Autenticação (Lovable Cloud / Supabase Auth)
- Habilitar Lovable Cloud no projeto.
- Apenas email + senha. Sem cadastro público — admin é criado manualmente pela dona via dashboard do Cloud (ou primeiro signup vira admin).
- Tabela `user_roles` com enum `app_role` (`admin`) + função `has_role()` security definer (padrão seguro recomendado).
- Hook `useAuth` para sessão + `onAuthStateChange`.

#### Tabelas no Supabase
1. **`gallery_categories`**
   - `id` (uuid), `nome` (text, unique), `ordem` (int), `created_at`.
   - RLS: SELECT público; INSERT/UPDATE/DELETE só admin.

2. **`gallery_pieces`**
   - `id` (uuid), `nome`, `categoria_id` (fk), `descricao`, `conceito`, `historia`, `tempo`, `destaque` (bool), `novo` (bool), `ordem` (int), `created_at`.
   - RLS: SELECT público; mutações só admin.

3. **`gallery_piece_images`**
   - `id` (uuid), `piece_id` (fk, cascade), `url` (text), `ordem` (int).
   - RLS: SELECT público; mutações só admin.

4. **Storage bucket `gallery`** (público para leitura, upload só admin via policy).

> **Nota:** o campo "história" é novo (atualmente só existe descrição/conceito/tempo). Será adicionado e exibido também no modal público da galeria.

#### Páginas admin
- `/admin/login` — formulário email/senha (shadcn Form + zod).
- `/admin` — layout protegido (redireciona se não logado/não admin), com 2 abas:
  - **Categorias**: lista + adicionar/editar/remover (input simples + ordem).
  - **Obras**: lista + botão "Nova obra" → modal/sheet com formulário:
    - Nome, categoria (select), descrição, conceito, história, tempo, flags `destaque`/`novo`.
    - Upload múltiplo de imagens (Supabase Storage), reordenar/remover imagens existentes.
- Logout no header do admin.

#### Refatoração da Galeria pública
- `pieces.ts` (mock estático) → substituído por hook `useGalleryData()` que busca de `gallery_pieces` + `gallery_piece_images` + `gallery_categories` via Supabase.
- Loading state simples (skeleton) e fallback de erro.
- Tipos `Category` e `Piece` migrados para refletir schema do banco.
- Modal exibe novo campo "história" entre conceito e tempo.

### Arquivos afetados / novos

| Arquivo | Mudança |
|---|---|
| `tailwind.config.ts` | keyframe + animation `fade-up` |
| `src/components/sections/gallery/Gallery.tsx` | animação cascata + ler dados do hook |
| `src/components/sections/gallery/pieces.ts` | remover (ou deixar só types) |
| `src/components/sections/gallery/useGalleryData.ts` | **novo** — fetch Supabase |
| `src/components/FloatingAdmin.tsx` | **novo** — botão discreto |
| `src/pages/Index.tsx` | renderizar `<FloatingAdmin />` |
| `src/hooks/useAuth.ts` | **novo** — sessão + role admin |
| `src/pages/admin/Login.tsx` | **novo** |
| `src/pages/admin/Dashboard.tsx` | **novo** com abas Categorias/Obras |
| `src/pages/admin/CategoriesManager.tsx` | **novo** |
| `src/pages/admin/PiecesManager.tsx` | **novo** (com upload de imagens) |
| `src/components/admin/ProtectedRoute.tsx` | **novo** — guarda rota |
| `src/App.tsx` | rotas `/admin/login`, `/admin` |
| Migrações Supabase | tabelas + RLS + bucket storage + role admin |

### Pontos de atenção
- **Como criar o primeiro admin?** Após Lovable Cloud habilitado, você cria a conta no `/admin/login` (signup), e eu insiro manualmente sua role `admin` na tabela `user_roles` via migration ou orientação.
- A galeria pública continuará funcionando sem login — só leitura.
- Imagens atuais (`/src/assets/gallery-*.jpg`) viram a base — posso fazer um seed inicial migrando-as para o banco/storage, ou começar do zero (você re-cadastra via admin). **Pergunto isso abaixo.**

