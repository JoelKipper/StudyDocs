-- Create rate_limit_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP address or user ID
  action TEXT NOT NULL, -- 'login', 'register', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_action ON rate_limit_attempts(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at ON rate_limit_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_action ON rate_limit_attempts(action);

-- Enable RLS on rate_limit_attempts
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (works with Service Role Key)
DROP POLICY IF EXISTS "Allow all operations on rate_limit_attempts" ON rate_limit_attempts;
CREATE POLICY "Allow all operations on rate_limit_attempts" ON rate_limit_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

