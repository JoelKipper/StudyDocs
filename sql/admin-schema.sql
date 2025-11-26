-- Add admin role to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;

-- Create index on is_admin for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Create blocked_ips table for IP blocking
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES users(id),
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = permanent block
  is_active BOOLEAN DEFAULT TRUE
);

-- Create index on ip_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_active ON blocked_ips(is_active);

-- Enable RLS on blocked_ips
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (works with Service Role Key)
DROP POLICY IF EXISTS "Allow all operations on blocked_ips" ON blocked_ips;
CREATE POLICY "Allow all operations on blocked_ips" ON blocked_ips
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create activity_logs table for tracking user activities
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL, -- 'login', 'logout', 'upload', 'delete', 'download', etc.
  resource_type TEXT, -- 'file', 'directory', 'user', etc.
  resource_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB, -- Additional details as JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_ip_address ON activity_logs(ip_address);

-- Enable RLS on activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (works with Service Role Key)
DROP POLICY IF EXISTS "Allow all operations on activity_logs" ON activity_logs;
CREATE POLICY "Allow all operations on activity_logs" ON activity_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create system_settings table for admin settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (works with Service Role Key)
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON system_settings;
CREATE POLICY "Allow all operations on system_settings" ON system_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
  ('max_file_size', '104857600', 'Maximum file size in bytes (default: 100MB)'),
  ('max_storage_per_user', '10737418240', 'Maximum storage per user in bytes (default: 10GB)'),
  ('allow_registration', 'true', 'Allow new user registration'),
  ('allow_login', 'true', 'Allow user login'),
  ('maintenance_mode', 'false', 'Enable maintenance mode')
ON CONFLICT (key) DO NOTHING;


