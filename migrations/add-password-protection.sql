-- Migration: Add password protection to file_metadata table
-- Run this in your Supabase SQL Editor

-- Add password_hash column to file_metadata table
ALTER TABLE file_metadata 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add index for faster lookups of password-protected items
CREATE INDEX IF NOT EXISTS idx_file_metadata_password_hash 
ON file_metadata(password_hash) 
WHERE password_hash IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN file_metadata.password_hash IS 'bcrypt hash of the password protecting this file/directory. NULL if not password protected.';

