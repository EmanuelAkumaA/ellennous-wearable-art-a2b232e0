
-- Replace public list/select with a more granular policy.
-- Public can read individual objects (needed for <img src> URLs), but
-- only admins can list bucket contents via storage.objects queries.
drop policy if exists "Gallery images public read" on storage.objects;

-- Allow only admins to list/query objects in the gallery bucket directly.
create policy "Admins can list gallery"
on storage.objects for select
to authenticated
using (bucket_id = 'gallery' and public.has_role(auth.uid(), 'admin'));

-- Public read continues to work via the public bucket flag and signed/public URLs.
-- (public buckets serve object bytes via the storage CDN without an RLS check on objects)
