-- Table
create table public.optimized_images (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  original_path text not null,
  original_size_bytes integer not null,
  original_width integer,
  original_height integer,
  status text not null default 'processing',
  error_message text,
  variants jsonb not null default '[]'::jsonb,
  total_optimized_bytes integer,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.optimized_images enable row level security;

create policy "Optimized images are viewable by everyone"
  on public.optimized_images for select
  using (true);

create policy "Admins insert optimized images"
  on public.optimized_images for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins update optimized images"
  on public.optimized_images for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins delete optimized images"
  on public.optimized_images for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger optimized_images_set_updated_at
  before update on public.optimized_images
  for each row execute function public.set_updated_at();

create index optimized_images_created_at_idx on public.optimized_images (created_at desc);
create index optimized_images_used_count_idx on public.optimized_images (used_count desc);
create index optimized_images_status_idx on public.optimized_images (status);

-- Realtime
alter publication supabase_realtime add table public.optimized_images;
alter table public.optimized_images replica identity full;

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('optimized-images', 'optimized-images', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Optimized images bucket public read"
  on storage.objects for select
  using (bucket_id = 'optimized-images');

create policy "Admins upload to optimized images bucket"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'optimized-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins update optimized images bucket"
  on storage.objects for update to authenticated
  using (bucket_id = 'optimized-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins delete from optimized images bucket"
  on storage.objects for delete to authenticated
  using (bucket_id = 'optimized-images' and public.has_role(auth.uid(), 'admin'));