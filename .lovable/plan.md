

## Plano — Remover foto, paleta com cores customizáveis e sidebar reativa

### 1. Sidebar dinâmica (bug fix)
**Problema**: `useAdminProfile` é instanciado 2x (em `AdminShell` e `UserSettings`) — cada um mantém estado próprio. Salvar em UserSettings só atualiza a instância local; sidebar continua com dados velhos até reload.

**Solução**: transformar o hook num **store compartilhado** (singleton em módulo + `useSyncExternalStore`). Toda chamada a `refresh()` propaga pra todos os consumidores. Sem Context, sem prop drilling.

```ts
// useAdminProfile.ts vira:
let state: AdminProfile = EMPTY;
const listeners = new Set<() => void>();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const fetchProfile = async (userId) => { /* ...select... */ state = data; listeners.forEach(l => l()); };
export const useAdminProfile = () => {
  const profile = useSyncExternalStore(subscribe, () => state);
  // useEffect dispara fetchProfile(user.id) quando user muda
  return { profile, refresh: () => fetchProfile(user.id) };
};
```

Resultado: ao salvar nome/foto/remover foto na aba Conta, a sidebar atualiza instantaneamente sem reload.

### 2. Botão "Remover foto" (UserSettings)
Ao lado da paleta (abaixo do label "Paleta · clique para trocar"), botão pequeno `ghost` com ícone trash, visível **só quando** `profile.avatar_url` existe.
Ação: `supabase.storage.remove([avatar_storage_path])` + `upsertProfile({ avatar_url: null, avatar_storage_path: null })` + `refresh()` → volta ao estado de iniciais.

### 3. Cores customizáveis das 5 tintas

**Schema (migration)**: adicionar coluna `palette_colors jsonb` na `admin_profile` (default `null`). Armazena array de 5 strings hex: `["#8A2AE3", "#B47CFF", "#E11D48", "#1E3A8A", "#F5C518"]`.

**Tipo no hook**: estende `AdminProfile` com `palette_colors: string[] | null`.

**`PalettePhoto`**: aceita prop `colors?: string[]`. Se vier, usa essas 5 cores; senão usa o fallback atual (`hsl(var(--primary))` etc.).

**UI em UserSettings**: novo bloco no card de Conta (abaixo do email, antes do botão Salvar) — **"Cores da paleta"**:
- Grid 5 colunas, cada slot com:
  - `<input type="color" />` estilizado como bolinha (igual aos dots da paleta) com a cor atual.
  - Label minúsculo: "Tinta 1", "Tinta 2"…
- Botão "Restaurar padrão" (`ghost` pequeno) ao lado → seta `palette_colors = null`.
- Mudanças são locais (state) até clicar **Salvar perfil**, que envia `palette_colors` no upsert junto com display_name.
- A `PalettePhoto` na própria aba Conta recebe as cores em tempo real (preview) usando o state local, não o `profile`.

**Sidebar**: também passa `colors={profile.palette_colors}` pra `PalettePhoto`, então as cores customizadas aparecem em todo lugar.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| nova migration | `alter table admin_profile add column palette_colors jsonb` |
| `src/hooks/useAdminProfile.ts` | Reescrever como store compartilhado + incluir `palette_colors` |
| `src/components/admin/PalettePhoto.tsx` | Aceitar prop `colors?: string[]` |
| `src/components/admin/AdminShell.tsx` | Passar `colors={profile.palette_colors}` |
| `src/pages/admin/UserSettings.tsx` | Botão remover foto + bloco color pickers + state local + envio no upsert |

### Validação
1. Aba Conta → preencher nome → salvar → sidebar atualiza **sem reload**.
2. Upload foto → sidebar mostra a foto na hora.
3. Botão "Remover foto" aparece → clica → paleta volta a mostrar iniciais (Conta + sidebar).
4. Mudar 1 das 5 cores no color picker → preview na paleta da Conta atualiza ao vivo.
5. Salvar → sidebar reflete as novas cores.
6. "Restaurar padrão" → volta às cores originais da marca.
7. Reload `/admin` → tudo persiste.

