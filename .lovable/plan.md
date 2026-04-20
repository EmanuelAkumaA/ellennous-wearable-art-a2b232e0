

O botão "Ver página base" hoje aponta para `/avaliar/preview`, mas o `ReviewSubmit.tsx` provavelmente faz o pré-check do token via edge function antes de renderizar — e como `preview` não é um token real, a página deve estar travando em "validando" ou "convite inválido" em vez de abrir o formulário em modo demo.

## Plano — Garantir que `/avaliar/preview` abra direto no formulário

### Ajuste no `src/pages/ReviewSubmit.tsx`
- Logo no início do effect de validação, **detectar `token === "preview"`** e pular completamente a chamada à edge function.
- Setar imediatamente:
  - `status = "valid"`
  - `previewMode = true`
- Mostrar um banner discreto no topo do formulário: *"Modo demonstração — nada será enviado."*
- No `handleSubmit`, se `previewMode`, não fazer upload nem chamar a edge function: apenas mostrar toast `"Modo demonstração — avaliação não foi enviada."` e resetar o form (ou ir para a tela de obrigado também em modo demo, à escolha — vou usar toast + manter no form para o admin poder testar várias vezes).

### Ajuste no `src/pages/admin/ReviewsManager.tsx`
- O botão já existe como `<a href="/avaliar/preview" target="_blank">`. Confirmar que está assim e que abre em nova aba sem interceptação. Sem mudança se já estiver correto.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/pages/ReviewSubmit.tsx` | Bypass de validação quando `token === "preview"` + flag `previewMode` no submit |

### Validação
1. `/admin` → Avaliações → clicar "Ver página base" → nova aba abre direto no formulário com banner "Modo demonstração".
2. Preencher e enviar → toast "não foi enviado", nada é gravado no banco.
3. Links reais continuam funcionando normalmente (validação real do token).

