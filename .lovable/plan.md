
## Plano — Aplicar migration da capa no Supabase (Cloud)

### Diagnóstico
- Frontend já está pronto (botão "Definir como capa", badge "CAPA", `useGalleryData` lendo `cover_image_id`).
- Banco **não tem** a coluna `cover_image_id` em `gallery_pieces` — a migration foi proposta antes mas nunca foi aplicada.
- Resultado: hoje clicar na estrela não tem efeito permanente.

### Mudança no banco (única migration)
```sql
-- 1. Coluna nullable, sem FK rígida
ALTER TABLE public.gallery_pieces
  ADD COLUMN cover_image_id uuid;

-- 2. Trigger: ao deletar imagem, limpar capa nas peças que a usavam
CREATE OR REPLACE FUNCTION public.clear_cover_on_image_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gallery_pieces
  SET cover_image_id = NULL
  WHERE cover_image_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_clear_cover_on_image_delete
BEFORE DELETE ON public.gallery_piece_images
FOR EACH ROW EXECUTE FUNCTION public.clear_cover_on_image_delete();

-- 3. Backfill: peças existentes recebem como capa a primeira imagem por ordem
UPDATE public.gallery_pieces p
SET cover_image_id = sub.id
FROM (
  SELECT DISTINCT ON (piece_id) id, piece_id
  FROM public.gallery_piece_images
  ORDER BY piece_id, ordem ASC, created_at ASC
) sub
WHERE p.id = sub.piece_id AND p.cover_image_id IS NULL;
```

### Frontend
Nada a alterar — o código já lida com `cover_image_id`. Após a migration:
- O `types.ts` é regenerado automaticamente, removendo o `as any` que ficou no `setCover`.
- A leitura pública (`useGalleryData`) passa a respeitar a capa escolhida.

### Lovable Cloud — sem desconectar
Mantemos o backend atual (Lovable Cloud / projeto `tayitsyyyqskbmnmyljl`). A migration roda direto via tool de migração; nenhuma ação manual no Supabase é necessária.

### Validação após aplicar
1. Abrir `/admin` → editar uma obra com várias imagens → clicar na estrela em uma imagem que não é a primeira → recarregar a página → confirmar que badge "CAPA" persiste.
2. Abrir a galeria pública → confirmar que o card mostra a imagem escolhida como capa.
3. Deletar a imagem que é capa → confirmar que `cover_image_id` volta a `NULL` (e o frontend cai no fallback da primeira imagem).

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| nova migration | adiciona coluna + trigger + backfill |
| `src/integrations/supabase/types.ts` | regenerado automaticamente |
