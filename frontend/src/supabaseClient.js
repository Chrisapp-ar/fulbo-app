import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'DUMMY_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'DUMMY_KEY';

// Check if valid credentials are provided
export const isSupabaseConfigured = supabaseUrl !== 'DUMMY_URL' && supabaseKey !== 'DUMMY_KEY';

// Only instantiate the client if we have real keys to prevent app crashes
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
