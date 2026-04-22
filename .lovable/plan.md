

## Plano: CTA enriquecido + microinterações + bordas com cor da capa + menu mobile inferior + correções no Conversor

### 1. Modal de peça — CTA do WhatsApp enriquecido

A peça já tem botão "Quero algo nesse nível" no modal. Vamos só refinar a mensagem para incluir **categoria** explicitamente:

```
Olá! Vi a obra "{nome}" ({categoria}) na galeria e quero algo nesse nível.
Pode me contar como começamos um projeto exclusivo?
```

Edita só a string em `src/components/sections/gallery/Gallery.tsx` (linha do `buildWhatsAppLink`).

### 2. Microinterações na galeria e seções de conteúdo

**Card de obra** (Gallery.tsx, item da grid):
- `hover:scale-[1.02]` no card + `group-hover:scale-110` na imagem (já existe; vamos suavizar a curva).
- Brilho sutil no hover: pseudo-overlay com `bg-gradient-to-tr from-primary/0 via-primary/10 to-primary/0` que aparece em `group-hover:opacity-100`.
- Botão de filtro de categoria: `hover:-translate-y-0.5 active:scale-95` para feedback tátil.

**Seções de conteúdo** (Manifesto, Hero, ScarType, Process, ForWhom, Positioning, Testimonials, FinalCTA, Footer):
- O sistema `useReveal` já existe. Vamos adicionar uma classe utilitária `reveal-slide` em `index.css` que combina **fade + slide-up** (transform `translateY(40px)` → 0 + opacity 0→1 com `var(--ease-smooth)` de 0.9s).
- Adicionar `reveal` em mais elementos-chave dentro de cada seção (cards do Manifesto, etapas do Process, etc.) com pequenos delays escalonados via `style={{ transitionDelay: `${i * 80}ms` }}`.

### 3. Borda animada com cor da capa (referência da imagem 03)

**Extrator de cor dominante** — novo hook `src/hooks/use-dominant-color.ts`:
- Recebe a URL da capa, baixa via `<img crossOrigin="anonymous">` (bucket `gallery` é público), pinta num canvas 32×32, varre os pixels, ignora muito escuros (lum < 0.18) ou dessaturados (sat < 0.25), retorna a cor mais frequente em HSL.
- Cache em `Map<url, string>` no módulo para não recalcular ao re-renderizar.
- Fallback: `--primary-glow` quando o cálculo falhar.

**Card da obra** (Gallery.tsx item):
- Recebe `dominantColor` do hook.
- Substituir a borda estática `border-border/40` por uma camada wrapper que renderiza um `::after` cônico animado:
  ```tsx
  <div style={{ '--ring-color': dominantColor }} className="card-glow-ring">
    <button …>…</button>
  </div>
  ```
- Em `index.css`, novo utilitário:
  ```css
  .card-glow-ring { position: relative; padding: 2px; border-radius: 4px; }
  .card-glow-ring::before {
    content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 2px;
    background: conic-gradient(from 0deg,
      var(--ring-color) 0%, transparent 35%, transparent 65%, var(--ring-color) 100%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude; -webkit-mask-composite: xor;
    animation: ring-rotate 6s linear infinite;
    opacity: 0.0; transition: opacity 0.5s var(--ease-smooth);
  }
  .card-glow-ring:hover::before { opacity: 0.9; }
  .card-glow-ring::after {
    content: ""; position: absolute; inset: -8px; border-radius: 8px; pointer-events: none;
    background: radial-gradient(circle at 50% 50%, var(--ring-color), transparent 60%);
    opacity: 0; transition: opacity 0.5s var(--ease-smooth); filter: blur(20px);
  }
  .card-glow-ring:hover::after { opacity: 0.35; }
  @keyframes ring-rotate { to { transform: rotate(360deg); } }
  ```
- A borda fica visível **suave em estado normal** (`opacity: 0.4`) e **acende no hover** com a cor da imagem girando.

### 4. Menu mobile no admin — bottom navigation estética

Hoje o `AdminShell` usa `<Sheet>` lateral com botão hambúrguer. Substituir por **bottom bar fixa** no mobile (mantém Sheet só para desktop responsivo se quiser, mas o padrão móvel vira bottom):

- Novo componente `src/components/admin/AdminBottomNav.tsx`:
  - Visível só `lg:hidden` + `fixed bottom-0 inset-x-0 z-50`.
  - 5 ícones principais (Obras, Categorias, Conversor, Avaliações, Conta) — Estatísticas vai para "+ Mais" via Sheet residual.
  - Visual: `backdrop-blur-xl bg-card/80 border-t border-primary/20`, glow sutil ao redor, ícone ativo com pílula de fundo `bg-gradient-purple-wine` + label em CAPS pequenas, animação de "lift" `-translate-y-1` no item ativo.
  - Safe-area iOS: `pb-[env(safe-area-inset-bottom)]`.
