ALTER TABLE public.gallery_pieces
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS cover_storage_path text;