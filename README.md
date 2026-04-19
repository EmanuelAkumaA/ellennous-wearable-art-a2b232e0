# ELLENNOUS — Arte Vestível

Site institucional premium da marca **Ellennous**: peças únicas feitas à mão.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + design system semântico (HSL tokens) — **dark mode only**
- shadcn/ui · Radix · Embla Carousel · Lucide
- Tipografia: **Playfair Display** (títulos H1/H2) · **Bebas Neue** (destaques CAPS, H3, CTAs) · **Inter** (corpo, UI)

## Versionamento

- Formato: `MAJOR.MINOR.PATCH` (SemVer)
- A cada commit incrementamos o **PATCH** (último dígito) via script.

```bash
npm run bump                          # +1 patch, descrição genérica
npm run bump "ajusta footer mobile"   # +1 patch + descrição na tabela
npm run bump minor "novo header"      # +1 minor (zera patch)
npm run bump major "redesign total"   # +1 major (zera minor + patch)
```

> O ambiente Lovable não roda hooks de pre-commit, então o bump é manual:
> rode `npm run bump "<descrição>"` antes de cada push relevante. O script
> atualiza `package.json` e adiciona uma linha à tabela abaixo.

| Versão | Mudanças |
| ------ | -------- |
| 0.1.0  | Versão inicial do site |

## Estrutura

```
public/
└── fonts/             # Coloque aqui Butler-*.woff2 (ver public/fonts/README.md)

scripts/
└── bump-version.mjs   # Bump automático de versão + README

src/
├── assets/              # Imagens da galeria, hero, logo, depoimentos
├── components/
│   ├── icons/           # Ícones customizados (WhatsApp, etc.)
│   ├── sections/        # Seções da landing (Hero, Galeria, Footer…)
│   ├── ui/              # shadcn/ui primitives
│   └── FloatingWhatsApp.tsx
├── hooks/
├── pages/
└── index.css            # Design tokens (dark) + @font-face Butler
```

## Scripts

```bash
npm run dev         # desenvolvimento
npm run build       # build produção
npm run lint        # eslint
npm run test        # vitest
npm run bump        # incrementa versão + atualiza README
```

## Tema

Dark mode único (palette roxo/vinho/gelo). Não há toggle de tema.

## Crédito

Criado por [Kuma Tech](https://kumatech.com.br/).
