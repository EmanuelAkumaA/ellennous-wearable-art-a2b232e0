-- 1. conversion_logs
create table public.conversion_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null check (source in ('converter','piece_upload')),
  piece_id uuid null,
  filename text not null,
  original_size bigint not null default 0,
  optimized_size bigint not null default 0,
  original_format text null,
  status text not null check (status in ('success','error')),
  error_message text null,
  duration_ms integer not null default 0,
  desktop_path text null,
  created_at timestamptz not null default now()
);

alter table public.conversion_logs enable row level security;

create policy "Admins read conversion_logs"
  on public.conversion_logs for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins insert conversion_logs"
  on public.conversion_logs for insert
  to authenticated
  with check (has_role(auth.uid(), 'admin'::app_role) and user_id = auth.uid());

create index conversion_logs_created_idx on public.conversion_logs (created_at desc);
create index conversion_logs_status_idx  on public.conversion_logs (status);
create index conversion_logs_source_idx  on public.conversion_logs (source);

-- 2. gallery_staging_images
create table public.gallery_staging_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_filename text not null,
  desktop_url text not null,
  desktop_path text not null,
  tablet_path text not null,
  mobile_path text not null,
  sizes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.gallery_staging_images enable row level security;

create policy "Admins read staging"
  on public.gallery_staging_images for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins insert staging"
  on public.gallery_staging_images for insert
  to authenticated
  with check (has_role(auth.uid(), 'admin'::app_role) and user_id = auth.uid());

create policy "Admins update staging"
  on public.gallery_staging_images for update
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins delete staging"
  on public.gallery_staging_images for delete
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create index gallery_staging_created_idx on public.gallery_staging_images (created_at desc);

-- 3. variant_overrides em gallery_piece_images
alter table public.gallery_piece_images
  add column variant_overrides jsonb null;