import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'DUMMY_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'DUMMY_KEY';

let isConfigured = supabaseUrl !== 'DUMMY_URL' && supabaseKey !== 'DUMMY_KEY';
let client = null;

if (isConfigured) {
  try {
    const cleanUrl = supabaseUrl.trim().replace(/^["']|["']$/g, '');
    const cleanKey = supabaseKey.trim().replace(/^["']|["']$/g, '');
    client = createClient(cleanUrl, cleanKey);
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    isConfigured = false;
    client = null;
  }
}

export const isSupabaseConfigured = isConfigured;
export const supabase = client;

