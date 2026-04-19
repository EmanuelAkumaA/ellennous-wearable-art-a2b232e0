-- 1. Add cover_image_id column
ALTER TABLE public.gallery_pieces
  ADD COLUMN IF NOT EXISTS cover_image_id uuid;

-- 2. Trigger function: clear cover when image is deleted
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

DROP TRIGGER IF EXISTS trg_clear_cover_on_image_delete ON public.gallery_piece_images;
CREATE TRIGGER trg_clear_cover_on_image_delete
BEFORE DELETE ON public.gallery_piece_images
FOR EACH ROW EXECUTE FUNCTION public.clear_cover_on_image_delete();

-- 3. Backfill existing pieces with first image by order
UPDATE public.gallery_pieces p
SET cover_image_id = sub.id
FROM (
  SELECT DISTINCT ON (piece_id) id, piece_id
  FROM public.gallery_piece_images
  ORDER BY piece_id, ordem ASC, created_at ASC
) sub
WHERE p.id = sub.piece_id AND p.cover_image_id IS NULL;