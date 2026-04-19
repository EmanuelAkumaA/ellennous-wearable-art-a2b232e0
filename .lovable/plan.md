

## Plano — Ajustar espaçamento no Footer

Na imagem, as linhas divisórias (acima do logo e entre o copyright/Kuma Tech) estão muito próximas dos textos/elementos. Reduzir o `tracking` (letter-spacing) excessivo dos textos e aumentar levemente o respiro vertical entre divisores e conteúdo.

### Mudanças em `src/components/sections/Footer.tsx`

**1. Tagline "ARTE VESTÍVEL · PEÇAS ÚNICAS FEITAS À MÃO"**
- Reduzir `tracking-[0.3em]` → `tracking-[0.15em]` (diminui o "esticado" das letras).

**2. Bottom bar (copyright + Kuma Tech)**
- Reduzir `tracking-wider` (copyright) e `tracking-[0.2em]` (Kuma Tech) → `tracking-[0.1em]` em ambos, para coerência.
- Aumentar `pt-6` → `pt-8` no divisor inferior, dando mais respiro entre a linha e o texto.

**3. Divisor superior (border-t do footer)**
- Aumentar `pt-14` → `pt-16` para dar mais espaço entre a linha superior e o logo.

### Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/sections/Footer.tsx` | reduzir tracking dos textos CAPS, aumentar padding vertical dos divisores |

### Pontos de atenção
- Sem mudança de fonte, cor ou tamanho — só espaçamento horizontal (letras) e vertical (divisores).
- Mantém a hierarquia visual atual.

