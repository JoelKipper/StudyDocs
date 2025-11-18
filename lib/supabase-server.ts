import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL. Please check your .env.local file.');
}

if (!supabaseServiceKey) {
  throw new Error(
    'Missing Supabase Service Role Key. ' +
    'Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file. ' +
    'Get it from Supabase Dashboard > Settings > API > service_role key. ' +
    'See SERVICE_ROLE_KEY_SETUP.md for instructions.'
  );
}

// Create Supabase client for server-side operations with service role key
// This bypasses RLS (Row Level Security) and is safe for server-side use
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

