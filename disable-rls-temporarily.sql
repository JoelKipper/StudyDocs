-- TEMPORÄR RLS deaktivieren (NUR FÜR ENTWICKLUNG!)
-- Führe dieses SQL im Supabase SQL Editor aus
-- WARNUNG: Reaktiviere RLS später wieder für Produktion!

-- Lösche alle bestehenden Policies
DROP POLICY IF EXISTS "Allow all operations on file_metadata" ON file_metadata;
DROP POLICY IF EXISTS "Authenticated users can read file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Authenticated users can insert file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Authenticated users can update file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Authenticated users can delete file metadata" ON file_metadata;

DROP POLICY IF EXISTS "Allow all operations on shares" ON shares;
DROP POLICY IF EXISTS "Authenticated users can read shares" ON shares;
DROP POLICY IF EXISTS "Authenticated users can insert shares" ON shares;
DROP POLICY IF EXISTS "Authenticated users can delete shares" ON shares;

-- Deaktiviere RLS temporär (NUR FÜR ENTWICKLUNG!)
ALTER TABLE file_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE shares DISABLE ROW LEVEL SECURITY;

-- Prüfe Status
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('file_metadata', 'shares')
ORDER BY tablename;

