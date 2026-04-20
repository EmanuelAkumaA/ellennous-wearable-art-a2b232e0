

O usuário quer que as avaliações **aprovadas** no admin apareçam na seção "Quem veste a Ellennous" do site público, substituindo gradualmente os depoimentos fake até os clientes reais preencherem.

Olhando o `Testimonials.tsx` atual: **isso já está implementado**. O componente faz `supabase.from("reviews").select(...).eq("status", "approved")` e só usa o fallback se vier vazio. Verifiquei também que a RLS permite `anon` ler aprovadas (`Public can view approved reviews`).

Então preciso descobrir por que não aparece. Hipóteses:
1. Não há nenhuma avaliação com `status = 'approved'` no banco — todas estão `pending`/`rejected`.
2. Há aprovadas mas o fallback está mascarando porque a query falhou silenciosamente.
3. Cache stale do React Query / browser.

Vou verificar o banco e ajustar o comportamento para ser mais transparente.

