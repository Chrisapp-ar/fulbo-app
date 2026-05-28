import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import PlayerCard from '../components/PlayerCard';
import EloChart from '../components/EloChart';

const getPlayerBadges = (p) => {
  const list = [];
  const pj = p.history?.pj || 0;
  const pg = p.history?.pg || 0;
  const goals = p.history?.goals || 0;
  
  if (pj >= 2 && (p.condition?.stamina ?? 100) > 60) {
    list.push('ironman');
  }
  if (goals >= 5) {
    list.push('goleador');
  }
  const roleLower = p.role?.toLowerCase() || '';
  if ((roleLower.includes('def') || roleLower.includes('arq') || roleLower.includes('anc') || roleLower.includes('portero')) && pg >= 3) {
    list.push('guardian');
  }
  if (pj > 0 && (!p.financial?.debt || p.financial.debt === 0)) {
    list.push('fairplay');
  }
  if (p.history?.mvpCount && p.history.mvpCount > 0) {
    list.push('mvp');
  }
  return list;
};

const CompanionApp = ({ leagueId, currentUser, onLogout }) => {
  const [roster, setRoster] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  // Tabs navigation
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'history'
  
  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState('');
  const [subscriptionChecking, setSubscriptionChecking] = useState(true);
  
  const [activeEvent, setActiveEvent] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState(currentUser?.user_metadata?.full_name || '');
  const [regRole, setRegRole] = useState('Mediocampo');
  const [regStats, setRegStats] = useState({ pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });
  const [regSuccess, setRegSuccess] = useState(false);
  const [leagueExists, setLeagueExists] = useState(false);
  const [regAvatar, setRegAvatar] = useState('👤');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState(false);

  useEffect(() => {
    if (currentUser?.user_metadata?.full_name && !regName) {
      setRegName(currentUser.user_metadata.full_name);
    }
  }, [currentUser]);
  
  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim()) return;
    
    if (isSupabaseConfigured && supabase) {
      // 1. Fetch current registrations for this league event
      const { data: currentRegs, error: fetchRegsError } = await supabase
        .from('event_registrations')
        .select('name')
        .eq('host_id', leagueId);

      if (fetchRegsError) {
        console.error("Error checking registrations count:", fetchRegsError);
      }

      // 2. Clean duplicates by name to be consistent with how the Admin Dashboard counts them
      const uniqueNames = new Set((currentRegs || []).map(r => r.name.toLowerCase().trim()));
      
      const currentNameClean = regName.toLowerCase().trim();
      if (uniqueNames.size >= 15 && !uniqueNames.has(currentNameClean)) {
        alert("Límite de invitación alcanzado. No hay más vacantes para este partido (Máximo 15 invitados por cuenta).");
        return;
      }

      // 3. Proceed with registration
      const { error } = await supabase.from('event_registrations').insert({
        host_id: leagueId,
        player_id: currentUser?.id || null,
        name: regName.trim(),
        role: regRole,
        stats: regStats,
        avatar: regAvatar
      });
      if (error) {
        alert("Error al inscribirse: " + error.message);
      } else {
        setRegSuccess(true);
        setIsRegistering(false);
      }
    }
  };

  const handlePayMP = async (playerId, amount) => {
    try {
      const response = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: leagueId,
          playerId: playerId,
          amount: amount,
          title: `Cuota Cancha FULBO - ${selectedPlayer?.name || 'Jugador'}`,
          redirectUrl: window.location.href
        })
      });
      const data = await response.json();
      if (response.ok && data.initPoint) {
        window.open(data.initPoint, '_blank');
      } else {
        alert("Error al crear preferencia de Mercado Pago: " + (data.error || "Inténtalo más tarde. Asegúrate de configurar Mercado Pago."));
      }
    } catch (e) {
      console.error(e);
      alert("Error al conectar con la pasarela de pagos.");
    }
  };

  // Detectar redirección de pago exitoso
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('status') || params.get('collection_status');
    if (paymentStatus === 'approved') {
      setPaymentSuccessMsg(true);
      // Limpiar parámetros de la URL
      const newUrl = window.location.pathname + `?league=${leagueId}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [leagueId]);

  const processLeagueData = (data) => {
    if (data) {
      setLeagueExists(true);
      const matches = data.match_history || [];
      setMatchHistory(matches);
      if (Array.isArray(data.roster)) {
        const migratedRoster = data.roster.map(p => {
          if (!p.history) return p;
          if (p.history.pe !== undefined && p.history.pp !== undefined) return p;
          
          let pe = 0;
          let pp = 0;
          matches.forEach(match => {
            const inA = match.teamA?.some(m => m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase()));
            const inB = match.teamB?.some(m => m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase()));
            if (inA || inB) {
              if (match.winner === 'Draw') {
                pe++;
              } else if ((inA && match.winner === 'A') || (inB && match.winner === 'B')) {
                // Win
              } else {
                pp++;
              }
            }
          });
          
          const pj = p.history.pj || 0;
          const pg = p.history.pg || 0;
          const diff = pj - pg;
          if (pe + pp !== diff) {
            if (pe > diff) {
              pe = diff;
              pp = 0;
            } else {
              pp = diff - pe;
            }
          }
          
          return {
            ...p,
            history: { ...p.history, pe, pp }
          };
        });
        const sorted = [...migratedRoster].sort((a, b) => (b.glicko?.rating || 1500) - (a.glicko?.rating || 1500));
        setRoster(sorted);
      } else {
        setRoster([]);
      }
      if (data.active_event) {
        setActiveEvent(data.active_event);
      } else {
        setActiveEvent(null);
      }
    } else {
      setLeagueExists(false);
    }
  };

  useEffect(() => {
    const isInvalidId = !leagueId || leagueId === 'null' || leagueId === 'undefined';
    if (isSupabaseConfigured && supabase && !isInvalidId) {
      const fetchLeague = async () => {
        try {
          // Fetch host's subscription details
          const { data: hostData, error: hostError } = await supabase
            .from('hosts')
            .select('subscription_status, subscription_ends_at')
            .eq('id', leagueId);
          
          if (hostError) {
            console.error("Error fetching host subscription from Supabase:", hostError);
          }

          if (hostData && hostData.length > 0) {
            setSubscriptionStatus(hostData[0].subscription_status || 'active');
            setSubscriptionEndsAt(hostData[0].subscription_ends_at || '');
          }
          setSubscriptionChecking(false);

          const { data, error: stateError } = await supabase
            .from('league_state')
            .select('*')
            .eq('host_id', leagueId);

          if (stateError) {
            console.error("Error fetching league state from Supabase:", stateError);
          }

          if (data && data.length > 0) {
            processLeagueData(data[0]);
          } else {
            processLeagueData(null);
          }
        } catch (err) {
          console.error("Exception fetching league state:", err);
          processLeagueData(null);
          setSubscriptionChecking(false);
        }
        setLoading(false);
      };
      
      fetchLeague();

      // Suscribirse a cambios en tiempo real en league_state sin filtro UUID
      const channel = supabase
        .channel(`league_state_${leagueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'league_state'
          },
          (payload) => {
            if (payload.new && payload.new.host_id === leagueId) {
              processLeagueData(payload.new);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      processLeagueData(null);
      setSubscriptionChecking(false);
      setLoading(false);
    }
  }, [leagueId]);

  const isSubscriptionExpired = () => {
    if (subscriptionChecking) return false;
    if (subscriptionStatus !== 'active') return true;
    if (subscriptionEndsAt && new Date(subscriptionEndsAt) < new Date()) return true;
    return false;
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--volt-lime)', fontSize: '1.5rem', background: 'var(--pitch-black)' }}>Cargando Liga...</div>;
  }

  if (!subscriptionChecking && isSubscriptionExpired()) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'var(--pitch-black)', padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-secondary)' }}>
        <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '3rem 2rem', borderTop: '2px solid var(--crimson-red)', boxShadow: '0 0 20px rgba(255,0,85,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--crimson-red)', marginBottom: '1rem' }}>LIGA TEMPORALMENTE INACTIVA</h2>
          <p style={{ color: 'var(--off-white)', lineHeight: '1.6' }}>
            La suscripción o período de prueba del organizador de esta liga ha expirado. Por favor, ponte en contacto con el administrador del club para que renueve su plan.
          </p>
        </div>
      </div>
    );
  }

  if (!leagueExists) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'var(--pitch-black)', padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-secondary)' }}>No se pudo encontrar la liga. Verifica que el enlace sea correcto.</div>;
  }

  if (selectedPlayer) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'var(--pitch-black)', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        padding: '2rem 1rem', 
        overflowY: 'auto', 
        animation: 'fadeIn 0.3s' 
      }}>
        <button 
          onClick={() => setSelectedPlayer(null)} 
          style={{ 
            background: 'transparent', 
            border: '1px solid var(--electric-cyan)', 
            color: 'var(--electric-cyan)', 
            padding: '0.8rem 2rem', 
            borderRadius: '30px', 
            marginBottom: '2rem', 
            cursor: 'pointer', 
            fontFamily: 'var(--font-primary)' 
          }}
        >
          ⬅ VOLVER AL LEADERBOARD
        </button>
        
        <div style={{ 
          width: '100%', 
          maxWidth: '450px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '2.5rem' 
        }}>
          <div style={{ transform: 'scale(1.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PlayerCard 
               name={selectedPlayer.name} 
               position={selectedPlayer.role.substring(0,3).toUpperCase()} 
               stats={selectedPlayer.stats} 
               avatar={selectedPlayer.avatar} 
               ovr={Math.round(Math.round((selectedPlayer.stats.pac + selectedPlayer.stats.sho + selectedPlayer.stats.pas + selectedPlayer.stats.dri + selectedPlayer.stats.def + selectedPlayer.stats.phy) / 6) * (0.5 + 0.5 * ((selectedPlayer.condition?.stamina ?? 100) / 100)))} 
               stamina={selectedPlayer.condition?.stamina ?? 100} 
               badges={getPlayerBadges(selectedPlayer)}
            />
          </div>

          <div style={{ width: '100%' }}>
            <EloChart history={selectedPlayer.glicko?.history || [1500, selectedPlayer.glicko?.rating || 1500]} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--off-white)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Rango Competitivo</div>
              <div className="glow-text-volt" style={{ fontSize: '1.2rem', fontWeight: '900', marginTop: '0.2rem' }}>{Math.round(selectedPlayer.glicko?.rating || 1500)} MMR</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--off-white)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Rendimiento (Win Rate)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '900', marginTop: '0.2rem', color: 'var(--electric-cyan)' }}>
                {selectedPlayer.history?.pj > 0 ? Math.round(((selectedPlayer.history?.pg || 0) / selectedPlayer.history.pj) * 100) : 0}%
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.8rem', width: '100%' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--off-white)', fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PJ</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', marginTop: '0.2rem', color: 'white' }}>{selectedPlayer.history?.pj || 0}</div>
            </div>
            <div style={{ background: 'rgba(204,255,0,0.02)', border: '1px solid rgba(204,255,0,0.1)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--volt-lime)', fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PG</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', marginTop: '0.2rem', color: 'var(--volt-lime)' }}>{selectedPlayer.history?.pg || 0}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--off-white)', fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', marginTop: '0.2rem', color: 'white' }}>{selectedPlayer.history?.pe || 0}</div>
            </div>
            <div style={{ background: 'rgba(255,59,48,0.02)', border: '1px solid rgba(255,59,48,0.1)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--crimson-red)', fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PP</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', marginTop: '0.2rem', color: 'var(--crimson-red)' }}>{selectedPlayer.history?.pp || 0}</div>
            </div>
          </div>

          {selectedPlayer.financial?.debt > 0 && (
            <div style={{
              width: '100%',
              background: 'rgba(255,215,0,0.05)',
              border: '1px solid rgba(255,215,0,0.2)',
              padding: '1.2rem',
              borderRadius: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
              alignItems: 'center',
              marginTop: '0.5rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--ultimate-gold)', fontWeight: 'bold', letterSpacing: '1px' }}>
                ⚠️ TIENES UNA DEUDA PENDIENTE: ${selectedPlayer.financial.debt.toFixed(2)}
              </div>
              <button 
                onClick={() => handlePayMP(selectedPlayer.id, selectedPlayer.financial.debt)} 
                className="btn-primary" 
                style={{
                  background: '#009EE3',
                  borderColor: '#009EE3',
                  color: 'white',
                  fontSize: '0.95rem',
                  padding: '0.8rem 2rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  justifyContent: 'center',
                  width: '100%',
                  boxShadow: '0 0 15px rgba(0,158,227,0.3)'
                }}
              >
                💳 Pagar con Mercado Pago
              </button>
            </div>
          )}

          <p style={{ color: 'var(--off-white)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>Comparte tu Ficha Táctica 📸</p>
        </div>
      </div>
    );
  }

  const isEventExpired = (event) => {
    if (!event) return true;
    const eventDateObj = new Date(event.date + 'T23:59:59');
    const dayAfterEvent = new Date(eventDateObj.getTime() + 24 * 60 * 60 * 1000);
    return new Date() > dayAfterEvent;
  };

  const myPlayerCard = roster.find(p => p && (p.id === currentUser?.id || p.player_id === currentUser?.id));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pitch-black)', padding: '2rem 1rem', fontFamily: 'var(--font-secondary)' }}>
      {/* Cerrar Sesión */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
        <button 
          onClick={onLogout} 
          style={{ 
            background: 'transparent', 
            border: '1px solid var(--crimson-red)', 
            color: 'var(--crimson-red)', 
            padding: '0.4rem 1.2rem', 
            borderRadius: '4px', 
            cursor: 'pointer', 
            fontSize: '0.8rem',
            fontFamily: 'var(--font-primary)',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.target.style.background = 'var(--crimson-red)'; e.target.style.color = 'white'; }}
          onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--crimson-red)'; }}
        >
          CERRAR SESIÓN
        </button>
      </div>

      {paymentSuccessMsg && (
        <div style={{
          background: 'rgba(37,211,102,0.1)',
          border: '2px solid #25D366',
          color: '#25D366',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'center',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>¡PAGO APROBADO! 🎉</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Tu pago ha sido registrado con éxito. El estado de tu deuda se actualizará en unos instantes.</p>
          <button 
            onClick={() => setPaymentSuccessMsg(false)} 
            style={{ 
              background: '#25D366', 
              color: 'black', 
              border: 'none', 
              padding: '0.4rem 1.2rem', 
              borderRadius: '20px', 
              marginTop: '0.8rem', 
              fontWeight: 'bold', 
              cursor: 'pointer' 
            }}
          >
            Entendido
          </button>
        </div>
      )}

      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <img src="/logo.png" alt="FULBO Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(204,255,0,0.8))' }} />
            <h1 className="glow-text-volt" style={{ fontSize: '2.5rem', margin: 0, fontStyle: 'italic', fontWeight: '900', letterSpacing: '1px' }}>FULBO</h1>
          </div>
          <span style={{ color: 'var(--electric-cyan)', fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 'bold' }}>THE ELITE MATCHMAKING ENGINE</span>
        </div>
      </header>

      {/* Mi Ficha Táctica Destacada */}
      {myPlayerCard && (
        <div 
          onClick={() => setSelectedPlayer(myPlayerCard)}
          className="glass-panel" 
          style={{ 
            maxWidth: '600px', 
            margin: '0 auto 2rem auto', 
            padding: '1.2rem', 
            border: '1px solid var(--ultimate-gold)', 
            background: 'rgba(255, 215, 0, 0.05)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderRadius: '12px',
            boxShadow: '0 0 15px rgba(255,215,0,0.15)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>🏆</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: 'var(--ultimate-gold)', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '1px', fontFamily: 'var(--font-primary)' }}>MI FICHA TÁCTICA</div>
              <div style={{ color: 'white', fontSize: '0.85rem' }}>Ver mi carta, rating {Math.round(myPlayerCard.glicko?.rating || 1500)} MMR e historial personal</div>
            </div>
          </div>
          <span style={{ color: 'var(--ultimate-gold)', fontSize: '1.5rem' }}>➔</span>
        </div>
      )}

      {/* Selector de Pestañas */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
        <button 
          onClick={() => setActiveTab('leaderboard')}
          style={{
            flex: 1,
            background: activeTab === 'leaderboard' ? 'var(--volt-lime)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'leaderboard' ? 'black' : 'white',
            border: 'none',
            padding: '0.8rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'var(--font-primary)',
            fontSize: '0.85rem',
            transition: 'all 0.2s',
            borderBottom: activeTab === 'leaderboard' ? '3px solid var(--electric-cyan)' : 'none'
          }}
        >
          🏆 POSICIONES (MMR)
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            background: activeTab === 'history' ? 'var(--volt-lime)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'history' ? 'black' : 'white',
            border: 'none',
            padding: '0.8rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'var(--font-primary)',
            fontSize: '0.85rem',
            transition: 'all 0.2s',
            borderBottom: activeTab === 'history' ? '3px solid var(--electric-cyan)' : 'none'
          }}
        >
          📚 PARTIDOS JUGADOS
        </button>
      </div>

      {activeEvent && !isEventExpired(activeEvent) && !isRegistering && !regSuccess && (
        <div style={{ background: 'var(--volt-lime)', color: 'black', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center', boxShadow: '0 0 20px rgba(204,255,0,0.4)', animation: 'pulse 2s infinite', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '900', fontSize: '1.5rem', fontStyle: 'italic' }}>⚡ MATCH DAY ⚡</h3>
          <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{activeEvent.date} a las {activeEvent.time} | Formato: {activeEvent.format} Jugadores</p>
          <button onClick={() => setIsRegistering(true)} style={{ background: 'black', color: 'var(--volt-lime)', border: 'none', padding: '1rem 2rem', fontSize: '1.2rem', fontWeight: '900', borderRadius: '30px', cursor: 'pointer', width: '100%', fontFamily: 'var(--font-primary)' }}>INSCRIBIRSE AHORA</button>
        </div>
      )}

      {activeEvent && !isEventExpired(activeEvent) && regSuccess && (
        <div style={{ background: 'rgba(37,211,102,0.1)', border: '2px solid #25D366', color: '#25D366', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>¡INSCRITO! ✅</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Tus stats temporales han sido enviadas. Espera a que el Organizador inicie el Draft En Vivo.</p>
        </div>
      )}

      {isRegistering && (
        <div style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid var(--electric-cyan)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--electric-cyan)', margin: 0 }}>FICHA TÉCNICA</h3>
            <button onClick={() => setIsRegistering(false)} style={{ background: 'none', border: 'none', color: 'var(--off-white)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
          </div>
          
          <form onSubmit={handleRegSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" placeholder="Tu Nombre (Ej: Messi)" value={regName} onChange={(e) => setRegName(e.target.value)} required style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.8rem', borderRadius: '8px', width: '100%' }} />
            
            <select value={regRole} onChange={(e) => setRegRole(e.target.value)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.8rem', borderRadius: '8px', width: '100%' }}>
              <option value="Arquero">Arquero</option>
              <option value="Defensor">Defensor</option>
              <option value="Mediocampo">Mediocampo</option>
              <option value="Delantero">Delantero</option>
            </select>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ color: 'var(--off-white)', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>SELECCIONA TU AVATAR EMOJI</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px' }}>
                {['👤', '⚽', '🏃‍♂️', '🔥', '🌟', '🧤', '🛡️', '🎯', '⚡', '🏆', '👽', '🦁', '💀', '🤖'].map(emoji => (
                  <button 
                    key={emoji}
                    type="button"
                    onClick={() => setRegAvatar(emoji)}
                    style={{
                      background: regAvatar === emoji ? 'var(--volt-lime)' : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '1.5rem',
                      width: '40px',
                      height: '40px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.1s ease, background 0.2s ease',
                      transform: regAvatar === emoji ? 'scale(1.15)' : 'none'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ color: 'var(--pure-white)', marginTop: 0, textAlign: 'center', marginBottom: '1rem' }}>ATRIBUTOS TÁCTICOS</h4>
              {['pac', 'sho', 'pas', 'dri', 'def', 'phy'].map(attr => (
                <div key={attr} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--off-white)', textTransform: 'uppercase', width: '30px', fontWeight: 'bold', fontSize: '0.8rem' }}>{attr}</span>
                  <input type="range" min="1" max="99" value={regStats[attr]} onChange={(e) => setRegStats({...regStats, [attr]: parseInt(e.target.value)})} style={{ flex: 1, accentColor: 'var(--volt-lime)' }} />
                  <span className="glow-text-volt" style={{ width: '25px', textAlign: 'right', fontWeight: 'bold' }}>{regStats[attr]}</span>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'rgba(204,255,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--volt-lime)' }}>
              <span style={{ color: 'white', fontWeight: 'bold' }}>OVR PROYECTADO:</span>
              <span className="glow-text-volt" style={{ fontSize: '2rem', fontWeight: '900' }}>{Math.round((regStats.pac + regStats.sho + regStats.pas + regStats.dri + regStats.def + regStats.phy)/6)}</span>
            </div>
            
            <button type="submit" className="btn-primary" style={{ padding: '1rem', fontSize: '1.1rem', marginTop: '1rem' }}>ENVIAR FICHA AL DRAFT</button>
          </form>
        </div>
      )}

      {activeTab === 'leaderboard' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '600px', margin: '0 auto' }}>
          {roster.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--off-white)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚽</div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Aún no hay jugadores registrados en esta liga.</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--electric-cyan)', fontWeight: 'bold' }}>Inscríbete arriba si hay un partido programado.</p>
            </div>
          ) : (
            roster.map((p, i) => {
              const pj = p.history?.pj || 0;
              const pg = p.history?.pg || 0;
              const winRate = pj > 0 ? Math.round((pg/pj)*100) : 0;
              const mmr = Math.round(p.glicko?.rating || 1500);
              
              return (
                <div key={p.id} onClick={() => setSelectedPlayer(p)} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: i < 3 ? 'var(--ultimate-gold)' : 'var(--off-white)', fontWeight: 'bold', fontSize: '1.2rem', width: '20px' }}>{i + 1}</span>
                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {p.avatar?.startsWith('data:image') ? <img src={p.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span style={{fontSize:'1.5rem'}}>{p.avatar || '👤'}</span>}
                    </div>
                    <div>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>{p.name}</div>
                      <div style={{ color: 'var(--off-white)', fontSize: '0.75rem' }}>
                        {p.role} | {pj} PJ ({pg}G / {p.history?.pe || 0}E / {p.history?.pp || 0}P)
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div className="glow-text-volt" style={{ fontSize: '1.3rem', fontWeight: '900' }}>{mmr}</div>
                    <div style={{ color: 'var(--electric-cyan)', fontSize: '0.75rem', fontWeight: 'bold' }}>{winRate}% WR</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
          {matchHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--off-white)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📚</div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No hay partidos disputados registrados aún.</p>
            </div>
          ) : (
            matchHistory.map((match, idx) => {
              const dateStr = new Date(match.date).toLocaleDateString() + ' ' + new Date(match.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              return (
                <div key={match.id} className="glass-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderLeft: match.winner === 'A' ? '4px solid var(--volt-lime)' : (match.winner === 'B' ? '4px solid var(--electric-cyan)' : '4px solid gray') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--off-white)', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                    <span>Partido #{matchHistory.length - idx}</span>
                    <span>{dateStr}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, textAlign: 'right', paddingRight: '0.5rem' }}>
                      <h4 style={{ margin: 0, color: 'var(--volt-lime)', fontSize: '0.95rem', fontWeight: 'bold' }}>Equipo A</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--off-white)', marginTop: '0.2rem' }}>
                        {match.teamA.map(p => p.name).join(', ')}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 0.5rem' }}>
                      <span style={{ fontSize: '1.6rem', fontWeight: '900', color: match.winner === 'A' ? 'var(--volt-lime)' : 'white' }}>{match.matchScore.A}</span>
                      <span style={{ color: 'var(--off-white)', fontSize: '0.8rem' }}>-</span>
                      <span style={{ fontSize: '1.6rem', fontWeight: '900', color: match.winner === 'B' ? 'var(--electric-cyan)' : 'white' }}>{match.matchScore.B}</span>
                    </div>

                    <div style={{ flex: 1, textAlign: 'left', paddingLeft: '0.5rem' }}>
                      <h4 style={{ margin: 0, color: 'var(--electric-cyan)', fontSize: '0.95rem', fontWeight: 'bold' }}>Equipo B</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--off-white)', marginTop: '0.2rem' }}>
                        {match.teamB.map(p => p.name).join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default CompanionApp;
