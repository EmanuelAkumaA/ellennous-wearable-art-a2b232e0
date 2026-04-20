
## Plano

Duas mudanças complementares para resolver os dois problemas (zoom exagerado nos cards + economia de storage no upload).

### Problema 1 — Cards "cortando" demais a foto

Hoje, em `Gallery.tsx`, o `<img>` da grid usa `object-cover` num container `aspect-[4/5]`. Como a maioria das obras é fotografada em proporção mais quadrada/horizontal, o `cover` corta cabeça/pés e dá sensação de "zoom".

**Solução em duas camadas:**

**A) Mudar o comportamento padrão do thumb (rápido, resolve 90% dos casos)**
- Trocar o container de `aspect-[4/5]` para `aspect-[3/4]` (proporção mais próxima das fotos reais).
- Trocar `object-cover` por `object-contain` com fundo escuro (`bg-secondary/40`) atrás — assim a peça inteira aparece, com leves margens laterais quando necessário, sem cortar.
- Manter a sobreposição de gradiente, badges e título na parte inferior, mas posicionados sobre o fundo escuro (não mais sobre a foto), para não tampar a peça.
- Ajustar `sizes`/`srcset` para a nova largura.

**B) Permitir ajuste por obra no admin (controle fino quando o padrão não basta)**

Adicionar dois controles novos na seção **Capa** do `PiecesManager`:

1. **Modo de exibição** (toggle): `Conter` (default — mostra a peça inteira) | `Cobrir` (preenche o card, pode cortar).
2. **Ponto focal** (só aparece no modo Cobrir): mini-preview clicável onde o admin clica em um ponto da imagem (X/Y em %) e esse ponto vira o "centro" do crop via `object-position: X% Y%`. Marcador visual sobreposto à miniatura.

Esses dois valores são salvos por obra; a galeria pública lê e aplica.

### Problema 2 — Compressão automática no upload

Hoje `handleUpload` e `handleCoverUpload` enviam o arquivo cru (3-5 MB cada). Vamos comprimir no navegador antes do upload.

**Helper `src/lib/imageCompression.ts`** (novo, sem dependência externa — usa `canvas` nativo):
- `compressImage(file, { maxWidth: 2000, quality: 0.85, mimeType: "image/jpeg" })`
- Decodifica via `createImageBitmap`, redimensiona proporcionalmente se a largura > maxWidth, exporta com `canvas.toBlob('image/jpeg', 0.85)`.
- Pula compressão se o arquivo já for `image/svg+xml` ou `image/gif` (preserva animação/vetor).
- Para `image/png` com transparência, mantém PNG (não converte pra JPEG).

**Aplicar em**:
- `handleUpload` (galeria) — comprime cada arquivo antes do `storage.upload`.
- `handleCoverUpload` (capa) — idem.
- Mostrar feedback no toast: "Imagens comprimidas e enviadas".

Resultado esperado: arquivos de 3-5 MB → ~200-400 KB cada, sem perda visível. O CDN do Supabase (helper já criado em `imageOptimization.ts`) ainda gera versões otimizadas em cima disso para a galeria pública.

### Schema de banco

Adicionar duas colunas em `gallery_pieces`:
- `cover_fit text not null default 'contain'` (valores: `'contain'` | `'cover'`)
- `cover_position text not null default '50% 50%'` (formato CSS direto: `"50% 30%"`)

Migration via tool de migração (sem CHECK constraint — apenas default).

### Arquivos a modificar/criar

- `src/lib/imageCompression.ts` (novo — helper de compressão client-side)
- `src/components/sections/gallery/useGalleryData.ts` (mapear os novos campos `cover_fit` e `cover_position`)
- `src/components/sections/gallery/Gallery.tsx` (aplicar `aspect-[3/4]`, `object-contain`/`object-cover` conforme `coverFit`, e `objectPosition` conforme `coverPosition`; ajustar gradiente para não tampar a peça)
- `src/pages/admin/PiecesManager.tsx`:
  - Importar e usar `compressImage` em `handleUpload` e `handleCoverUpload`.
  - Adicionar UI de "Modo de exibição" (toggle) e "Ponto focal" (preview clicável) na seção Capa.
  - Persistir `cover_fit` e `cover_position` ao mudar.
- Migration SQL para adicionar as duas colunas.

### Validação
1. **Admin → editar obra → seção Capa**: aparece toggle "Conter / Cobrir". No modo Cobrir, surge a miniatura clicável; clicar move o ponto focal e atualiza preview em tempo real.
2. **Upload novo**: enviar uma foto de 4 MB — deve subir em 1-2s e o arquivo no bucket deve ter ~300 KB (verificar tamanho via Network).
3. **Home (/galeria)**: por padrão as obras aparecem inteiras (sem corte de cabeça/pés), com leve fundo escuro nas laterais quando a foto for quadrada.
4. **Obra com modo "Cobrir" + ponto focal customizado**: card preenche a área toda e o foco aparece centrado onde o admin escolheu.
5. Imagens existentes continuam funcionando (default `'contain'` + `'50% 50%'`).
