

## Plano: Voltar inteligente no PWA + vibração + bump SW

### Comportamento desejado

O admin é uma SPA com 5 abas internas (`pieces`, `categories`, `reviews`, `stats`, `user`) controladas por estado, não por rotas reais. Vamos tratar cada troca de aba como uma "entrada" no histórico de navegação interna.

**Fluxo no PWA instalado:**

1. Usuário abre o app → cai na aba inicial (`pieces`). Pilha interna: `[pieces]`.
2. Clica em "Categorias" → pilha vira `[pieces, categories]`. Aba ativa: `categories`.
3. Aperta "voltar" do dispositivo → volta para `pieces` (sem toast, sem sair).
4. Aperta "voltar" de novo → agora está na raiz da pilha → mostra toast *"Aperte voltar novamente para sair do aplicativo"* + **vibração curta** (`navigator.vibrate(40)`).
5. Aperta "voltar" mais uma vez dentro de 2s → sai do app.
6. Se esperar mais que 2s → toast some, próximo voltar pede confirmação de novo.

No navegador comum (não standalone), tudo funciona normalmente — sem interceptação.

### Implementação

**1. Refatorar `useBackButtonExitConfirm` → `useAdminBackNavigation`**
   - Recebe `activeTab`, `onTabChange`, `tabs` (lista ordenada das tabs disponíveis).
   - Mantém uma pilha interna (`useRef<AdminTab[]>`) das tabs visitadas.
   - Quando o usuário troca de aba via UI → empilha (e faz `history.pushState` sentinela).
   - Em `popstate`:
     - Se pilha tem mais de 1 item → desempilha, chama `onTabChange(novaTopo)`, repõe sentinela. **Não** mostra toast.
     - Se pilha tem só 1 item (raiz):
       - Primeira vez: dispara `navigator.vibrate(40)`, mostra toast 2s, marca `pendingExit`, repõe sentinela.
       - Segunda vez dentro de 2s: `window.close()` + `history.go(-1)` como fallback.
   - Só ativa em standalone.

**2. Integrar em `Dashboard.tsx`**
   - Substituir `useBackButtonExitConfirm()` por `useAdminBackNavigation({ active: tab, onChange: setTab })`.
   - O hook intercepta `setTab` para gerenciar a pilha automaticamente — exposto como `selectTab` retornado pelo hook, que repassamos para `AdminShell.onSelect`.

**3. Bump versão + service worker**
   - Rodar `npm run bump "voltar inteligente no PWA + vibração háptica"` → versão `0.4.4` → `0.4.5`.
   - Bumpar `CACHE` em `public/admin-sw.js` de `ellennous-admin-v3` para `ellennous-admin-v4`. Isso força os apps já instalados a invalidar o cache antigo no próximo `activate` e baixar a nova versão.
   - O SW já tem `self.skipWaiting()` + `clients.claim()`, então a atualização é automática quando o usuário reabrir o app com conexão.

**4. Commit**
   - Após implementar, fazer commit com mensagem descritiva. O sync com GitHub é automático.

**5. Testes (em modo default)**
   - Build: `npm run build` para garantir que compila sem erros.
   - Lint: `npm run lint` na pasta alterada.
   - Verificar via console do preview que o hook não dispara em modo navegador.

### Arquivos
- `src/hooks/useBackButtonExitConfirm.ts` → renomear/refatorar para `src/hooks/useAdminBackNavigation.ts` (e remover o antigo)
- `src/pages/admin/Dashboard.tsx` → usar novo hook
- `public/admin-sw.js` → bump cache `v3` → `v4`
- `package.json` + `README.md` → bump via script

### Detalhes técnicos
- A pilha vive em `useRef` para não causar re-render.
- Cada `pushState` usa um state `{ __adminNav: tabKey }` para identificar nossas entradas.
- Se o usuário trocar de aba pela UI enquanto `pendingExit` está ativo, resetamos o estado pendente (toast+timer).
- Vibração só dispara se `navigator.vibrate` existir (Safari iOS não suporta — fallback silencioso).

### Validação manual após deploy
1. Instalar PWA, abrir → na aba `pieces`, voltar → toast + vibração; voltar de novo em <2s → app fecha.
2. Instalar PWA, abrir → trocar para `categories`, depois `stats` → voltar volta para `categories`, voltar volta para `pieces`, voltar mostra toast.
3. Navegador comum em `/admin` → voltar funciona normalmente (sai da página).
4. App já instalado anteriormente → ao reabrir online, SW atualiza para `v4` automaticamente.

