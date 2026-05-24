import React, { useState, useEffect } from 'react';
import Dashboard from './views/Dashboard';
import Login from './views/Login';
import CompanionApp from './views/CompanionApp';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setIsAuthenticated(!!session);
      });

      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setIsAuthenticated(!!session);
      });
    }
  }, []);
  
  const urlParams = new URLSearchParams(window.location.search);
  const leagueId = urlParams.get('league');

  if (leagueId) {
    return <CompanionApp leagueId={leagueId} />;
  }

  return (
    <>
      {isAuthenticated ? (
        <Dashboard onLogout={() => {
           if (isSupabaseConfigured && supabase) supabase.auth.signOut();
           else setIsAuthenticated(false);
        }} />
      ) : (
        <Login onLogin={() => setIsAuthenticated(true)} />
      )}
    </>
  );
};

export default App;
