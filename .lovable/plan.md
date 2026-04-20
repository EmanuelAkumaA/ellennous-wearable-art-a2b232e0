
## Plano

Otimizar o carregamento das imagens da galeria na home para ficar quase instantâneo, usando transformações nativas do Supabase Storage + boas práticas de imagem.

### Diagnóstico atual
Hoje em `Gallery.tsx` cada thumb faz `<img src={piece.capa || piece.imagens[0]} width=1024 height=1280>` — ou seja, baixa a imagem **em tamanho original** (geralmente 2-5 MB cada do upload do admin) só pra exibir num card de ~400px. Carregar 6 thumbs pode facilmente passar de 15 MB. Isso é o gargalo.

### Solução

**1. Helper `getOptimizedImageUrl(url, { width, quality })`** em `src/lib/imageOptimization.ts`
Detecta URLs do bucket `gallery` (`/storage/v1/object/public/gallery/...`) e reescreve para `/storage/v1/render/image/public/gallery/...?width=W&quality=Q&resize=cover`. Para URLs externas, retorna sem alteração. Suporta também gerar `srcset` com múltiplas larguras (400, 800, 1200).

**2. Aplicar nos thumbs da galeria (`gallery/Gallery.tsx`)**
Trocar o `<img>` da grid por:
- `src` = versão 600w qualidade 70
- `srcSet` = "400w, 600w, 900w" + `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"`
- `loading="lazy"` + `decoding="async"` (já tem lazy)
- **Primeiros 3 cards**: `loading="eager"` + `fetchpriority="high"` para LCP rápido (acima da dobra). Os demais ficam lazy.
- `width`/`height` corretos para reservar espaço (CLS).

**3. Aplicar no carrossel do modal (`PieceCarousel.tsx`)**
- Imagem ativa: 1200w qualidade 80.
- `loading="lazy"` em todas exceto a primeira (`loading="eager"`).
- Pré-carregar a próxima e a anterior via `<link rel="preload" as="image">` programático ao trocar de slide (rápido percebido).

**4. Zoom (`ZoomOverlay.tsx`)**
Usar 1600w qualidade 85 (suficiente para fullscreen sem peso da original).

**5. Skeleton suave (sem animação pesada)**
A grid já tem `animate-pulse` durante `loading`. Adicionar fundo com cor base (`bg-muted/40`) atrás da `<img>` para evitar "piscada" branca enquanto carrega.

**6. Cache forte**
Imagens transformadas do Supabase já vêm com `Cache-Control` longo. Garantir no helper que a URL é estável (mesmos params = mesmo cache).

### Por que vai ficar "quase instantâneo"
- Thumbs caem de ~3 MB → ~30-60 KB cada (50× menor).
- 6 cards iniciais ≈ 300 KB total (vs ~15 MB antes).
- Os 3 primeiros começam a baixar imediatamente (eager + alta prioridade).
- O CDN do Supabase entrega WebP automaticamente para navegadores compatíveis.
- Modal abre rápido porque carrega versão média, não original.

### Arquivos a modificar/criar
- `src/lib/imageOptimization.ts` (novo — helper `getOptimizedImageUrl` + `getOptimizedSrcSet`)
- `src/components/sections/gallery/Gallery.tsx` (usar helper nos thumbs com srcset/sizes/eager nos 3 primeiros)
- `src/components/sections/gallery/PieceCarousel.tsx` (usar helper + preload da próxima)
- `src/components/sections/gallery/ZoomOverlay.tsx` (usar helper em alta qualidade)

### Validação
1. Abrir a home com DevTools → Network → Img: as primeiras imagens devem ter ~30-80 KB cada (vs MB hoje) e formato WebP.
2. LCP do hero/galeria visivelmente mais rápido em 3G simulado.
3. Zoom continua nítido em desktop (1600w).
4. Modal abre sem delay perceptível.
5. Sem CLS ao carregar (espaço reservado pelo `aspect-[4/5]`).
