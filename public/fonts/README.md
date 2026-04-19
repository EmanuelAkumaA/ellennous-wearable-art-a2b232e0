# Fontes da marca — Butler

A tipografia oficial da Ellennous é **Butler** (Fabian De Smet). É uma fonte
**comercial**, então não pode ser distribuída pelo repositório público.

## Como instalar

1. Adquira / obtenha as licenças dos pesos desejados.
2. Converta para `.woff2` (ex.: [transfonter.org](https://transfonter.org/)).
3. Coloque os arquivos **exatamente com estes nomes** dentro desta pasta:

```
public/fonts/
  Butler-Light.woff2
  Butler-Regular.woff2
  Butler-Medium.woff2
  Butler-Bold.woff2
```

Pronto — o `@font-face` já está declarado em `src/index.css` e a Butler vira
automaticamente a `font-display` do site. Enquanto os arquivos não existirem,
o site cai no fallback **Cormorant Garamond** (Google Fonts).
