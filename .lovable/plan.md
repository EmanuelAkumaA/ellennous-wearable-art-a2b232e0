

Verifiquei rapidamente: no `Testimonials.tsx` cidade/estado e Instagram já estão sendo renderizados (com ícones `MapPin` e `Instagram`) e os dados já vêm do banco. Então o primeiro pedido já está implementado — vou apenas confirmar visualmente e reforçar a hierarquia se necessário.

O segundo pedido é remover o campo "Como se descreve?" (`client_role`) do formulário público.

## Plano

### 1. Confirmar exibição de cidade/estado/Instagram no site (`Testimonials.tsx`)
- Já está renderizando. Vou apenas garantir que:
  - Os campos aparecem mesmo quando não há foto (hoje só aparecem dentro do bloco de info, que é independente da foto — ok).
  - Espaçamento e hierarquia estão limpos: nome → cidade/estado → @instagram.
- Sem mudanças funcionais previstas; só ajuste fino se algo estiver escondido.

### 2. Remover "Como se descreve? (opcional)" do formulário público (`ReviewSubmit.tsx`)
- Remover do JSX o bloco do campo `client_role` (Label + Input).
- Remover `client_role` do `defaultValues` do `useForm`.
- Remover `client_role` do schema Zod.
- Remover `client_role` do payload enviado à edge function.
- **Manter** a coluna `client_role` no banco e no admin (avaliações antigas/seed continuam usando), só não coletamos mais via formulário público.
- Edge function `submit-review` continua aceitando o campo como opcional — sem mudança lá (compatibilidade).

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/ReviewSubmit.tsx` | Remover campo "Como se descreve?" do form, schema e payload |
| `src/components/sections/Testimonials.tsx` | (Verificar) já exibe cidade/estado/Instagram — sem alteração se estiver ok |

### Validação
1. `/avaliar/preview` → formulário não mostra mais "Como se descreve?".
2. Enviar avaliação real → grava normalmente sem `client_role`.
3. Home `/` → seção "Quem veste a Ellennous" mostra cidade · estado e @instagram clicável em cada card.

