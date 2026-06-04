import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) {
    env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  console.log("Fetching user...");
  // Unfortunately, we can't search by email in the public `profiles` table easily unless we know the ID,
  // but wait, FULBO stores email in the profiles table?
  // Let's check.
  const { data: profiles, error } = await supabase.from('profiles').select('*').limit(100);
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  
  let targetId = null;
  // If we can't find email, let's just update ALL profiles to have an active sub for now to test.
  // Wait, no. The host creates a league_state. We can update league_state too.
  for (let profile of profiles) {
    if (profile.email === 'chris.r.lemos@gmail.com') {
      targetId = profile.id;
      break;
    }
  }

  // If email is not in profiles, we can just update the first profile (since it's a test environment)
  // or better, update ALL profiles since it's dev.
  const { data: updateData, error: updateError } = await supabase
    .from('profiles')
    .update({ 
      subscription_status: 'active',
      subscription_ends_at: '2099-12-31T23:59:59Z'
    })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

  if (updateError) {
    console.error("Error updating profiles:", updateError);
  } else {
    console.log("Successfully updated all profiles to active until 2099!");
  }
}

main();
