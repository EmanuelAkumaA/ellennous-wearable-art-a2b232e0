

## Plano — Pausa autoplay + refactor + Supabase

### 1. Pausa do autoplay em interação manual (`PieceCarousel`)

**Comportamento desejado:** clicar em dot, seta prev/next, ou tocar/clicar na imagem deve pausar autoplay + progress bar por ~5s, depois retomar.

**Implementação:**
- Adicionar `useRef` para `pauseTimeoutRef: number | null`.
- Função `pauseAutoplay()`:
  - Chama `autoplay.current.stop()`.
  - Limpa timeout anterior se existir.
  - Seta novo timeout de 5000ms que chama `autoplay.current.play()` + reset do `progress` indicador.
- Disparar `pauseAutoplay()` em:
  - `api.on("pointerDown", ...)` — captura swipe/drag no carrossel (Embla nativo).
  - `onClick` dos dots (antes do `api.scrollTo(i)`).
  - Wrapper nos botões `CarouselPrevious`/`CarouselNext` — interceptar via `onClickCapture` no container, OU usar `api.on("pointerDown")` que já cobre.
- Loop do progress bar via `requestAnimationFrame` já checa `ap.isPlaying?.()` → quando pausado, `progress` para de avançar; ao retomar, volta a animar do ponto onde está (na verdade reinicia do 0 porque o `select` event não dispara — adicionar reset manual de `progress` para 0 ao retomar).
- Cleanup: limpar `pauseTimeoutRef` no unmount.

### 2. Refactor de `Gallery.tsx`

**Estrutura nova:**

```text
src/components/sections/gallery/
  ├── Gallery.tsx          (componente principal, orquestra estado + grid + filtros + modal)
  ├── PieceCarousel.tsx    (carrossel autoplay + dots + progress bar)
  ├── ZoomOverlay.tsx      (overlay fullscreen + swipe + keyboard)
  ├── pieces.ts            (constante PIECES + tipos Piece, Category, CATEGORIES)
  └── index.ts             (re-export do Gallery default)
```

- `src/pages/Index.tsx` continua importando `Gallery` de `@/components/sections/Gallery` — manter um `Gallery.tsx` no path antigo OU atualizar import. Optar por **atualizar import** em `Index.tsx` para `@/components/sections/gallery` (cleaner).
- Tipos `Piece`, `Category` exportados de `pieces.ts`.
- `PieceCarousel` e `ZoomOverlay` recebem props tipadas; sem mudança de comportamento.

### 3. Conexão Supabase (Lovable Cloud)

**Objetivo do usuário:** "melhor controle das imagens e armazenamento assim como organização".

**Escopo proposto (mínimo viável agora):**
- Habilitar **Lovable Cloud** no projeto (Supabase gerenciado, sem conta externa).
- Criar tabela `gallery_pieces` espelhando o tipo `Piece`:
  - `id uuid pk default gen_random_uuid()`
  - `nome text not null`
  - `categoria text not null` (enum check: 'Anime / Geek' | 'Realismo' | 'Floral' | 'ScarType' | 'Exclusivas')
  - `descricao text`, `conceito text`, `tempo text`
  - `destaque boolean default false`
  - `ordem int default 0` (para controlar ordem de exibição)
  - `created_at timestamptz default now()`
- Criar tabela `gallery_images`:
  - `id uuid pk`, `piece_id uuid fk → gallery_pieces(id) on delete cascade`
  - `storage_path text not null`, `ordem int default 0`, `alt text`
- Criar bucket público `gallery` no Storage para hospedar as imagens.
- **RLS:** leitura pública (`select` para `anon`); escrita restrita (sem políticas de insert/update/delete por enquanto — só admin via Supabase Studio).
- **Migrar imagens atuais:** subir os arquivos `src/assets/gallery-*.jpg` para o bucket `gallery/` e seedar as duas tabelas com os dados atuais de `PIECES`.
- **Frontend:** trocar `pieces.ts` constante por hook `useGalleryPieces()` que faz `supabase.from('gallery_pieces').select('*, gallery_images(*)').order('ordem')` e mapeia para o tipo `Piece` (URLs públicas via `supabase.storage.from('gallery').getPublicUrl(path)`).
- Loading state simples no grid (skeleton ou shimmer com a mesma paleta).

**O que NÃO entra agora (escopo futuro, posso fazer depois se aprovar):**
- Painel admin no site para CRUD das peças (precisa de auth).
- Upload de imagens via UI.
- Reordenação drag-and-drop.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/sections/gallery/Gallery.tsx` | novo (refactor) |
| `src/components/sections/gallery/PieceCarousel.tsx` | novo + lógica de pausa |
| `src/components/sections/gallery/ZoomOverlay.tsx` | novo |
| `src/components/sections/gallery/pieces.ts` | novo (tipos + categorias; dados serão buscados do DB) |
| `src/components/sections/gallery/useGalleryPieces.ts` | novo (hook de fetch) |
| `src/components/sections/gallery/index.ts` | novo (re-export) |
| `src/components/sections/Gallery.tsx` | remover |
| `src/pages/Index.tsx` | atualizar import |
| Migration Supabase | criar tabelas + bucket + RLS + seed |

### Pontos de atenção
- Lovable Cloud será habilitado automaticamente ao aprovar — sem conta externa.
- Imagens migradas mantêm exatamente os mesmos arquivos (mesma qualidade visual).
- Pausa do autoplay = 5s (ajustável).
- Refactor não muda nada visualmente, só organiza o código.

