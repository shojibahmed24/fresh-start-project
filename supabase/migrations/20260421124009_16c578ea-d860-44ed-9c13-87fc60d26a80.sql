-- Make avatars bucket private to prevent listing
UPDATE storage.buckets SET public = false WHERE id = 'avatars';