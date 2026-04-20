

## Plano: Corrigir saída do PWA + depoimentos travados em alguns celulares

### Problema 1 — Confirmação de saída não funciona

A lógica atual de `useAdminBackNavigation` tem três falhas que somadas quebram a confirmação dupla no Android/PWA:

1. **`window.close()` é chamado mas não funciona em PWA standalone** — só funciona em janelas abertas via `window.open`. Falha silenciosamente.
2. **Após `window.close()`, chamamos `history.go(-1)`** — isso dispara *outro* `popstate`, que entra de novo no handler com `pendingExit` já resetado e mostra o toast novamente em loop.
3. **Falta de readiness flag**: quando o usuário muda de aba pela UI logo após o boot, há uma corrida entre o sentinel inicial e o primeiro `pushState` do `selectTab`, deixando a pilha do browser desalinhada da nossa pilha interna.

**Correção:**
- Trocar `window.close()` por `window.history.back()` real, marcando `exitingRef = true` para o handler ignorar o popstate seguinte (o que efetivamente fecha o app).
- Garantir que sempre haja **exatamente um sentinel "à frente"** no histórico, repondo após cada popstate consumido.
- Adicionar fallback: se `history.length <= 2` e o exit foi confirmado, chamar `window.history.go(-(history.length - 1))` para forçar saída do escopo do PWA.
- Aumentar a janela de confirmação para 2.5s (mais confortável em mobile).
- Mostrar o toast com estilo destacado (ícone + bg) para o usuário entender que precisa apertar de novo.

### Problema 2 — Depoimentos não abrem em alguns celulares

Identificadas três causas prováveis:

1. **Autoplay agressivo briga com swipe touch** — `Autoplay({ stopOnInteraction: false })` continua animando enquanto o usuário tenta arrastar, fazendo o carrossel "pular" e parecer travado em celulares mais lentos.
2. **Sem indicadores nem botões em mobile** — `CarouselPrevious/Next` são `hidden md:flex`. Se o swipe falhar (por causa do autoplay ou por gesto não reconhecido), o usuário não tem alternativa de navegação.
3. **Sem fallback de erro na query** — se o `select` do Supabase falhar (rede instável, RLS edge case), o componente fica eternamente em `isLoading=false` + `hasItems=false`, e o usuário só vê o estado vazio "As primeiras vozes…" mesmo quando há depoimentos.

**Correção:**
- Trocar autoplay para `stopOnInteraction: true` + `stopOnFocusIn: true` — para de competir com o usuário no primeiro toque.
- Adicionar **dots de paginação clicáveis** visíveis em mobile (bolinhas embaixo do carrossel) usando a API do Embla.
- Adicionar **botões de seta também em mobile** (menores, posicionados sobre o card) como redundância.
- Adicionar tratamento de erro no `useQuery`: se falhar, mostrar mensagem "Não foi possível carregar agora — toque para tentar de novo" com botão de retry, em vez do estado vazio enganoso.
- Adicionar `retry: 2` + `retryDelay` exponencial na query para tolerar rede instável.

### Atualização global do sistema

- `npm run bump "fix saída PWA + depoimentos resilientes em mobile"` → versão `0.4.6` → `0.4.7`.
- Bumpar `CACHE` em `public/admin-sw.js` de `ellennous-admin-v4` → `v5`. Isso força os PWAs já instalados a baixar a nova versão na próxima abertura online (o SW já tem `skipWaiting()` + `clients.claim()`).
- Site público não tem service worker — atualiza automaticamente via Vercel CDN (sem cache no HTML).

### Validação após deploy

1. **Saída do PWA**: abrir admin instalado, voltar → toast + vibração; voltar de novo em 2.5s → app fecha. Esperar 3s e voltar → toast aparece de novo (não fecha direto).
2. **Navegação interna**: trocar para Categorias → Estatísticas → voltar volta para Categorias, voltar volta para Obras, voltar mostra toast.
3. **Depoimentos em mobile**: abrir o site público no celular → depoimentos carregam, swipe funciona sem brigas com autoplay, dots embaixo permitem navegar manualmente, setas funcionam também.
4. **Erro de rede**: simular offline → seção mostra mensagem de erro com botão de retry, não mais o estado vazio enganoso.

### Arquivos modificados

- `src/hooks/useAdminBackNavigation.ts` — refatorar lógica de exit
- `src/components/sections/Testimonials.tsx` — autoplay menos agressivo, dots mobile, setas mobile, tratamento de erro, retry
- `public/admin-sw.js` — bump cache v4 → v5
- `package.json` + `README.md` — bump 0.4.6 → 0.4.7

