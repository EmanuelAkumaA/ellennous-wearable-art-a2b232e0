
-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can view their own roles"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can view all roles"
on public.user_roles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Bootstrap: first user becomes admin
create or replace function public.handle_new_user_admin_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_bootstrap_admin
after insert on auth.users
for each row execute function public.handle_new_user_admin_bootstrap();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Categories
create table public.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gallery_categories enable row level security;

create policy "Categories are viewable by everyone"
on public.gallery_categories for select
using (true);

create policy "Admins manage categories insert"
on public.gallery_categories for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage categories update"
on public.gallery_categories for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage categories delete"
on public.gallery_categories for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create trigger gallery_categories_updated_at
before update on public.gallery_categories
for each row execute function public.set_updated_at();

-- Pieces
create table public.gallery_pieces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid not null references public.gallery_categories(id) on delete restrict,
  descricao text not null default '',
  conceito text not null default '',
  historia text not null default '',
  tempo text not null default '',
  destaque boolean not null default false,
  novo boolean not null default false,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gallery_pieces enable row level security;

create policy "Pieces are viewable by everyone"
on public.gallery_pieces for select
using (true);

create policy "Admins insert pieces"
on public.gallery_pieces for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins update pieces"
on public.gallery_pieces for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins delete pieces"
on public.gallery_pieces for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create trigger gallery_pieces_updated_at
before update on public.gallery_pieces
for each row execute function public.set_updated_at();

-- Images
create table public.gallery_piece_images (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.gallery_pieces(id) on delete cascade,
  url text not null,
  storage_path text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gallery_piece_images enable row level security;

create policy "Piece images are viewable by everyone"
on public.gallery_piece_images for select
using (true);

create policy "Admins insert images"
on public.gallery_piece_images for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins update images"
on public.gallery_piece_images for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins delete images"
on public.gallery_piece_images for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy "Gallery images public read"
on storage.objects for select
using (bucket_id = 'gallery');

create policy "Admins upload gallery"
on storage.objects for insert
to authenticated
with check (bucket_id = 'gallery' and public.has_role(auth.uid(), 'admin'));

create policy "Admins update gallery"
on storage.objects for update
to authenticated
using (bucket_id = 'gallery' and public.has_role(auth.uid(), 'admin'));

create policy "Admins delete gallery"
on storage.objects for delete
to authenticated
using (bucket_id = 'gallery' and public.has_role(auth.uid(), 'admin'));

-- Seed categories
insert into public.gallery_categories (nome, ordem) values
  ('Anime / Geek', 1),
  ('Realismo', 2),
  ('Floral', 3),
  ('ScarType', 4),
  ('Exclusivas', 5);
