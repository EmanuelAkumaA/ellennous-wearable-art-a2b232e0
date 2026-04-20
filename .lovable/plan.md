

## Plano: Confirmação ao sair do PWA com botão voltar

### Contexto

No PWA instalado (modo standalone), quando o usuário aperta o botão "voltar" do celular/tablet estando na página inicial do admin (`/admin`), o sistema fecha o app imediatamente. Vamos adicionar uma confirmação de "aperte voltar novamente para sair".

### Comportamento

1. Usuário abre o app instalado e está em `/admin` (raiz do sistema interno).
2. Aperta o botão voltar do dispositivo.
3. Aparece um **toast** no rodapé: *"Aperte voltar novamente para sair do aplicativo"* (dura 2 segundos).
4. Se apertar voltar **de novo dentro de 2 segundos** → o app fecha (ou tenta sair via `history.back()` que sai do escopo PWA).
5. Se não apertar dentro de 2 segundos → o toast some e o estado reseta.

### Implementação

**Novo hook**: `src/hooks/useBackButtonExitConfirm.ts`

- Detecta se está em modo standalone (`matchMedia("(display-mode: standalone)")` ou `navigator.standalone` para iOS).
- Só ativa se estiver em standalone — no navegador comum, o voltar funciona normalmente.
- Ao montar, faz `history.pushState(null, "", location.href)` uma vez para criar uma "entrada sentinela" no histórico — assim o primeiro `popstate` pode ser interceptado sem realmente navegar.
- Listener de `popstate`:
  - Se for o **primeiro** voltar (sem confirmação pendente): mostra toast via `sonner`, marca `pendingExit = true`, faz outro `pushState` para repor a sentinela, e dispara timeout de 2s para resetar.
  - Se for o **segundo** voltar (com `pendingExit = true` ainda ativo): chama `window.close()` (e como fallback `history.go(-2)` para sair do escopo do PWA).
- Limpa o listener no unmount.

**Integração**: chamar o hook em `src/pages/admin/Dashboard.tsx` (página raiz do admin instalado). Não colocar no `AdminShell` para evitar conflito com sub-rotas futuras — fica restrito à tela inicial do app.

### Arquivos
- `src/hooks/useBackButtonExitConfirm.ts` (novo)
- `src/pages/admin/Dashboard.tsx` (adicionar `useBackButtonExitConfirm()`)

### Validação
1. Instalar o PWA no celular, abrir em `/admin`, apertar voltar → toast aparece, app **não fecha**.
2. Apertar voltar de novo dentro de 2s → app fecha.
3. Esperar mais de 2s e apertar voltar uma vez → toast reaparece (não fecha direto).
4. Abrir `/admin` no navegador comum (não instalado) → comportamento padrão do navegador, sem interceptação.

