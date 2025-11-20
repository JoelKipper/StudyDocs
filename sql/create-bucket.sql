-- Erstelle Storage Bucket "files" falls er nicht existiert
-- Führe dieses SQL im Supabase SQL Editor aus

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('files', 'files', true, NULL, NULL)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = COALESCE(EXCLUDED.file_size_limit, storage.buckets.file_size_limit),
  allowed_mime_types = COALESCE(EXCLUDED.allowed_mime_types, storage.buckets.allowed_mime_types);

-- Prüfe ob Bucket erstellt wurde
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id = 'files';

