

## Plano — Crop/zoom da foto, paleta maior na sidebar com borda animada e link público

### 1. Crop + zoom antes do upload (UserSettings)

Novo componente `AvatarCropDialog.tsx` (modal que abre após escolher arquivo):

- **Layout**: dialog centralizado, área de crop com **máscara em forma de paleta** (mesmo `PALETTE_PATH` do `PalettePhoto`) — assim o usuário vê exatamente como a foto vai ficar.
- **Controles**:
  - Slider de **zoom** (1x–3x).
  - Drag (mouse/touch) para **mover** a imagem.
  - Botão "Cancelar" e "Aplicar".
- **Implementação**: HTML5 Canvas (sem libs externas).
  - Canvas 400x400, desenha a imagem com transform (scale + offset).
  - Ao aplicar: `canvas.toBlob()` → File JPEG quality 0.92 → mesmo fluxo de upload existente (`supabase.storage.upload`).
  - Overlay SVG por cima do canvas com o `clipPath` da paleta + gradiente nas bordas (preview fiel).
- **Fluxo no UserSettings**:
  1. Usuário clica na paleta → input file abre.
  2. `onChange` → cria `URL.createObjectURL(file)` → abre `AvatarCropDialog` com essa URL (não faz upload direto mais).
  3. Dialog retorna o Blob recortado → segue o upload já existente.

### 2. Paleta maior na sidebar + foto centralizada

**`PalettePhoto.tsx` — ajustes**:
- Tamanho `sm` aumenta de **52px → 68px** (mostra dots melhor sem ficar grande).
- Reposicionar `THUMB_HOLE` ligeiramente e ajustar `preserveAspectRatio` da `<image>` — hoje está `xMidYMid slice` cobrindo viewBox 0-100, mas o corpo da paleta não ocupa todo o quadrado (forma orgânica), então a foto fica deslocada pra direita.
  - **Fix**: a imagem vai usar um viewBox/coordenadas centralizadas no **bbox do corpo** da paleta (~ x:4, y:4, w:92, h:91, com centro ≈ 50,52). Vou escalar a `<image>` de `0,0 100x100` pra `-5,-3 110x108` (zoom out leve) ou usar `<g transform="translate(...) scale(...)">` para centralizar a foto dentro do corpo, sem cortar o lado esquerdo.

**Sidebar `AdminShell.tsx`**: o `size="sm"` herda o novo tamanho; nada mais a tocar além do gap visual com o texto.

### 3. Fundo da paleta = "cor sozinha" (5ª tinta) + borda gradiente animada

Conceito: 4 tintas (1–4) compõem a **borda em degradê girando**; a 5ª tinta (a "que ficou sozinha") preenche o **fundo** quando não há foto.

**`PalettePhoto.tsx` — mudanças**:

a) **Fundo dinâmico (sem foto)**: trocar o `linearGradient` fixo por um `<rect>` com `fill={palette[4]}` (a 5ª cor). Quando há foto, a foto continua cobrindo tudo.

b) **Borda animada com 4 cores girando**:
   - Adicionar `<defs>` com um `conic-gradient` simulado via SVG: como SVG não tem conic nativo, vou usar uma **abordagem CSS** — wrappar o SVG num `<div>` com `background: conic-gradient(from 0deg, c1, c2, c3, c4, c1)` + `mask` no formato da paleta para deixar só a borda aparecer.
   - Outra alternativa mais simples e que funciona em todos browsers: aplicar a `conic-gradient` num `<div>` de fundo, com `clipPath` da paleta, e dentro dele um segundo `<div>` ligeiramente menor (inset 2px) com o conteúdo (foto/cor sólida) clipado pela mesma forma. A diferença entre os dois forma a "borda".
   - Animação: `@keyframes rotate-palette { to { transform: rotate(360deg) } }` aplicada num pseudo `::before` com o gradient e `width/height: 200%` pra rotacionar sem cortar — ou mais simples: animar `--angle` via `@property --angle` + `background: conic-gradient(from var(--angle), ...)`. Fallback: girar o elemento de fundo inteiro com `transform: rotate`.
   - Velocidade: ~8s linear infinite, com `box-shadow` glow sutil pulsando.

c) **Estrutura final do componente**:
```
<div class="palette-frame">                    ← gira o gradient
  <div class="palette-border" style="conic..."> 
    <div class="palette-inner">                ← clipPath da paleta
      <svg>...foto + dots + furo...</svg>      ← fundo = palette[4]
    </div>
  </div>
</div>
```

**Aplicação**: tanto na sidebar quanto na aba Conta — o componente já é reusado, então a borda animada aparece nos dois lugares automaticamente.

### 4. Link "Ver site público" → URL externa

Em `AdminShell.tsx`, linha 127–131: trocar `<Link to="/">` por `<a href="https://ellennous-wearable-art.vercel.app/" target="_blank" rel="noopener noreferrer">`. Remove o import `Link` se não usado em outro lugar (mantenho se sim).

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/AvatarCropDialog.tsx` | NOVO — crop/zoom canvas com máscara da paleta |
| `src/components/admin/PalettePhoto.tsx` | Tamanho `sm` 68px, foto centralizada, fundo = `palette[4]`, borda conic-gradient animada com `palette[0..3]` |
| `src/index.css` | Keyframes `rotate-palette` + `@property --angle` para o gradient girar |
| `src/pages/admin/UserSettings.tsx` | Fluxo `file → CropDialog → upload`; remove upload direto |
| `src/components/admin/AdminShell.tsx` | Link externo no botão "Ver site público" |

### Validação
1. Aba Conta → escolher foto → abre dialog de crop com máscara de paleta → ajusta zoom/posição → aplica → upload + sidebar atualizam com a foto centralizada certinho.
2. Sidebar mostra paleta um pouco maior (68px); 5 dots visíveis sem amontoar.
3. Sem foto: fundo da paleta = cor da 5ª tinta (amarelo no padrão); borda gira mostrando as outras 4 cores em degradê com brilho.
4. Mudar a 5ª cor no color picker → fundo da paleta muda em tempo real.
5. Mudar tinta 1–4 → borda animada reflete as novas cores.
6. Clicar "Ver site público" na sidebar → abre `https://ellennous-wearable-art.vercel.app/` em nova aba.

