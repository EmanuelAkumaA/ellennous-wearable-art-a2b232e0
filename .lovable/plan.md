

## Plano

Três itens:
1. **Logo Ellennous na tela de login** (substituir o blob branco atual pela logo "EN" colorida da marca, que já temos em `src/assets/brand-icon.png`).
2. **Mostrar/ocultar senha + "Lembrar de mim"** no formulário de login.
3. **Transformar APENAS a área `/admin` em PWA instalável** (site público continua web normal).

---

### 1. Logo no login (`src/pages/admin/Login.tsx`)

Trocar o import `logo-ellennous.svg` por `brand-icon.png` (mesmo que já está no header do admin). Manter o glow roxo atrás. Resultado: o "EN" gradiente aparece centralizado no topo do card de login, em vez do círculo branco vazio.

---

### 2. Ver senha + Lembrar de mim (`src/pages/admin/Login.tsx`)

**Ver senha:**
- Estado `showPassword: boolean`.
- Botão ícone (`Eye` / `EyeOff` do lucide-react) absoluto à direita do input de senha (espelhando o ícone `Lock` da esquerda).
- `type={showPassword ? "text" : "password"}`.

**Lembrar de mim:**
- Checkbox (componente `@/components/ui/checkbox` já existe) abaixo dos campos, alinhada com label "Lembrar neste dispositivo".
- Estado `remember: boolean`, default `true`.
- Persistência: armazenar `localStorage["ellennous_remember_email"]` quando `remember && signin sucesso`. No mount, pré-preencher email se existir. Se desmarcado, remover do storage.
- (A sessão Supabase já persiste em `localStorage` via `client.ts` — "remember" aqui controla apenas o auto-fill do email; senha nunca é salva por segurança.)

---

### 3. PWA instalável APENAS para `/admin` (e sub-rotas)

**Estratégia:** manifest + service worker dedicados, com `start_url` e `scope` apontando para `/admin`. Assim o "Instalar app" só aparece quando o usuário está navegando dentro do admin — o site público (`/`, `/avaliar/...`) permanece web puro.

**Arquivos novos:**

- `public/admin-manifest.webmanifest`:
  ```json
  {
    "name": "Ellennous Atelier",
    "short_name": "Ellennous",
    "description": "Painel administrativo Ellennous",
    "start_url": "/admin",
    "scope": "/admin",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#0A0A0F",
    "theme_color": "#0A0A0F",
    "icons": [
      { "src": "/brand-icon.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
      { "src": "/brand-icon.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
    ]
  }
  ```

- `public/admin-sw.js`: service worker minimalista — faz `skipWaiting`/`clientsClaim` e cacheia o app shell do `/admin` para funcionamento offline básico (network-first com fallback para cache em navegação dentro de `/admin`). Não interfere com rotas fora de `/admin`.

**Registro condicional** (no `AdminShell.tsx`, dentro de um `useEffect`):
- Só executa quando `location.pathname.startsWith("/admin")`.
- Detecta iframe / preview Lovable (`id-preview--`, `lovableproject.com`) e **NÃO registra** nesses contextos (evita poluir o editor — conforme a guideline interna de PWA).
- Em produção (vercel/domínio próprio): `navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" })`.
- Injeta dinamicamente `<link rel="manifest" href="/admin-manifest.webmanifest">` no `<head>` (em vez de colocar no `index.html`, para evitar que o Chrome ofereça instalar quando o usuário está só no site público).

**Prompt de instalação automático** (`src/components/admin/InstallPrompt.tsx`):
- Captura o evento `beforeinstallprompt`, previne o default e guarda em estado.
- Renderiza um banner discreto no topo do `AdminShell` (apenas em mobile e se ainda não instalado): "Instalar Ellennous Atelier no seu celular" + botão "Instalar" + "Agora não".
- "Instalar" → chama `deferredPrompt.prompt()`.
- "Agora não" → marca em `localStorage["admin_install_dismissed"] = timestamp` e some por 7 dias.
- Detecta iOS Safari (que não dispara `beforeinstallprompt`) → mostra instrução: "Toque em Compartilhar → Adicionar à Tela de Início".
- Detecta `display-mode: standalone` → não mostra nada (já instalado).

**Apple touch icon específico do admin:** o `apple-touch-icon` global no `index.html` já aponta para `/brand-icon.png` — perfeito para iOS pegar a logo certa quando adicionar à tela inicial a partir de `/admin`.

---

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/admin/Login.tsx` | Logo `brand-icon.png`, toggle ver senha (Eye/EyeOff), checkbox "Lembrar neste dispositivo" + auto-fill email |
| `public/admin-manifest.webmanifest` | (Novo) Manifest com `scope:/admin`, `start_url:/admin`, ícones |
| `public/admin-sw.js` | (Novo) Service worker mínimo, escopo `/admin`, cache app shell |
| `src/components/admin/InstallPrompt.tsx` | (Novo) Banner de instalação + handler `beforeinstallprompt` + fallback iOS |
| `src/components/admin/AdminShell.tsx` | Registro condicional do SW (só prod, fora de iframe/preview), injeção do `<link rel="manifest">`, render `<InstallPrompt />` |

### Validação
1. `/admin/login` → logo "EN" colorida visível, ícone do olho alterna senha, checkbox lembra email no próximo acesso.
2. **No preview/editor Lovable**: SW NÃO registra (evita stale content) — verificar no DevTools → Application → Service Workers (vazio).
3. **Em produção (Vercel)**: ao abrir `/admin` no Chrome do celular, banner "Instalar" aparece após 1-2 segundos. Tocar instala como app standalone, abre direto em `/admin`.
4. **No iOS Safari**: aparece instrução "Compartilhar → Adicionar à Tela de Início"; após adicionar, ícone é a logo "EN".
5. Site público (`/`) continua sem prompt de instalação e sem service worker — comportamento web normal preservado.

