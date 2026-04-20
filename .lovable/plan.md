

## Plano — Responsividade das Estatísticas no mobile

Olhando a imagem 32 e o código de `src/pages/admin/StatsManager.tsx`:

### Problemas
1. **Tabela apertada no mobile** — 6 colunas (Obra, Categoria, Aberturas, CTA, Tempo médio, Conversão) num viewport de 390px. Nomes quebram em 3 linhas ("Sombra do Monarca"), categoria some, colunas CTA / Tempo médio / Conversão ficam escondidas no scroll horizontal.
2. **Filtros (ToggleGroup + botão Atualizar)** podem estourar no mobile — pílula com 4 períodos + botão lado a lado.
3. **KPIs** já usam `grid-cols-1 sm:grid-cols-3` — OK, mas o card tem `p-6` e `text-4xl`, ocupando muito espaço vertical no mobile.

### Correções em `src/pages/admin/StatsManager.tsx`

**1. Filtros responsivos**
- Wrapper: `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
- ToggleGroup: `w-full sm:w-auto justify-center`, com itens `flex-1 sm:flex-none`
- Botão Atualizar: `w-full sm:w-auto justify-center`

**2. KPIs mais compactos no mobile**
- Card: `p-4 sm:p-6`
- Valor: `text-2xl sm:text-4xl`
- Label: manter, mas `mb-2 sm:mb-3`
- Ícone: `h-9 w-9 sm:h-11 sm:w-11`

**3. Tabela → cards no mobile (lista)**
A tabela com 6 colunas é inviável em 390px. Estratégia: **esconder a `<Table>` no mobile** (`hidden md:block`) e renderizar uma **lista de cards** acima (`md:hidden`).

Cada card mobile mostra:
```
┌──────────────────────────────────────┐
│ Sombra do Monarca         [#1 opens] │
│ Anime / Geek                          │
│ ▓▓▓▓▓▓░░░░░░░░░░  (barra aberturas) │
├──────────────────────────────────────┤
│ CTA: 0   ·   Tempo: —   ·   Conv: —  │
└──────────────────────────────────────┘
```

- Header: nome (font-display, truncate ou wrap normal) + badge contagem de aberturas à direita
- Subtítulo: categoria em muted
- Barra de progresso full-width (largura ∝ opens/maxOpens) com mesmo gradient
- Footer: 3 métricas em flex justify-between (CTA, Tempo médio, Conversão) com label minúsculo accent + valor

**4. Toolbar de ordenação no mobile**
Como a tabela some, adicionar acima da lista um pequeno seletor de ordenação (Select com 5 opções: Nome, Aberturas, CTA, Tempo médio, Conversão) + botão asc/desc. Só no mobile (`md:hidden`).

**5. Cabeçalho da seção "Performance por obra"**
Trocar `px-6 py-4` por `px-4 sm:px-6 py-3 sm:py-4` e `text-sm` para `text-xs sm:text-sm` para caber bem.

### Arquivos a modificar
- `src/pages/admin/StatsManager.tsx` — único arquivo

### Validação (390px)
- Filtros empilhados: período full-width, botão Atualizar abaixo
- 3 KPIs empilhados, mais compactos
- Lista de cards substitui tabela; cada obra mostra todas as 4 métricas legíveis
- Ordenação acessível via Select no topo da lista
- Desktop ≥ md: layout original (tabela 6 colunas) intacto

