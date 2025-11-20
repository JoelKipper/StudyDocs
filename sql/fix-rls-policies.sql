-- Fix RLS Policies für file_metadata und shares Tabellen
-- Führe dieses SQL im Supabase SQL Editor aus

-- Lösche bestehende Policies für file_metadata (falls vorhanden)
DROP POLICY IF EXISTS "Authenticated users can read file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Authenticated users can insert file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Authenticated users can update file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Authenticated users can delete file metadata" ON file_metadata;

-- Erstelle neue Policies die auch für Service Role Key funktionieren
-- Diese Policies erlauben alle Operationen für alle Benutzer (inkl. Service Role)
CREATE POLICY "Allow all operations on file_metadata" ON file_metadata
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Lösche bestehende Policies für shares (falls vorhanden)
DROP POLICY IF EXISTS "Authenticated users can read shares" ON shares;
DROP POLICY IF EXISTS "Authenticated users can insert shares" ON shares;
DROP POLICY IF EXISTS "Authenticated users can delete shares" ON shares;

-- Erstelle neue Policies für shares
CREATE POLICY "Allow all operations on shares" ON shares
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Prüfe ob Policies erstellt wurden
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('file_metadata', 'shares')
ORDER BY tablename, policyname;

