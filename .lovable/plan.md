

## Plano — Identidade visual Ellennous na página de avaliação

Aplicar o mesmo DNA do site (Hero/Testimonials) à página `/avaliar/:token`: fundo escuro com glow, grain, eyebrow em Bebas Neue caps, título em Playfair com gradiente, dragon de fundo discreto, botão estilo Hero (gradient purple-wine, rounded-none, tracking caps), inputs com borda translúcida e foco glow.

### Mudanças em `src/pages/ReviewSubmit.tsx`

**Wrapper / fundo (em todos os estados: loading, valid, invalid, submitted)**
- `<section>` full-screen com:
  - Imagem/glow radial (reaproveitar `gradient-hero` + um `bg-primary/15 blur-[140px]` no canto, igual à Testimonials).
  - `splash-bg animate-splash-drift` em opacidade 30%.
  - `<Dragon>` muito discreto (opacity ~0.05) no fundo à esquerda.
  - Card central com `bg-background/60 backdrop-blur-sm border border-primary/15` (glassy, padrão do site), padding generoso, `rounded-none` (linha visual do site usa retângulos).

**Cabeçalho (estado `valid`)**
- Eyebrow: `font-accent text-[10px] tracking-[0.4em] uppercase text-primary-glow` → "Ellennous · Avaliação"
- Título: `font-display text-4xl md:text-5xl text-gradient-light` → "Conte sua experiência"
- Subtítulo: `text-foreground/70` → "Sua palavra ajuda a contar quem somos."
- Pequena linha decorativa `w-12 h-px bg-primary-glow/50 mx-auto`

**Banner modo demonstração**
- Trocar para visual mais marca: borda `border-primary-glow/30`, fundo `bg-primary/5`, eyebrow Bebas em primary-glow.

**Estrelas**
- Maiores (h-9 w-9), com `drop-shadow` glow ao selecionar (`fill-primary-glow text-primary-glow`).
- Label centralizada em accent caps.

**Inputs/Textarea**
- Override visual: `bg-background/40 border-border/60 focus-visible:border-primary-glow focus-visible:ring-primary/30 rounded-none h-12` (consistente com Hero buttons rounded-none).
- Labels: `font-accent text-[11px] tracking-[0.3em] uppercase text-foreground/70`.

**Upload de foto**
- Avatar circular com borda `border-primary-glow/40` e glow sutil.
- Botão "Escolher foto" no estilo outline do Hero (`border-foreground/20 hover:border-primary-glow hover:text-primary-glow rounded-none font-accent uppercase tracking-[0.2em]`).

**Botão Enviar (CTA principal)**
- Igual ao botão principal do Hero:
  ```
  font-accent text-base bg-gradient-purple-wine border border-primary-glow/40 
  hover:shadow-glow text-white tracking-[0.2em] uppercase h-14 rounded-none w-full
  ```

**Estado `submitted`**
- Manter o check, mas com:
  - Círculo maior (w-20 h-20), borda `border-primary-glow/50`, glow `shadow-glow`.
  - Título `font-display text-4xl md:text-5xl text-gradient-light`.
  - Eyebrow Bebas caps em primary-glow.
  - Botão "Voltar ao site" linkando para `/` no estilo outline do Hero.

**Estado `invalid`**
- Mesma moldura visual; ícone de alerta com glow vermelho (`shadow-red-glow`), eyebrow em `text-destructive`, título Playfair, mensagem em `text-foreground/70`.
- Botão outline "Voltar ao site" → `/`.

**Estado `loading`**
- Mesmo fundo; spinner com glow primary, eyebrow Bebas "Verificando convite…".

**Footer da página**
- Pequeno selo `font-accent text-[10px] tracking-[0.4em] uppercase text-muted-foreground/60` → "Ellennous · Arte Vestível" abaixo do card.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/ReviewSubmit.tsx` | Reestilização completa aplicando DNA visual do site (sem mudar lógica) |

### Validação
1. `/avaliar/preview` → visual escuro, glow roxo, dragon ao fundo, fontes Playfair/Bebas, CTA gradient purple-wine.
2. Estados loading / invalid / submitted seguem a mesma moldura.
3. Inputs mantêm acessibilidade e foco visível com glow primary.
4. Mobile: padding/tamanhos respondem bem (form continua centralizado, max-w mantida).

