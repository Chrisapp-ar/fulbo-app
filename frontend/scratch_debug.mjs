import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://okjsexfqbjcncixwwkdy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ranNleGZxYmpjbmNpeHd3a2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzgyODgsImV4cCI6MjA5NTIxNDI4OH0.QuTMAuxvncmoodKwBVgpV9M63HUKqxBG5-8WV3oTtiw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
  console.log("=== LOBBY REGISTRATIONS ===");
  const { data: regs, error: errRegs } = await supabase.from('event_registrations').select('*');
  if (errRegs) {
    console.error("Error reading event_registrations:", errRegs.message);
  } else {
    console.log(`Found ${regs.length} registrations:`);
    regs.forEach(r => {
      console.log(`- ID: ${r.id}, Name: ${r.name}, Role: ${r.role}, Host ID: ${r.host_id}, Player ID: ${r.player_id}`);
    });
  }

  console.log("\n=== LEAGUE STATE ===");
  const { data: state, error: errState } = await supabase.from('league_state').select('*');
  if (errState) {
    console.error("Error reading league_state:", errState.message);
  } else {
    console.log(`Found ${state.length} state rows:`);
    state.forEach(s => {
      console.log(`- Host ID: ${s.host_id}`);
      console.log(`  Active Event:`, JSON.stringify(s.active_event));
    });
  }
}

inspectData();
