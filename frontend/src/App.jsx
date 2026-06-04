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
    // FORCE LOGOUT TEMPORARY FIX FOR USER
    if (!localStorage.getItem('hasForcedLogoutV2')) {
      if (isSupabaseConfigured && supabase) {
        supabase.auth.signOut();
      }
      localStorage.setItem('hasForcedLogoutV2', 'true');
      setIsAuthenticated(false);
      setSession(null);
      setLoading(false);
      return;
    }

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
        return <Dashboard userId={session?.user?.id} userEmail={session?.user?.email} onLogout={handleLogout} />;
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
        localStorage.getItem('userRole') === 'guest' ? (
          <CompanionApp leagueId={null} currentUser={session?.user} onLogout={handleLogout} />
        ) : (
          <Dashboard 
            userId={session?.user?.id}
            userEmail={session?.user?.email}
            onLogout={handleLogout}
          />
        )
      ) : (
        <Login onLogin={() => setIsAuthenticated(true)} />
      )}
    </>
  );
};

export default App;
