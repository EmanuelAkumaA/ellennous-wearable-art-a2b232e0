
# Site Premium Ellennous — Plano

Site imersivo de arte vestível com galeria gerenciável e CTA total para WhatsApp `+5511976864627`.

## Identidade visual
- **Dark mode** com fundo `#0A0A0F` + texturas sutis de respingo de tinta
- Paleta: roxo `#8A2AE3` (primária), vermelho `#ED1925` (acento), vinho `#591D29`, azul escuro `#262E52`, azul claro `#AEEAF2`, branco
- Tipografia: display serifada/cinzelada para títulos (ex: Cormorant/Cinzel), sans moderna para corpo (Inter)
- Gradientes roxo→vinho, glow sutil, vinhetas escuras
- **Camaleão SVG** animado: aparece camuflado em 3-4 pontos do scroll, muda de cor conforme a seção
- **Dragão oriental SVG**: marca d'água sutil em seções premium (galeria + ScarType)
- Microinterações: fade-in + slide ao scroll, hover com zoom suave, splash de tinta no hero

## Estrutura da landing (seção única `/`)
1. **Hero** — fundo escuro com splash animado, título "NÃO É ROUPA. É IDENTIDADE.", subcopy, 2 CTAs (WhatsApp / Explorar obras)
2. **Posicionamento** — "Você não compra uma peça. Você veste algo que nunca existiu antes." + 3 pilares
3. **Frase manifesto** — "Eu não nasci pra me encaixar. Nasci pra ser referência." em destaque tipográfico
4. **Galeria** — grid premium com filtros por categoria (Anime/Geek, Realismo, Floral, ScarType, Exclusivas). Cards com hover zoom. Click abre modal com nome, descrição, conceito, tempo de produção e CTA "Quero algo nesse nível"
5. **Processo de criação** — timeline vertical com 5 etapas, tempo médio 30-40 dias
6. **Método ScarType™** — bloco premium com dragão de fundo, 3 técnicas (fusão, costura artística, pintura manual)
7. **Para quem é** — 3 perfis ideais
8. **CTA Final** — "Se você entendeu, você já sabe." + botão WhatsApp grande
9. **Footer** minimalista

## Galeria gerenciável (Lovable Cloud)
- Tabela `pieces`: nome, categoria, descrição, conceito, tempo_producao, imagem_url, destaque, ordem
- Storage bucket `pieces-images` para upload
- RLS: leitura pública, escrita só para admin (via tabela `user_roles` + função `has_role`)
- Imagens iniciais geradas com IA (estilo dark, Solo Leveling/Igris vibes) — uma por categoria, mais 4-5 destaques

## Painel `/admin` (1 usuário admin)
- `/admin/login` — email + senha (Lovable Cloud Auth)
- `/admin` protegido — só renderiza se o usuário tem role `admin`
- Lista de peças com thumbnail, busca, filtro por categoria
- Formulário criar/editar: nome, categoria (select), descrição, conceito, tempo de produção, upload de imagem, toggle destaque
- Botão excluir com confirmação
- Após login, primeiro usuário cadastrado pode ser promovido a admin via SQL (instrução incluída)

## WhatsApp
- Todos os CTAs abrem `https://wa.me/5511976864627?text=Quero%20criar%20minha%20pe%C3%A7a%20exclusiva%20Ellennous.`
- Modal de peça envia mensagem contextual: "Quero algo no nível de [nome da peça]"
- Botão flutuante WhatsApp visível em todo scroll (mobile + desktop)

## SEO + Performance
- `<title>`, meta description e OG tags conforme briefing
- H1 único, hierarquia H2 correta, alt text em todas as imagens
- Imagens otimizadas (lazy load, formatos modernos)
- Animações via CSS/Tailwind (sem libs pesadas)
- 100% mobile-first, testado em viewport pequeno

## Stack técnica
- Lovable Cloud (Auth + DB + Storage)
- Lovable AI (geração das imagens iniciais da galeria via Nano Banana)
- React + Tailwind + shadcn (modais, formulários admin, toasts)
- React Router para `/`, `/admin/login`, `/admin`
