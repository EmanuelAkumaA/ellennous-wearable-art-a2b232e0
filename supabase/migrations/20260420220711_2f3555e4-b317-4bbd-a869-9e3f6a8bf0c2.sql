ALTER TABLE public.gallery_pieces
  ADD COLUMN IF NOT EXISTS cover_fit text NOT NULL DEFAULT 'contain',
  ADD COLUMN IF NOT EXISTS cover_position text NOT NULL DEFAULT '50% 50%';