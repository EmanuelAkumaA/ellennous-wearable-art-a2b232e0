

# Plano — Atualização de Tipografia Premium

## Análise

Atual:
- `display`: Butler / Cormorant Garamond (serifado clássico)
- `sans`/`body`: EB Garamond (serifado)
- Tudo em serifa = visual barroco demais para o objetivo "luxo artístico moderno"

Novo sistema solicitado (3 fontes):
| Uso | Fonte | Peso |
|---|---|---|
| H1, H2 (títulos principais) | Playfair Display | 400, 700 |
| H3, destaques curtos, "IDENTIDADE/EXCLUSIVO" | Bebas Neue | 400 |
| Parágrafos, UI, botões | Inter | 400, 500, 600 |

## Mudanças

### 1. `src/index.css`
- Trocar `@import` do Google Fonts: remover Cormorant + EB Garamond, importar **Playfair Display** (400, 700, italic), **Bebas Neue** (400) e **Inter** (400, 500, 600)
- Manter os `@font-face` Butler? **Não** — remover, conforme nova diretriz "não usar mais de 3 fontes"
- Atualizar `body` → `font-family: 'Inter', system-ui, sans-serif`
- Atualizar `h1, h2` → `font-family: 'Playfair Display', serif`; letter-spacing leve (0.005em); peso 700 default
- Adicionar regra `h3, h4` → `font-family: 'Bebas Neue', sans-serif`; letter-spacing 0.05em; uppercase
- Atualizar utilitários `.font-display` → Playfair, `.font-body` → Inter, criar `.font-accent` → Bebas Neue

### 2. `tailwind.config.ts`
Substituir `fontFamily`:
```ts
display: ['"Playfair Display"', 'Georgia', 'serif'],
accent: ['"Bebas Neue"', 'Impact', 'sans-serif'],
sans: ['Inter', 'system-ui', 'sans-serif'],
body: ['Inter', 'system-ui', 'sans-serif'],
```

### 3. Aplicar `font-accent` (Bebas Neue) em destaques curtos
Revisar os componentes em `src/components/sections/` e trocar `font-display` para `font-accent` onde o texto é uma **palavra-chave curta em CAPS** (eyebrows, labels, números de pilares):

- `Hero.tsx`: eyebrow `"Ellennous · Arte Vestível"` → font-accent; título principal `"NÃO É ROUPA / É IDENTIDADE"` (curto, impacto, CAPS) → **font-accent** com tamanho ainda maior; substituto `font-display` no H1 não combina aqui pois é toda em CAPS (Bebas brilha)
- `FinalCTA.tsx`: eyebrow → font-accent; H2 longo "Se você entendeu, você já sabe." → manter **font-display** (Playfair) por ser frase, não palavra-chave
- `Manifesto.tsx`: blockquote longa → **font-display** (Playfair italic combina com manifesto); eyebrow "MANIFESTO" → font-accent
- `Positioning.tsx`, `ForWhom.tsx`: eyebrows → font-accent; números "01/02/03" → font-accent (já são curtos/CAPS-like); títulos das pillars curtos → font-accent
- `ScarType.tsx`, `Process.tsx`, `Gallery.tsx`, `Testimonials.tsx`, `Footer.tsx`: aplicar mesma lógica — eyebrows e labels CAPS → Bebas; títulos de frase → Playfair; corpo → Inter (default automático)

### 4. Botões
- `Button` (`ui/button.tsx`) já usa default `font-medium` → herdará Inter automaticamente. ✓
- Botões com `tracking-[0.15em] uppercase font-semibold` no Hero/FinalCTA → trocar para classe `font-accent` (Bebas Neue) para mais força visual nos CTAs principais

### 5. Ajustes de tamanho/spacing
- Bebas Neue é mais alta/estreita — ajustar `tracking` para compensar (`tracking-wide` em CAPS curtos)
- Playfair é serif larga — manter `[text-wrap:balance]` e `leading-[0.95]` já existentes
- Inter como body → garantir `leading-relaxed` em parágrafos longos

### 6. README
Adicionar nota da nova stack tipográfica na tabela/seção de design.

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/index.css` | trocar @import, @font-face, font-family de h1/h2/h3, utilitários |
| `tailwind.config.ts` | redefinir `fontFamily` (display/accent/sans/body) |
| `src/components/sections/Hero.tsx` | font-accent em eyebrow, título e CTA |
| `src/components/sections/FinalCTA.tsx` | font-accent em eyebrow e CTA |
| `src/components/sections/Manifesto.tsx` | font-accent em eyebrow |
| `src/components/sections/Positioning.tsx` | eyebrow + números + títulos curtos → font-accent |
| `src/components/sections/ForWhom.tsx` | eyebrow + numeração → font-accent |
| `src/components/sections/ScarType.tsx` | revisar |
| `src/components/sections/Process.tsx` | revisar |
| `src/components/sections/Gallery.tsx` | revisar (filtros → font-accent) |
| `src/components/sections/Testimonials.tsx` | revisar |
| `src/components/sections/Footer.tsx` | eyebrows → font-accent |
| `README.md` | atualizar seção tipografia |

## Pontos de atenção

- **Paleta e layouts não mudam** — apenas tokens de fonte e classes utilitárias
- Butler `.woff2` instruído anteriormente deixará de ser usado; vou remover os `@font-face` para não tentar carregar arquivos inexistentes
- Bebas Neue sempre em maiúsculas/CAPS para preservar identidade da fonte
- Limite respeitado: **3 fontes** (Playfair / Bebas / Inter)

