-- Allow anonymous uploads to the reviews bucket under the "public/" prefix
CREATE POLICY "Anyone can upload review photos to public folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'reviews'
  AND (storage.foldername(name))[1] = 'public'
);