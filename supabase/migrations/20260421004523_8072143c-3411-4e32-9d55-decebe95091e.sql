-- Add piece linkage columns to optimized_images
alter table public.optimized_images
  add column if not exists piece_id uuid,
  add column if not exists image_role text;

create index if not exists idx_optimized_images_piece_id
  on public.optimized_images(piece_id);

-- When a gallery_pieces row is deleted, clear piece_id on optimized_images
-- so the history record survives but is shown as "inactive".
create or replace function public.clear_optimized_piece_link_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.optimized_images
  set piece_id = null
  where piece_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_clear_optimized_piece_link on public.gallery_pieces;
create trigger trg_clear_optimized_piece_link
  before delete on public.gallery_pieces
  for each row
  execute function public.clear_optimized_piece_link_on_delete();