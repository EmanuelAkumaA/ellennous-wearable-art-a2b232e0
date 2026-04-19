

## Plano — Reorganizar layout do card de obra no admin

### Problema atual
A linha de cada obra na listagem do admin (mobile 390px) está apertada: drag handle + thumbnail + nome/categoria/ordem misturados + badges + ações na mesma linha, causando truncamento ("S...", "Cavaleir...", "Retrato ...").

### Layout novo (3 linhas dentro do card, drag handle fixo à esquerda)

```text
┌──┬─────────────────────────────────────────┐
│::│ [thumb]  Nome completo da obra          │  ← linha 1
│::│ Categoria · X img                       │  ← linha 2
│::│ [NOVO] [DESTAQUE]        [editar] [🗑]  │  ← linha 3
└──┴─────────────────────────────────────────┘
```

- **Coluna esquerda fixa**: `GripVertical` (drag handle), centralizado verticalmente.
- **Coluna direita** (`flex-1 min-w-0`): 3 linhas empilhadas com `gap-2`.
  - **Linha 1**: thumbnail 56x56 + nome (`truncate` ou `line-clamp-2`, `flex-1`).
  - **Linha 2**: texto pequeno `text-muted-foreground` com categoria + contagem de imagens.
  - **Linha 3**: badges à esquerda (`NOVO`, `DESTAQUE` se aplicáveis) + `ml-auto` empurra os botões editar/lixeira pra direita.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/pages/admin/PiecesManager.tsx` | Reescrever JSX do `SortablePieceRow` com layout em 3 linhas |

### Versionamento e GitHub
- Rodar `npm run bump patch "reorganiza card de obra no admin em 3 linhas"` para ir de `0.4.2` → `0.4.3`.
  - Antes vou ler `package.json` pra confirmar a versão atual; se já estiver fora do esperado, ajusto o argumento (`major`/`minor` ou edição manual) pra cair exatamente em `0.4.3`.
- Atualiza `package.json` + tabela do `README.md` automaticamente.
- **GitHub**: o sync com GitHub é automático e bidirecional no Lovable — todas as mudanças vão pro repo conectado sem comando manual de commit/push. Não posso (e nem é necessário) rodar `git commit` daqui.
- **Organizar repositório**: o Lovable controla a estrutura do repo (não rearranjo pastas só pelo GitHub). Se quiser uma reorganização específica de pastas, me diz qual estrutura você quer.

### Validação
1. Abrir `/admin` no mobile (390px) → cada card mostra nome inteiro sem `...`.
2. Drag handle continua funcionando pra reordenar.
3. Botões editar/lixeira ficam alinhados à direita na linha das tags.
4. README mostra versão `0.4.3` na tabela.

