

## Plano: Responsividade da aba Logs

### Problema
No mobile (≤390px), a tabela de 7 colunas fica espremida: data quebra em duas linhas, "Arquivo" some, status/tamanho/tempo desaparecem porque só "Origem" e "Arquivo" cabem visíveis.

### Solução: dual layout — cards no mobile, tabela no desktop

**Em `src/components/admin/converter/LogsTable.tsx`:**

#### 1. Filtros (header `glass-card`)
Reorganizar para empilhar bem em telas pequenas:
- Container: `p-3 sm:p-4`, `flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3`.
- Buscar: `w-full sm:flex-1 sm:min-w-[200px]`.
- Selects (Status / Origem): cada um em `flex-1 min-w-0` num grid `grid grid-cols-2 sm:flex sm:gap-3` para ficarem lado-a-lado no mobile (ocupam 50% cada) e inline no desktop. `SelectTrigger`: `w-full sm:w-36`/`sm:w-44`.
- Botões "Atualizar" e "Exportar CSV": agrupados em `grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto`. `flex-1 sm:flex-none`. Mantêm o ícone + texto curto.

#### 2. Listagem
Esconder a `<Table>` no mobile e mostrar **cards** em vez disso:

```tsx
{/* Mobile cards: < lg */}
<div className="lg:hidden space-y-2">
  {filtered.map((r) => (
    <button
      key={r.id}
      onClick={() => setSelected(r)}
      className="w-full glass-card p-3 text-left hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs font-medium truncate flex-1" title={r.filename}>
          {r.filename}
        </p>
        {/* Status pill */}
        {r.status === "success" ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-accent tracking-[0.2em] uppercase text-emerald-400">
            <Check className="h-3 w-3" /> OK
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-accent tracking-[0.2em] uppercase text-destructive">
            <AlertCircle className="h-3 w-3" /> Falha
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-accent tracking-[0.2em] uppercase text-muted-foreground">
        <span>{formatDate(r.created_at)}</span>
        <span className="text-border">·</span>
        <span>{SOURCE_LABEL[r.source]}</span>
        <span className="text-border">·</span>
        <span className="tabular-nums">{(r.duration_ms / 1000).toFixed(1)}s</span>
        {r.status === "success" && (
          <>
            <span className="text-border">·</span>
            <span className="tabular-nums">
              {formatBytes(r.optimized_size)}
              {reduction > 0 && <span className="text-emerald-400/80 ml-1">−{reduction}%</span>}
            </span>
          </>
        )}
      </div>
    </button>
  ))}
</div>

{/* Desktop table: ≥ lg */}
<div className="hidden lg:block glass-card overflow-hidden">
  <Table>…tabela atual sem alterações…</Table>
</div>
```

Cada card inteiro abre o `Sheet` de detalhes ao clicar (substitui o botão "Ver" — mais natural no toque).

#### 3. Sheet de detalhes
Já é `w-full sm:max-w-md` — apenas garantir scroll vertical: adicionar `overflow-y-auto` no `SheetContent` e `pb-20` (para não colar na bottom nav). Sem mais mudanças.

#### 4. Estados loading / vazio
Manter os cards `glass-card p-12` — já são responsivos. Reduzir padding no mobile: `p-8 sm:p-12`.

### Resultado visual mobile

```text
┌─────────────────────────────┐
│ BUSCAR ARQUIVO              │
│ 🔍 nome.jpg                 │
│ STATUS         ORIGEM       │
│ [Todos ▾]      [Todas ▾]    │
│ [↻ Atualizar] [⬇ Export]    │
├─────────────────────────────┤
│ WhatsApp Image 2026…   ✓ OK │
│ 22/04/26, 19:56 · CADASTRO  │
│ DE OBRA · 2.4s · 184KB −62% │
├─────────────────────────────┤
│ WhatsApp Image 2026…   ✓ OK │
│ … etc                       │
└─────────────────────────────┘
        [bottom nav]
```

### Arquivos
- **Editado:** `src/components/admin/converter/LogsTable.tsx` — filtros responsivos (grid mobile + flex desktop), dual-render cards/tabela com `lg:hidden` / `hidden lg:block`, sheet com scroll + padding inferior.

**Sem novas dependências, sem migration, sem alterações na lógica de fetch ou export CSV.**

