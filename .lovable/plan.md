

## Plano — Ajustes de tipografia e link no Footer

### Mudanças

**1. Aumentar 10% títulos menores (H3/H4 — fonte Bebas Neue)**

Os "títulos menores" da imagem 1 são os textos em CAPS com tracking largo, estilo Bebas Neue (ex: "ELLENNOUS · ARTE VESTÍVEL"). Para aumentar 10% globalmente sem mexer em cada componente, ajusto a regra base de `h3, h4` em `src/index.css` adicionando `font-size: 1.1em` (herda do contexto e aplica +10%).

- Arquivo: `src/index.css`
- Bloco: `h3, h4 { ... }` em `@layer base`
- Adicionar: `font-size: 1.1em;`

Isso afeta todos os H3/H4 do site (que usam Bebas Neue), incluindo o tagline do Footer e títulos de seções como Process, ScarType, ForWhom, etc. — todos crescem proporcionalmente 10%.

**2. Footer — "Criado por Kuma Tech"**

Estado atual em `Footer.tsx`:
```tsx
<a href="https://kumatech.com.br/" ... className="tracking-[0.2em] uppercase ...">
  Criado por <span className="font-accent tracking-wider text-foreground/80">Kuma Tech</span>
</a>
```

O link já envolve a frase toda (clique em "Criado por Kuma Tech" já funciona). O problema é só visual: "Kuma Tech" tem `font-accent` (Bebas Neue) diferente de "Criado por" (Inter, herdado).

**Correção:** remover o `<span className="font-accent ...">` e deixar "Kuma Tech" com a mesma fonte de "Criado por". Mantenho um leve destaque de cor (`text-foreground/80` → `text-foreground`) para diferenciar sem mudar fonte.

- Arquivo: `src/components/sections/Footer.tsx`
- Resultado: `Criado por <span className="text-foreground">Kuma Tech</span>` — mesma fonte (Inter), mesmo tracking uppercase, link cobre a frase toda (já cobre).

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/index.css` | `h3, h4` ganha `font-size: 1.1em` |
| `src/components/sections/Footer.tsx` | "Kuma Tech" usa mesma fonte de "Criado por" |

### Pontos de atenção
- O +10% em H3/H4 é global. Se algum H3/H4 específico ficar grande demais visualmente, ajusto pontualmente depois.
- Link da Kuma Tech já funciona na frase toda — só ajuste visual de fonte.
- **Dica:** mudanças de fonte/cor/texto em elementos estáticos podem ser feitas grátis via Visual Edits (botão Edit no canto inferior esquerdo do chat).

