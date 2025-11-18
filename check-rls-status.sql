-- Prüfe RLS Status und Policies
-- Führe dieses SQL im Supabase SQL Editor aus

-- Prüfe ob RLS aktiviert ist
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('file_metadata', 'shares', 'users')
ORDER BY tablename;

-- Prüfe alle Policies für file_metadata
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'file_metadata'
ORDER BY policyname;

-- Prüfe alle Policies für shares
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'shares'
ORDER BY policyname;

-- Prüfe ob es doppelte Policies gibt
SELECT 
  tablename,
  policyname,
  COUNT(*) as count
FROM pg_policies
WHERE tablename IN ('file_metadata', 'shares')
GROUP BY tablename, policyname
HAVING COUNT(*) > 1;

