

## Plano

Dois itens:
1. Editar nome/cidade/estado/Instagram inline no card de avaliação (admin).
2. Substituir o favicon/ícone da marca pela nova logo "EN" (gradiente roxo→vermelho) em: site público, plataforma admin e página de avaliação.

---

### 1. Edição inline no card de avaliação (`ReviewsManager.tsx`)

No `ReviewCard`, adicionar botão "Editar" (ícone `Pencil`) ao lado de "Aprovar/Recusar/Excluir".

Ao clicar, o card alterna para modo edição mostrando 4 inputs compactos:
- **Nome** (`client_name`, obrigatório)
- **Cidade** (`city`)
- **Estado** (`state`)
- **Instagram** (`instagram` — sanitizado: remove `@` na entrada, salva com `@` prefixado se houver valor)

Botões "Salvar" e "Cancelar". Salvar dispara `supabase.from("reviews").update({...}).eq("id", r.id)` e recarrega via `load()`. Toast de feedback.

Funciona para qualquer aba (pendentes, aprovadas, recusadas) — útil para corrigir typos antes/depois de aprovar.

**Implementação técnica:**
- Estado local `editing: boolean` + form controlado dentro do `ReviewCard`.
- Receber novo prop `onUpdate(id, patch)` do parent que faz o update no Supabase.
- Inputs herdam classes existentes (`bg-background/40`, etc.) para manter o visual.
- Drag handle desabilitado enquanto editando para não conflitar com clicks/typing.

---

### 2. Novo ícone da marca (logo "EN" gradiente)

A logo enviada (`Ellennous-5.png`) é o "EN" com gradiente roxo→vermelho — combina perfeitamente com `--gradient-purple-wine` da marca.

**Passos:**
1. Copiar `user-uploads://Ellennous-5.png` → `public/brand-icon.png` (favicon principal, alta resolução).
2. Também copiar para `src/assets/brand-icon.png` para uso em componentes React.
3. Atualizar `index.html`:
   - `<link rel="icon" type="image/png" href="/brand-icon.png" />`
   - `<link rel="apple-touch-icon" href="/brand-icon.png" />`
   - Adicionar `<meta property="og:image" content="/brand-icon.png" />` para preview em redes sociais.
4. (Opcional/recomendado) Trocar o avatar circular roxo "EL" no header do `AdminShell` (PalettePhoto fallback) e o ícone do canto da página `ReviewSubmit` para mostrar a nova logo discretamente — mantém DNA visual sem poluir.
   - No `AdminShell`: pequeno badge `<img src={brandIcon} className="h-6 w-6" />` no topo da sidebar junto ao "Atelier · Ellennous".
   - No `ReviewSubmit` `Shell`: pequeno `<img>` acima do título "Conte sua experiência" (h-10, com glow sutil).

A aba do navegador (mostrada na imagem 25) passa a mostrar o "EN" colorido em vez do dragão escuro atual.

---

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/admin/ReviewsManager.tsx` | Adicionar modo edição inline no `ReviewCard` (nome, cidade, estado, IG) + handler `updateReview` |
| `public/brand-icon.png` | (Novo) Logo EN copiada do upload |
| `src/assets/brand-icon.png` | (Novo) Mesma logo para imports React |
| `index.html` | Trocar `<link rel="icon">`, adicionar apple-touch-icon e og:image |
| `src/components/admin/AdminShell.tsx` | Pequeno badge da logo no header da sidebar |
| `src/pages/ReviewSubmit.tsx` | Logo pequena acima do título (estados valid/submitted) |

### Validação
1. `/admin` → Avaliações → clicar Editar em qualquer card → alterar nome/cidade/estado/IG → Salvar → confere que site público (`/`) reflete a mudança.
2. Aba do navegador mostra o ícone "EN" colorido em todas as rotas (site, admin, avaliação).
3. Compartilhar link em WhatsApp/redes mostra a nova logo no preview.

