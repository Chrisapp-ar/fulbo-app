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
  


  const [resolvedLeagueId, setResolvedLeagueId] = useState(null);
  const [isResolvingLeague, setIsResolvingLeague] = useState(true);

  useEffect(() => {
    const fetchProfile = async (lIdToSet) => {
      if (session?.user && isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('player_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (data && data.length > 0) {
            const lastReg = data[0];
            if (!lIdToSet) {
              lIdToSet = lastReg.host_id;
              localStorage.setItem('fulbo_last_league', lIdToSet);
            }
            if (!localStorage.getItem('guestName') && lastReg.name) {
              localStorage.setItem('guestName', lastReg.name);
              if (lastReg.role) localStorage.setItem('guestRole', lastReg.role);
              if (lastReg.stats) localStorage.setItem('guestStats', JSON.stringify(lastReg.stats));
              if (lastReg.avatar) localStorage.setItem('guestAvatar', lastReg.avatar);
            }
          }
        } catch (e) {
          console.error("Error recovering profile", e);
        }
      }
      setResolvedLeagueId(lIdToSet);
      setIsResolvingLeague(false);
    };

    const urlParams = new URLSearchParams(window.location.search);
    let lId = urlParams.get('league');
    
    if (lId && lId !== 'null' && lId !== 'undefined') {
      localStorage.setItem('fulbo_last_league', lId);
      fetchProfile(lId);
    } else {
      lId = localStorage.getItem('fulbo_last_league');
      if (lId && lId !== 'null' && lId !== 'undefined') {
        fetchProfile(lId);
      } else {
        fetchProfile(null);
      }
    }
  }, [session]);

  const leagueId = resolvedLeagueId;



  const handleLogout = () => {
    if (isSupabaseConfigured && supabase) supabase.auth.signOut();
    else {
      setIsAuthenticated(false);
      setSession(null);
    }
  };

  if (loading || isResolvingLeague) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--volt-lime)', fontSize: '1.5rem', background: 'var(--pitch-black)' }}>Cargando FULBO...</div>;
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
      if (localStorage.getItem('userRole') === 'guest') {
        return <CompanionApp leagueId={leagueId} currentUser={null} onLogout={handleLogout} />;
      }
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
