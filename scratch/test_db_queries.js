import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://okjsexfqbjcncixwwkdy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ranNleGZxYmpjbmNpeHd3a2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzgyODgsImV4cCI6MjA5NTIxNDI4OH0.QuTMAuxvncmoodKwBVgpV9M63HUKqxBG5-8WV3oTtiw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  console.log("--- INICIANDO DIAGNÓSTICO AUTENTICADO ---");

  // 1. Intentar iniciar sesión
  const email = 'chris.r.lemos@gmail.com';
  const password = 'Dhl12345';
  console.log(`Intentando iniciar sesión como: ${email}...`);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Error al iniciar sesión:", authError.message);
    console.log("Intentaremos crear el usuario si no existe...");
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });
    if (signUpError) {
      console.error("No se pudo registrar tampoco:", signUpError.message);
      return;
    }
    console.log("Usuario registrado con éxito:", signUpData.user?.id);
    return;
  }

  const user = authData.user;
  console.log("Sesión iniciada con éxito. User ID:", user.id);

  // 2. Consultar hosts como autenticado
  console.log("\n2. Consultando hosts como usuario autenticado...");
  const { data: hosts, error: hostsError } = await supabase
    .from('hosts')
    .select('*')
    .eq('id', user.id);
  
  if (hostsError) {
    console.error("Error al consultar hosts:", hostsError.message);
  } else {
    console.log(`Resultado de hosts (${hosts.length} filas):`, hosts);
  }

  // 3. Consultar league_state como autenticado
  console.log("\n3. Consultando league_state como usuario autenticado...");
  const { data: leagues, error: leaguesError } = await supabase
    .from('league_state')
    .select('*')
    .eq('host_id', user.id);
  
  if (leaguesError) {
    console.error("Error al consultar league_state:", leaguesError.message);
  } else {
    console.log(`Resultado de league_state (${leagues.length} filas):`, leagues);
  }

  // 4. Intentar auto-sanación desde el script para ver el error exacto si falla
  if (hosts.length === 0) {
    console.log("\n4. Fila en hosts ausente. Intentando insertar...");
    const defaultEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: insertHostData, error: insertHostError } = await supabase.from('hosts').insert({
      id: user.id,
      email: user.email,
      subscription_type: 'trial',
      subscription_status: 'active',
      subscription_ends_at: defaultEndsAt
    }).select();

    if (insertHostError) {
      console.error("FALLÓ EL INSERT EN hosts:", insertHostError.message, insertHostError);
    } else {
      console.log("ÉXITO: Se insertó la fila en hosts:", insertHostData);
    }
  }

  if (leagues.length === 0) {
    console.log("\n5. Fila en league_state ausente. Intentando insertar...");
    const { data: insertStateData, error: insertStateError } = await supabase.from('league_state').insert({
      host_id: user.id,
      roster: [],
      match_history: [],
      active_event: null,
      updated_at: new Date().toISOString()
    }).select();

    if (insertStateError) {
      console.error("FALLÓ EL INSERT EN league_state:", insertStateError.message, insertStateError);
    } else {
      console.log("ÉXITO: Se insertó la fila en league_state:", insertStateData);
    }
  }
}

runDiagnostics();
