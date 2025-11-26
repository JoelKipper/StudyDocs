-- Migration Script: Add Admin Features
-- This script adds admin functionality to an existing database
-- Run this in Supabase SQL Editor

-- 1. Add admin columns to users table (if not exists)
DO $$ 
BEGIN
  -- Add is_admin column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add is_active column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

  -- Add last_login column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add last_login_ip column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_login_ip'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_ip TEXT;
  END IF;
END $$;

-- 2. Create indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- 3. Create blocked_ips table (if not exists)
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES users(id),
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_active ON blocked_ips(is_active);

-- Enable RLS on blocked_ips
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Create policy (drop if exists first, then create)
DROP POLICY IF EXISTS "Allow all operations on blocked_ips" ON blocked_ips;
CREATE POLICY "Allow all operations on blocked_ips" ON blocked_ips
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Create activity_logs table (if not exists)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_ip_address ON activity_logs(ip_address);

-- Enable RLS on activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all operations on activity_logs" ON activity_logs;
CREATE POLICY "Allow all operations on activity_logs" ON activity_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Create system_settings table (if not exists)
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON system_settings;
CREATE POLICY "Allow all operations on system_settings" ON system_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Insert default system settings (only if they don't exist)
INSERT INTO system_settings (key, value, description) VALUES
  ('max_file_size', '104857600', 'Maximum file size in bytes (default: 100MB)'),
  ('max_storage_per_user', '10737418240', 'Maximum storage per user in bytes (default: 10GB)'),
  ('allow_registration', 'true', 'Allow new user registration'),
  ('allow_login', 'true', 'Allow user login'),
  ('maintenance_mode', 'false', 'Enable maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- 7. Set all existing users to active (if is_active is NULL)
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;

-- 8. Set all existing users to non-admin (if is_admin is NULL)
UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'All existing users are set to active and non-admin by default.';
  RAISE NOTICE 'To make a user admin, run: UPDATE users SET is_admin = true WHERE email = ''your-email@example.com'';';
END $$;

