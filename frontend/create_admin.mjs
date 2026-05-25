import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://okjsexfqbjcncixwwkdy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ranNleGZxYmpjbmNpeHd3a2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzgyODgsImV4cCI6MjA5NTIxNDI4OH0.QuTMAuxvncmoodKwBVgpV9M63HUKqxBG5-8WV3oTtiw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const { data, error } = await supabase.auth.signUp({
    email: 'chris.r.lemos@gmail.com',
    password: 'Dhl12345',
  });
  if (error) {
    console.error('Error creating user:', error.message);
  } else {
    console.log('Admin user created successfully:', data.user?.id);
  }
}

createAdmin();
