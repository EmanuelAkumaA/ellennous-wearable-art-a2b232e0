-- Tabela de perfil do admin
create table public.admin_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_storage_path text,
  updated_at timestamptz not null default now()
);

alter table public.admin_profile enable row level security;

-- Admins podem ler qualquer perfil (necessário para sidebar)
create policy "admins read admin_profile"
on public.admin_profile
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Apenas o dono insere/atualiza/deleta o próprio perfil
create policy "owner inserts own admin_profile"
on public.admin_profile
for insert
to authenticated
with check (user_id = auth.uid());

create policy "owner updates own admin_profile"
on public.admin_profile
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "owner deletes own admin_profile"
on public.admin_profile
for delete
to authenticated
using (user_id = auth.uid());

-- Trigger updated_at
create trigger set_admin_profile_updated_at
before update on public.admin_profile
for each row execute function public.set_updated_at();

-- Storage policies para admin-avatars dentro do bucket gallery
create policy "Admin avatars are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'gallery' and (storage.foldername(name))[1] = 'admin-avatars');

create policy "Admins upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gallery'
  and (storage.foldername(name))[1] = 'admin-avatars'
  and public.has_role(auth.uid(), 'admin')
);

create policy "Admins update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'gallery'
  and (storage.foldername(name))[1] = 'admin-avatars'
  and public.has_role(auth.uid(), 'admin')
);

create policy "Admins delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gallery'
  and (storage.foldername(name))[1] = 'admin-avatars'
  and public.has_role(auth.uid(), 'admin')
);