- Em `AdminShell`:
  - Remover o botão hambúrguer no header mobile e remover o `<Sheet>` do header (mover para fallback "Mais").
  - Adicionar `pb-24` no `<main>` quando mobile para não cobrir conteúdo.
  - Renderizar `<AdminBottomNav active={active} onSelect={handleSelect}/>`.

```text
┌─────────────────────────────┐
│        conteúdo             │
│                             │
│                             │
├─────────────────────────────┤
│  📷    🏷    ✨    ⭐    👤 │  ← bottom nav, item ativo elevado + glow
│ Obras  Cat  Conv  Aval Conta│
└─────────────────────────────┘
```

### 5. Conversor — Galeria: botões "Ativa" e "Capa" funcionais

Os handlers `handleToggleVariant` e `handleSetCoverPerDevice` **já existem** e estão ligados via `onToggleActive` / `actions` no `VariantGrid`. O problema visto no print é que **o card mostra `Inativa` mesmo sem clique** porque, quando a URL da variante é `null` (imagem legada sem mobile/tablet), o thumb cai no estado "arquivo ausente" mas o botão fica ativável e o `Star` botão fica desabilitado.

Correções:
1. **`VariantGrid`** — quando `slot.url` é `null`, **desabilitar visualmente** o botão "Ativa" (não tem o que ativar). Adicionar `disabled` ao botão e tooltip explicando.
2. **`GalleryTab`** — para imagens legadas (`!desktopVariants` para mobile/tablet) mostrar overlay no card com botão "Reconverter para gerar variantes" que abre fluxo: baixa o desktop, roda `convertResponsivePreset`, sobe os 2 ausentes, mantém o desktop. Isso resolve o caso do print onde só desktop existe.
3. **Confirmação visual no clique**: hoje ambos os botões já chamam `await load()`, mas vamos adicionar `loading` state local para mostrar `<Loader2 className="animate-spin"/>` enquanto a chamada Supabase não retorna (evita o usuário pensar que "não funcionou").

### 6. Logs do conversor — registrar carregamento de imagens

Hoje `conversion_logs` registra **conversões** (browser → bucket). O usuário quer também registrar **carregamento bem-sucedido/falha** das imagens já no bucket.

- Novo `source` aceito: `'image_load'` (a tabela aceita texto livre — sem mudança de schema).
- Em `VariantGrid` → componente `Thumb`: quando `<img onError>` dispara, chamar `logConversion({ source: 'image_load', filename: url, status: 'error', errorMessage: 'Falha ao carregar do bucket', ... })`.
- Quando `<img onLoad>` dispara pela primeira vez, opcional: `status: 'success'` com `originalSize: 0`. Vamos **só logar erros** por padrão para não inundar a tabela, e adicionar um toggle no LogsTable "Incluir cargas de imagem" (filtro client-side).
- O `LogsTable.tsx` já filtra por `source` — adicionar opção "Carregamento" no select.

### 7. Teste de ponta a ponta

Após implementar, executar verificações automáticas via build (`npm run build`) e revisar manualmente o checklist:

- Login admin → Conversor → arrastar 2 imagens → confirmar progresso/ETA → "Enviar p/ galeria" → aba Galeria mostra staging → associar a uma obra → ver capas atualizando.
- Em galeria, clicar "Ativa" e "Capa" em cada device → confirmar mensagens toast e atualização.
- Ver logs (filtrar sucesso/falha/imagem-load).
- Site público (`/`) → Galeria → modal abre → CTA WhatsApp tem nome+categoria → Microinterações funcionando.
- Mobile: admin tem bottom nav; galeria tem bordas coloridas extraídas das capas.

### Arquivos

**Novos**
- `src/hooks/use-dominant-color.ts` — extrator HSL com cache.
- `src/components/admin/AdminBottomNav.tsx`.

**Editados**
- `src/index.css` — utilitários `.card-glow-ring`, `.reveal-slide`, keyframes `ring-rotate`.
- `src/components/sections/gallery/Gallery.tsx` — wrapper `card-glow-ring` no item, mensagem WhatsApp enriquecida, classes `reveal-slide`.
- `src/components/sections/{Hero,Manifesto,Process,ScarType,ForWhom,Positioning,Testimonials,FinalCTA,Footer}.tsx` — adicionar `reveal-slide` + delays nos sub-elementos.
- `src/components/admin/AdminShell.tsx` — montar `AdminBottomNav`, padding inferior no main, esconder hambúrguer no mobile.
- `src/components/admin/converter/VariantGrid.tsx` — `disabled` quando url null + onError logging + estado loading.
- `src/components/admin/converter/GalleryTab.tsx` — botão "Reconverter variantes ausentes" para imagens legadas, loading states locais nos botões Ativa/Capa.
- `src/components/admin/converter/LogsTable.tsx` — opção "Carregamento" no filtro de origem.
- `src/lib/conversionLogs.ts` — ampliar tipo `ConversionSource` para incluir `'image_load'`.

**Sem migration** — `conversion_logs.source` é `text` livre.

