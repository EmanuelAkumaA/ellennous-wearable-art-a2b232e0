

## Plano

5 ajustes pontuais. Tudo é frontend exceto o item 5 que envolve PWA.

### 1. Realtime nas avaliações (validação)
Já implementado. Vou apenas confirmar que o canal está ativo após o build — sem código novo.

### 2. Filtro de obras responsivo no mobile (imagem 28)
Em `src/pages/admin/PiecesManager.tsx` (linhas 604-637) o container `glass-card rounded-full p-1.5` força tudo numa pílula. No mobile o `Select` "Todas as categorias" extrapola e o input de busca fica apertado.

**Fix:** trocar o wrapper para `flex-col` no mobile com gap maior, remover `rounded-full` no container (manter só nos filhos), e dar `w-full` consistente em ambos no mobile.

### 3. Link "Ver site público" → URL nova
`src/components/admin/AdminShell.tsx` linha 210: trocar `https://ellennous-wearable-art.vercel.app/` por `https://ellennous-wearable-art-a2b232e0.vercel.app`.

### 4. Numeração das obras começa em #02 — bug
Banco: `ordem` começa em **1** (não 0). Código atual em `PiecesManager.tsx` linha 208: `piece.ordem + 1` → exibe #02 para a primeira obra.

**Fix:** mudar para `String(piece.ordem).padStart(2, "0")` (sem o `+ 1`). Resultado: #01, #02, #03…

### 5. PWA do admin não funciona
Causa principal: o `InstallPrompt` faz `if (isStandalone() || wasRecentlyDismissed()) return` **antes** de qualquer coisa, mas no preview do Lovable o SW nunca registra (correto). Em produção (Vercel) o problema real é:

- O `beforeinstallprompt` só dispara se o SW estiver **realmente registrado e ativo** + manifest válido + critério "engagement" do Chrome.
- O SW atual (`public/admin-sw.js`) tenta cachear `/admin` direto, mas como é SPA, o `fetch` para `/admin/pieces` etc. precisa cair no fallback. Já tem fallback, mas o **install** está falhando silenciosamente porque `cache.addAll` rejeita o array inteiro se **um único** recurso falhar (uso de `.catch(() => undefined)` por fora não salva — o `event.waitUntil` recebe a Promise rejeitada).
- Além disso, o manifest tem `start_url: "/admin"` mas o SW só intercepta requests dentro de `/admin` — OK. Porém no Vercel sem `vercel.json` com SPA rewrite, `/admin` direto retorna 404 antes de chegar no React Router.

**Fixes:**
1. **`public/admin-sw.js`**: trocar `cache.addAll(APP_SHELL)` por loop individual `Promise.allSettled` para tolerar falhas de assets faltantes, e remover items que podem 404 (ex: `/admin/` com barra dupla).
2. **`public/admin-sw.js`**: garantir que o fetch handler retorna o `index.html` (`/admin`) corretamente como fallback de navegação SPA.
3. **`vercel.json`** (criar na raiz): adicionar SPA rewrite para todas as rotas caírem em `/index.html`. Sem isso, deep links como `/admin` quebram em refresh no Vercel — explicando por que o PWA "não funciona" (start_url 404 = sem instalação).
4. **`InstallPrompt.tsx`**: melhorar o fallback iOS (já existe) e adicionar um log simples no console quando `beforeinstallprompt` não dispara em 5s no Android, para o usuário saber por quê.

### 6. Sync GitHub
Como expliquei antes: o sync é automático e em tempo real. Não há ação manual de commit a executar — mudanças vão pro repo conectado assim que eu salvar.

---

## Arquivos a modificar
- `src/pages/admin/PiecesManager.tsx` — filtros responsivos + numeração #01
- `src/components/admin/AdminShell.tsx` — URL "Ver site público"
- `public/admin-sw.js` — install tolerante a falhas + fallback SPA robusto
- `vercel.json` (novo) — SPA rewrite para Vercel

## Como vou validar
1. Mobile (390px): filtros empilhados, busca larga, select largo, sem corte.
2. Cards mostrando #01, #02, #03 na ordem do banco.
3. Sidebar → "Ver site público" abre nova URL.
4. Após deploy Vercel: `/admin` em refresh funciona; aparece prompt "Instalar" no Chrome Android; ícone "EN" aparece centralizado na home screen.

