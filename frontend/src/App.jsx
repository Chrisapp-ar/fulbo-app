import React, { useState, useEffect } from 'react';
import Dashboard from './views/Dashboard';
import Login from './views/Login';
import CompanionApp from './views/CompanionApp';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setIsAuthenticated(!!session);
        setLoading(false);
      });

      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setIsAuthenticated(!!session);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);
  
  const urlParams = new URLSearchParams(window.location.search);
  const leagueId = urlParams.get('league');

  const handleLogout = () => {
    if (isSupabaseConfigured && supabase) supabase.auth.signOut();
    else {
      setIsAuthenticated(false);
      setSession(null);
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--volt-lime)', fontSize: '1.5rem', background: 'var(--pitch-black)' }}>Cargando FULBO...</div>;
  }

  // Si hay un enlace de invitación
  if (leagueId) {
    if (isAuthenticated) {
      const isHost = session?.user?.id === leagueId;
      if (isHost) {
        return <Dashboard userId={session?.user?.id} onLogout={handleLogout} />;
      } else {
        return <CompanionApp leagueId={leagueId} currentUser={session?.user} onLogout={handleLogout} />;
      }
    } else {
      return <Login isGuest={true} onLogin={() => setIsAuthenticated(true)} />;
    }
  }

  return (
    <>
      {isAuthenticated ? (
        <Dashboard 
          userId={session?.user?.id}
          onLogout={handleLogout}
        />
      ) : (
        <Login onLogin={() => setIsAuthenticated(true)} />
      )}
    </>
  );
};

export default App;
