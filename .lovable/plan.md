

## Plano — Galeria mobile com "Ver mais obras" + ordenação

### 1. Nova classificação "Novo" em `pieces.ts`

Adicionar campo opcional `novo?: boolean` em `Piece`. Hoje já existe `destaque?: boolean`. Sem `novo` marcado em nenhuma peça (usuário marca depois) — fica pronto para uso.

### 2. Ordenação fixa em `Gallery.tsx`

Antes de renderizar `filtered`, ordenar:
1. `novo === true` primeiro
2. `destaque === true` em seguida
3. Restante (sem classificação) por último

Mantém ordem original dentro de cada grupo (sort estável). Aplica para todos os filtros, inclusive "Todas".

### 3. Botão "Ver mais obras" — só mobile

- Estado novo: `const [showAll, setShowAll] = useState(false)`.
- Detectar mobile via hook existente `useIsMobile()` (já está em `src/hooks/use-mobile.tsx`).
- Limite mobile: **6 peças** visíveis inicialmente.
- Lógica:
  - Se `isMobile && !showAll` → renderiza `sorted.slice(0, 6)`.
  - Senão → renderiza tudo.
- Botão aparece **só** quando `isMobile && !showAll && sorted.length > 6`, abaixo do grid.
  - Estilo: mesma estética dos filtros (`font-accent`, `tracking-[0.15em] uppercase`, borda + hover glow).
  - Texto: "Ver mais obras".
- Ao trocar de filtro (`setFilter`), resetar `showAll = false` para o comportamento ser consistente por categoria.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/sections/gallery/pieces.ts` | adicionar `novo?: boolean` em `Piece` |
| `src/components/sections/gallery/Gallery.tsx` | ordenação por novo→destaque→resto + estado/botão mobile "Ver mais obras" |

### Pontos de atenção
- Desktop não muda — mostra todas as peças sempre.
- Como nenhuma peça está marcada como `novo` ainda, a ordem visível agora será: destaques (1, 4, 6, 7) primeiro, depois restantes (2, 3, 5).
- Quiser marcar peças como "Novo" no `pieces.ts`, é só setar `novo: true` na peça.

