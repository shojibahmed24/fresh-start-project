UPDATE storage.buckets SET public = true WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Avatars readable by direct path" ON storage.objects;
DROP POLICY IF EXISTS "Avatars readable when path provided" ON storage.objects;

CREATE POLICY "Avatars readable when path provided"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] IS NOT NULL
);