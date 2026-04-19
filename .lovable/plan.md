

## Plano — Repaginar admin com identidade premium imersiva

### Diretrizes visuais
Manter o DNA dark Ellennous (purple #8A2AE3, accent red, ice blue) e elevar o admin com:
- **Sidebar lateral** premium (substituindo Tabs horizontais) com ícones + labels, glow no item ativo.
- **Header sticky** translúcido com blur, breadcrumbs, avatar/email do admin e botão sair com hover red.
- **Background atmosférico**: gradient radial suave (purple→deep-blue) + grain sutil + orbe glow flutuante (animação `float-slow`).
- **Cards** com `bg-card/60 backdrop-blur` + borda `border-primary/10` + hover ring `primary-glow/40`.
- **Tipografia**: Playfair display em títulos com gradient text, Bebas Neue em labels uppercase tracking largo.
- **Micro-interações**: fade-up nos painéis ao trocar de aba, shimmer no loading, badges com glow.

### 1. Novo shell (`Dashboard.tsx`)
- Layout `grid grid-cols-[260px_1fr]` em desktop / drawer em mobile.
- **Sidebar**: 
  - Topo: logo Ellennous + tag "Atelier".
  - Items: Obras (`Image`), Categorias (`Tags`), Estatísticas (`BarChart3`), Usuário (`UserCog`).
  - Item ativo: faixa lateral `bg-primary` 2px + bg `primary/10` + texto `primary-glow`.
  - Rodapé: email + botão "Sair" com `text-destructive hover:bg-destructive/10`.
- **Header sticky**: título da seção atual + descrição curta + ações contextuais (botão "Nova obra" só na aba obras).
- **Background**: 
  ```html
  <div class="fixed inset-0 -z-10 grain">
    <div class="absolute top-0 -left-40 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[120px] animate-float-slow" />
    <div class="absolute bottom-0 -right-40 w-[500px] h-[500px] rounded-full bg-brand-red/10 blur-[120px]" />
  </div>
  ```

### 2. Cards de obra (`PiecesManager.tsx`)
- Grid responsivo `md:grid-cols-2 xl:grid-cols-3` em vez de lista única (mantém 3 linhas internas).
- Card: `bg-card/60 backdrop-blur border border-border/40 hover:border-primary-glow/40 hover:shadow-glow transition-all`.
- Drag handle vira pill arredondada com `bg-secondary/60`.
- Tags Novo/Destaque com glow: `bg-primary/15 text-primary-glow shadow-[0_0_15px_hsl(var(--primary)/0.3)]`.
- Thumbnail com overlay gradient bottom-up.
- Botão "Nova obra" flutuante no header com gradient purple→wine.
- Filtros (busca + select) num "barra" pill `rounded-full bg-secondary/40 backdrop-blur` com ícone search.

### 3. Form de edição (modal/sheet imersivo)
Trocar o painel inline por um **Sheet lateral** (`Sheet` do shadcn) full-height à direita com:
- Header gradient `bg-gradient-purple-wine` com nome da obra + close.
- Seções colapsáveis: Identidade · Capa · Galeria · Conteúdo (descrição/conceito/história).
- Inputs com `bg-secondary/40 border-border/30 focus:border-primary-glow`.
- Botão salvar fixo no rodapé com `shadow-glow`.

### 4. Estatísticas (`StatsManager.tsx`)
- 3 cards de KPI grandes com:
  - Ícone circular gradient (`bg-gradient-purple-wine` ou `bg-brand-red/20`).
  - Número Playfair gigante com `text-gradient-light`.
  - Mini-trend label (ex: "↑ 12% vs período anterior" — só visual se sem dados).
- Tabela: header `bg-secondary/30 uppercase tracking-wider`, linhas com hover `bg-primary/5`, barras inline mostrando proporção de aberturas (background bar `bg-primary/10` + fill `bg-primary-glow`).
- Filtro de período como toggle group em vez de select.

### 5. Categorias (`CategoriesManager.tsx`)
- Lista em cards individuais (não `divide-y`) com `bg-card/60` + hover `border-primary-glow/40`.
- Drag handle + nome + contador de obras (futuro) + ações.
- Form "Nova categoria" no topo com fundo gradient sutil.

### 6. Usuário (`UserSettings.tsx`)
- Card "Conta" com avatar circular grande gradient (iniciais do email) + email destacado.
- Card "Segurança" com form de senha estilizado + indicador visual de força (barras coloridas).

### 7. Login (`Login.tsx`)
- Background com orbes purple flutuantes + grain.
- Card central com `bg-card/70 backdrop-blur-xl border-primary/20 shadow-glow`.
- Logo Ellennous acima do título.
- Inputs translúcidos.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/pages/admin/Dashboard.tsx` | Novo shell sidebar + header + bg atmosférico |
| `src/pages/admin/PiecesManager.tsx` | Cards grid premium, Sheet de edição, filtros pill |
| `src/pages/admin/CategoriesManager.tsx` | Cards individuais com glow |
| `src/pages/admin/StatsManager.tsx` | KPIs com ícones gradient + tabela com barras |
| `src/pages/admin/UserSettings.tsx` | Avatar gradient + força de senha |
| `src/pages/admin/Login.tsx` | Background imersivo + logo |
| `src/index.css` | (se necessário) novos utilitários: `.shimmer`, `.glass-card` |
| `src/components/admin/AdminShell.tsx` | NOVO — sidebar + header reutilizável |
| `package.json` / `README.md` | bump versão 0.4.3 → 0.4.4 |

### Validação
1. `/admin/login` carrega com orbes animados e card glass.
2. `/admin` mostra sidebar à esquerda em desktop; em mobile vira drawer (botão hambúrguer no header).
3. Trocar de aba aplica `animate-fade-up` no conteúdo.
4. Cards de obra com hover: borda glow + shadow purple.
5. Editar obra abre Sheet lateral animado.
6. Stats com KPIs grandes e barras inline na tabela.
7. README na versão 0.4.4.

