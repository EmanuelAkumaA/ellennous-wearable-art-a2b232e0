

## Plano — Perfil com avatar em paleta de pintor + nome customizado

### Conceito visual
Substituir o avatar circular na sidebar e na aba Conta por uma **paleta de pintor estilizada** (forma orgânica com furo lateral para o polegar + 5 "tintas" coloridas no canto). Quando há foto, ela preenche o corpo da paleta; quando não, mostra iniciais. As tintas usam cores da identidade (purple, primary-glow, brand-red, ice blue, gold).

```text
       ╭─────╮
      │ ●●●  │  ← tintas (dots coloridos)
   ╭──╯      ╰──╮
  │   [foto]    │  ← paleta (clip-path orgânico)
   ╲    ⊙    ╱   ← furo do polegar
    ╲______╱
```

### 1. Backend — tabela `admin_profile`
Nova migration: tabela 1-pra-1 com `auth.users` para guardar nome de exibição e avatar.
```sql
create table public.admin_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_storage_path text,
  updated_at timestamptz default now()
);
alter table public.admin_profile enable row level security;
-- SELECT: qualquer admin lê (precisamos exibir na sidebar)
create policy "admin reads profile" on public.admin_profile
  for select to authenticated using (has_role(auth.uid(), 'admin'));
-- UPDATE/INSERT: só o próprio dono
create policy "owner upserts profile" on public.admin_profile
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```
Storage: reusar bucket `gallery` numa pasta `admin-avatars/{user_id}.jpg` (já é público — perfeito pra exibir sem signed URL).

### 2. Hook compartilhado `useAdminProfile`
`src/hooks/useAdminProfile.ts` — busca/cacheia `display_name` e `avatar_url` do usuário logado. Expõe `profile`, `loading`, `refresh()`. Usado pela sidebar e pela aba Conta.

### 3. Componente `PalettePhoto`
`src/components/admin/PalettePhoto.tsx` — SVG da paleta com:
- `clipPath` orgânico (forma de paleta com furo) aplicado na imagem/iniciais.
- 5 círculos de "tinta" no topo-direito com cores `--primary`, `--primary-glow`, `--brand-red`, `--brand-deepblue`, `--brand-gold`.
- Props: `src?`, `initials`, `size` (sm 40px / md 64px / lg 120px), `editable?` (mostra overlay "trocar foto" no hover quando true).
- Glow sutil ao redor com `drop-shadow`.

### 4. Sidebar (`AdminShell.tsx`)
- Topo da sidebar: trocar `<img className="rounded-full">` pela `<PalettePhoto size="sm" src={profile.avatar_url} initials={...} />`.
- Texto ao lado: linha 1 = `profile.display_name || "Ellennous"`; linha 2 = `ATELIER · ELLENNOUS` (mantém estilo accent uppercase).
- No drawer mobile, mesmo tratamento.

### 5. Aba Conta (`UserSettings.tsx`)
Reorganizar o card "Conta" no canto superior esquerdo:
- **Esquerda**: `PalettePhoto size="lg" editable` — clique abre input file. Upload pro Supabase Storage → atualiza `admin_profile.avatar_url` → refresh do hook (sidebar atualiza junto).
- **Direita**: Form com:
  - Input "Nome de exibição" (preenche `display_name`).
  - Email (readonly, mostrando `user.email`).
  - Botão "Salvar perfil" com `bg-gradient-purple-wine`.
- Card de senha permanece abaixo, sem mudanças.

### 6. Login (`Login.tsx`)
Sem alteração — login não tem perfil ainda.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| nova migration | tabela `admin_profile` + RLS |
| `src/components/admin/PalettePhoto.tsx` | NOVO — SVG paleta |
| `src/hooks/useAdminProfile.ts` | NOVO — fetch/update perfil |
| `src/components/admin/AdminShell.tsx` | usar PalettePhoto + display_name |
| `src/pages/admin/UserSettings.tsx` | upload avatar + form de nome |

### Validação
1. Aba Conta → upload de foto → paleta exibe a foto (com furo do polegar e tintas no canto).
2. Preencher "Nome de exibição" → salvar → sidebar atualiza imediatamente, mostrando nome novo no lugar de "Ellennous".
3. Segunda linha continua "ATELIER · ELLENNOUS".
4. Sem foto → paleta exibe iniciais.
5. Recarregar `/admin` → perfil persiste.

