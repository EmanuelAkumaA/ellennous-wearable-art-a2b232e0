

## Plano

Quatro pedidos — vou implementar os dois técnicos (1 e 2) e responder/orientar nos dois operacionais (3 e 4).

---

### 1. Modo offline real no admin (cache via IndexedDB)

**Estratégia:** wrapper leve em volta do Supabase para listas críticas (obras + categorias + avaliações). Usa `idb-keyval` (3KB, API simples sobre IndexedDB) como camada de persistência. Sem service worker reinventado — só dados estruturados.

**Novo arquivo `src/lib/offlineCache.ts`:**
- API: `cacheGet<T>(key)`, `cacheSet(key, data)`, `cacheStaleWhileRevalidate(key, fetcher)`.
- Estratégia **stale-while-revalidate**: ao chamar `load()`, retorna imediatamente o cache (UI rápida + funciona offline) e em paralelo busca rede; quando chega, atualiza estado e salva novo snapshot.
- Detecta `navigator.onLine === false` → pula o fetch, usa só cache, e mostra toast/badge "Modo offline · dados de {timestamp}".
- Chaves: `admin:pieces`, `admin:categories`, `admin:reviews`.

**Mudanças em `PiecesManager.tsx`:**
- `load()` passa por `cacheStaleWhileRevalidate("admin:pieces", fetcher)`.
- Se offline, mutações (criar/editar/excluir) são **bloqueadas** com toast "Sem conexão — mudanças desabilitadas". (Implementar fila offline seria escopo grande demais; visualizar é o pedido principal.)

**Mudanças em `ReviewsManager.tsx`:**
- Mesmo padrão para `loadReviews()` → cache `admin:reviews`.
- Mutações também bloqueadas offline.

**Indicador visual no `AdminShell`:**
- Hook `useOnlineStatus()` em `src/hooks/useOnlineStatus.ts` (window `online`/`offline` events).
- Badge discreto no header: "Online" (verde sutil) / "Offline · cache local" (âmbar) com ícone `Wifi`/`WifiOff`.

**Imagens em offline:** O service worker já cacheia `/admin` shell. Imagens do Supabase Storage **não** ficam offline (decisão consciente — encheria o cache rápido). Aparecem com placeholder cinza quando offline; metadados/textos sim.

**Dependência nova:** `idb-keyval` (~3KB, zero deps).

---

### 2. Splash personalizada + ícones maskable otimizados

**Ícones maskable com safe area:**
- O `brand-icon.png` atual provavelmente ocupa o canvas inteiro — em ícones "maskable", o sistema corta as bordas (Android Adaptive Icons usa ~80% central como safe zone).
- **Solução:** gerar dois novos arquivos a partir do `brand-icon.png` existente:
  - `public/admin-icon-192.png` — 192×192, logo "EN" centralizada em ~60% do canvas, fundo `#0A0A0F` preenchendo borda (safe area de 20% em cada lado).
  - `public/admin-icon-512.png` — mesma composição em 512×512.
- Gerar via script Python (Pillow, já instalado no sandbox): abre `public/brand-icon.png`, cria canvas preto, cola redimensionado e centralizado.

**Manifest atualizado (`public/admin-manifest.webmanifest`):**
```json
"icons": [
  { "src": "/admin-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/admin-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/admin-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/admin-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```
Separar `any` e `maskable` é a prática correta (em vez de `"any maskable"` que estava antes — alguns sistemas mostram a versão maskable cortada onde não deveriam).

**Splash personalizada:**
- **Android**: o Chrome gera splash automaticamente a partir de `name`, `background_color`, `theme_color` e do ícone 512px. Já está OK; o ícone novo melhora a apresentação.
- **iOS**: requer `<link rel="apple-touch-startup-image">` específicos por device. Solução pragmática: criar **um único splash genérico** `public/admin-splash.png` (1290×2796, dimensão do iPhone 15 Pro Max — funciona razoável em outros via stretch) com:
  - Fundo `#0A0A0F`
  - Logo "EN" centralizada (~30% da largura)
  - Texto fino "ATELIER" abaixo em letterspacing wide
- Injetar dinamicamente no `AdminShell` (junto com o manifest) só dentro de `/admin`:
  ```html
  <link rel="apple-touch-startup-image" href="/admin-splash.png">
  ```
- Também adicionar `<meta name="apple-mobile-web-app-capable" content="yes">` e `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` dinamicamente.

**Geração:** script Python único (`/tmp/gen_pwa_assets.py`) gera os 3 PNGs (192, 512, splash) a partir do `brand-icon.png`. Saída direto em `public/`.

**Bump de versão do SW:** mudar `CACHE = "ellennous-admin-v2"` em `admin-sw.js` para forçar revalidação dos novos ícones em quem já instalou.

---

### 3. Deploy automático Vercel ↔ GitHub (instruções)

Não posso configurar Vercel a partir do Lovable — é um setup manual no painel da Vercel. Vou orientar:

1. https://vercel.com → **Add New Project** → Import Git Repository → escolher o repo Ellennous.
2. Framework Preset: **Vite** (autodetectado). Build command: `npm run build`. Output: `dist`.
3. Environment Variables: adicionar as três do `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) — copiar do `.env` local.
4. Deploy. A partir daí, todo `git push` na branch `main` (que o Lovable atualiza automaticamente) dispara deploy em produção; PRs ganham preview deploys.

Sem ação de código necessária.

---

### 4. Conferir commits no GitHub (instruções)

Não tenho acesso direto à API do GitHub. O sync Lovable↔GitHub é automático e bidirecional, então os commits "logo EN" e "edição inline de avaliações" já estão lá. Para confirmar:

- Abrir o repositório (ícone GitHub no topo do editor Lovable).
- Aba **Commits** — verificar os mais recentes com mensagens geradas pelo Lovable mencionando os arquivos editados (`ReviewsManager.tsx`, `index.html`, `brand-icon.png` etc.).

Sem ação de código necessária.

---

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/offlineCache.ts` | (Novo) Wrapper IndexedDB com stale-while-revalidate |
| `src/hooks/useOnlineStatus.ts` | (Novo) Hook reativo online/offline |
| `src/pages/admin/PiecesManager.tsx` | Usar cache no `load()`; bloquear mutações offline |
| `src/pages/admin/ReviewsManager.tsx` | Usar cache no `loadReviews()`; bloquear mutações offline |
| `src/components/admin/AdminShell.tsx` | Badge online/offline no header; injeção de meta tags iOS + apple-touch-startup-image |
| `public/admin-manifest.webmanifest` | Ícones separados `any` + `maskable`, novos paths |
| `public/admin-sw.js` | Bump cache para `v2`, incluir novos ícones no APP_SHELL |
| `public/admin-icon-192.png` | (Novo) Ícone com safe area |
| `public/admin-icon-512.png` | (Novo) Ícone com safe area |
| `public/admin-splash.png` | (Novo) Splash iOS |
| `package.json` | Adicionar `idb-keyval` |

### Validação
1. `/admin` online → tudo igual; badge "Online".
2. DevTools → Network → Offline → recarregar `/admin` → listas de obras/avaliações aparecem do cache; badge "Offline"; tentar editar mostra toast "Sem conexão".
3. Voltar online → badge muda para "Online", revalida em background.
4. PWA instalado no celular: ícone na home screen com a logo "EN" bem centralizada (não cortada). Splash escura com logo aparece ao abrir.
5. Após deploy Vercel: `git push` (via qualquer mudança no Lovable) → deploy automático em ~30s.

