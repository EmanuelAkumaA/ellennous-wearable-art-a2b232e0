drop policy if exists "Admins update staging" on public.gallery_staging_images;
create policy "Admins update staging"
  on public.gallery_staging_images for update
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));