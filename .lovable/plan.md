

# Plano de Polimento — Ellennous v0.1.x

Vou analisar antes de planejar. Pelas imagens e instruções:

- **image-5**: ThemeToggle (botão sol/lua no canto superior direito) — usuário quer **remover**.
- **image-6**: Seção FinalCTA no mobile — texto "você já sabe." está sendo cortado (overflow). Precisa ajustar responsividade.
- **image-7**: Footer no mobile — logo atual é o wordmark colorido pequeno. Trocar pela logo SVG enviada (`Ellennous-3.svg`) e arrumar responsividade (botão WhatsApp flutuante sobrepõe o crédito "Kuma Tech").

## 1. Versão de volta para 0.1.0
- `package.json`: `"version": "0.1.0"`
- `README.md`: atualizar tabela de versões removendo a 0.1.1.

## 2. Sistema de bump automático de versão
Como o ambiente Lovable não roda hooks do git nem permite criar `.husky/`, vou criar:
- `scripts/bump-version.mjs` — script Node que:
  - Lê `package.json`, incrementa o **patch**
  - Atualiza a tabela do `README.md` adicionando uma nova linha (entrada manual de descrição via `process.argv[2]` ou placeholder)
- Adicionar comando `npm run bump` em `package.json` (`"bump": "node scripts/bump-version.mjs"`)
- Documentar no README como usar (`npm run bump "descrição da mudança"`)

> Observação para o usuário: como o Lovable gerencia commits internamente, o pre-commit hook tradicional não funciona. O script `npm run bump` deve ser executado manualmente antes de subir mudanças significativas via GitHub local. Vou deixar isso claro no README.

## 3. Fonte Butler real (.woff2)
**Importante**: não tenho a fonte Butler em mãos — ela é comercial (paga). Não posso baixá-la nem distribuí-la sem licença. Vou:
- Criar a estrutura `public/fonts/` com um `README.md` explicando onde o usuário deve colocar os arquivos `Butler-Regular.woff2`, `Butler-Medium.woff2`, `Butler-Bold.woff2`, `Butler-Light.woff2`
- Já configurar os `@font-face` em `src/index.css` apontando para `/fonts/Butler-*.woff2` com `font-display: swap`
- Atualizar `tailwind.config.ts`: `display: ['Butler', 'Cormorant Garamond', serif]` (Butler primeiro, Cormorant como fallback até o usuário subir os arquivos)
- Assim, no momento que o usuário fizer o upload dos `.woff2`, a fonte oficial passa a vigorar automaticamente. Sem upload, o fallback Cormorant continua funcionando.

## 4. Remover Light mode
- Deletar `src/components/ThemeToggle.tsx`
- Remover import/render em `src/pages/Index.tsx` (ou onde estiver)
- Remover bloco `:root` light de `src/index.css` — manter só o tema dark como padrão
- Remover script anti-flash do `index.html` que checa localStorage do tema
- Atualizar `README.md` removendo menção ao toggle

## 5. Responsividade Hero/FinalCTA (image-6)
Em `src/components/sections/FinalCTA.tsx`:
- O h2 está com `text-5xl sm:text-7xl md:text-8xl` — no viewport 390px, `text-5xl` (3rem) ainda quebra estranho com "você já sabe." em itálico/larga.
- Reduzir mobile: `text-4xl sm:text-6xl md:text-7xl lg:text-8xl`
- Adicionar `break-words` e padding lateral maior no container
- Garantir `overflow-hidden` na section e `max-w-full` no h2

Verificar também outras seções principais com tipografia gigante (Hero, Manifesto) para o mesmo problema no 390px.

## 6. Footer — trocar logo + responsividade mobile (image-7)
- Copiar `user-uploads://Ellennous-3.svg` para `src/assets/logo-ellennous.svg`
- Em `src/components/sections/Footer.tsx`:
  - Substituir `import logoEllennous from "@/assets/logo-ellennous.png"` por `.svg`
  - Aumentar a altura da logo no mobile (`h-14 md:h-16`)
  - Adicionar `padding-bottom` extra no footer mobile (`pb-24 md:pb-14`) para o botão WhatsApp flutuante não cobrir o crédito Kuma Tech
  - Centralizar melhor blocos no mobile, garantir gap adequado
  - Considerar esconder ou reposicionar elementos para evitar sobreposição com o FAB do WhatsApp

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `package.json` | versão → 0.1.0; novo script `bump` |
| `scripts/bump-version.mjs` | **novo** — bump automático |
| `public/fonts/README.md` | **novo** — instruções Butler |
| `src/index.css` | @font-face Butler; remove tema light |
| `tailwind.config.ts` | Butler como display primária |
| `src/components/ThemeToggle.tsx` | **deletado** |
| `src/pages/Index.tsx` | remove ThemeToggle |
| `index.html` | remove script anti-flash de tema |
| `src/components/sections/FinalCTA.tsx` | responsividade tipografia |
| `src/components/sections/Hero.tsx` | revisar tipografia mobile |
| `src/assets/logo-ellennous.svg` | **novo** — logo oficial |
| `src/components/sections/Footer.tsx` | nova logo + spacing mobile |
| `README.md` | tabela versões + remover light mode + doc bump |

## Pontos de atenção
- **Butler é fonte paga**: arquivos `.woff2` precisam ser subidos pelo usuário em `public/fonts/`. Já deixarei `@font-face` configurado e fallback funcional.
- **Bump pré-commit no Lovable**: o ambiente sandbox não suporta git hooks; o script será manual via `npm run bump`.

