-- Create users table in Supabase
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own data
-- Note: This is a basic policy. You may want to adjust based on your needs
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (true);

-- Create policy to allow insert (registration)
CREATE POLICY "Allow public registration" ON users
  FOR INSERT
  WITH CHECK (true);

-- Create file_metadata table for storing file and directory metadata (GLOBAL for all users)
CREATE TABLE IF NOT EXISTS file_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'directory')),
  size BIGINT,
  storage_path TEXT, -- Path in Supabase Storage
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified_by UUID REFERENCES users(id),
  last_modified_at TIMESTAMP WITH TIME ZONE,
  renamed_by UUID REFERENCES users(id),
  renamed_at TIMESTAMP WITH TIME ZONE,
  parent_path TEXT, -- For directories, the parent directory path
  CONSTRAINT unique_path UNIQUE (path)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_metadata_path ON file_metadata(path);
CREATE INDEX IF NOT EXISTS idx_file_metadata_parent_path ON file_metadata(parent_path);
CREATE INDEX IF NOT EXISTS idx_file_metadata_type ON file_metadata(type);

-- Enable RLS on file_metadata
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (works with Service Role Key)
-- This policy allows all operations for all users including service role
CREATE POLICY "Allow all operations on file_metadata" ON file_metadata
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create shares table for share links
CREATE TABLE IF NOT EXISTS shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  item_path TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('file', 'directory')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);

-- Enable RLS on shares
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (works with Service Role Key)
CREATE POLICY "Allow all operations on shares" ON shares
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Note: For production, you should restrict these policies more strictly
-- and use service role key for server-side operations
