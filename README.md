# ELLENNOUS — Arte Vestível

Site institucional premium da marca **Ellennous**: peças únicas feitas à mão.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + design system semântico (HSL tokens)
- shadcn/ui · Radix · Embla Carousel · Lucide
- Tipografia: **Cormorant Garamond** (display) + **EB Garamond** (texto)

## Versionamento

- Formato: `MAJOR.MINOR.PATCH` (SemVer)
- A cada commit incrementamos o **PATCH** (último dígito).
- Versão atual: ver [`package.json`](./package.json).

| Versão | Mudanças |
| ------ | -------- |
| 0.1.0  | Versão inicial do site |
| 0.1.1  | Tipografia Butler/Garamond, light premium, ícones sociais, fix de filtros, crédito Kuma Tech |

## Estrutura

```
src/
├── assets/              # Imagens da galeria, hero, logo, depoimentos
├── components/
│   ├── icons/           # Ícones customizados (WhatsApp, etc.)
│   ├── sections/        # Seções da landing (Hero, Galeria, Footer…)
│   ├── ui/              # shadcn/ui primitives
│   ├── FloatingWhatsApp.tsx
│   └── ThemeToggle.tsx  # Light/Dark switch (canto superior direito)
├── hooks/
├── pages/
└── index.css            # Design tokens (light + dark)
```

## Scripts

```bash
npm run dev         # desenvolvimento
npm run build       # build produção
npm run lint        # eslint
npm run test        # vitest
```

## Tema

Suporta **dark (padrão)** e **light premium**. Persistência em `localStorage`
sob a chave `ellennous-theme`. Aplicado antes do paint para evitar flash.

## Crédito

Criado por [Kuma Tech](https://kumatech.com.br/).
