

## Plano — Criar conta superadmin e validar backend

### Verificação do backend
Sim, o backend é **Supabase** (via Lovable Cloud). Confirmado pela configuração ativa:
- **Tabelas**: `gallery_categories`, `gallery_pieces`, `gallery_piece_images`, `user_roles` — todas com RLS habilitada.
- **Auth**: GoTrue rodando (logs ativos às 21:39 UTC).
- **Storage**: bucket `gallery` público.
- **Funções**: `has_role()`, `handle_new_user_admin_bootstrap()`, `set_updated_at()` instaladas.
- **Trigger bootstrap**: o primeiro usuário a se cadastrar recebe automaticamente o papel `admin`.

### Criação da conta superadmin

Vou criar a conta `ellennouss@gmail.com` com a senha `Singeki02@` diretamente no Supabase Auth via edge function administrativa (usando `SUPABASE_SERVICE_ROLE_KEY` que já está configurada como secret), com email já confirmado para login imediato.

**Passos:**

1. **Edge function temporária `bootstrap-admin`** (deletada após uso):
   - Usa `service_role` para criar usuário com `email_confirm: true`.
   - Garante role `admin` na tabela `user_roles` (idempotente — se já existir alguém com admin, apenas adiciona role à nova conta).
   - Protegida: só executa se nenhum admin existir OU se receber a chave secreta correta no header.

2. **Invocação automática** da function logo após o deploy.

3. **Confirmação**: query no `auth.users` + `user_roles` para validar que a conta existe, está confirmada e tem papel admin.

4. **Limpeza**: remover a edge function após o uso para não deixar superfície de ataque.

### Observação de segurança
A senha foi compartilhada em texto puro neste chat. Recomendo trocá-la após o primeiro login (posso adicionar uma tela de "alterar senha" no admin se quiser).

### Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/bootstrap-admin/index.ts` | novo (temporário) — cria usuário + role |
| `supabase/config.toml` | bloco da function com `verify_jwt = false` |
| (após uso) | deletar a edge function |

