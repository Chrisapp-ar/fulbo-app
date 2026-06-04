import React, { useState, useEffect } from 'react';
import glicko2 from 'glicko2';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import PlayerCard from '../components/PlayerCard';
import AvatarSelector from '../components/AvatarSelector';
import EloChart from '../components/EloChart';

const DEFAULT_ROSTER = [
  { id: '1', name: 'Riquelme', role: 'Mediocampo', avatar: '🌟', stats: { pac: 70, sho: 85, pas: 95, dri: 92, def: 40, phy: 75 } },
  { id: '2', name: 'Mascherano', role: 'Defensor', avatar: '🛡️', stats: { pac: 75, sho: 60, pas: 80, dri: 70, def: 95, phy: 90 } },
  { id: '3', name: 'Batistuta', role: 'Delantero', avatar: '🔥', stats: { pac: 85, sho: 96, pas: 70, dri: 80, def: 45, phy: 88 } },
  { id: '4', name: 'Samuel', role: 'Arquero', avatar: '🧤', stats: { pac: 72, sho: 50, pas: 65, dri: 60, def: 92, phy: 94 } },
].map(p => ({ ...p, history: { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 }, glicko: { rating: 1500, rd: 350, vol: 0.06, history: [1500] }, financial: { debt: 0, isBanned: false }, condition: { stamina: 100 } }));

const BADGE_ICONS = {
  mvp: { icon: '👑', label: 'MVP', color: 'var(--ultimate-gold)', glow: 'rgba(255,215,0,0.5)', desc: 'MVP del último partido' },
  goleador: { icon: '🎯', label: 'Goleador', color: 'var(--volt-lime)', glow: 'rgba(204,255,0,0.5)', desc: 'Goleador Histórico (5+ goles)' },
  guardian: { icon: '🛡️', label: 'Guardián', color: 'var(--electric-cyan)', glow: 'rgba(0,240,255,0.5)', desc: 'Muralla Defensiva (3+ victorias)' },
  ironman: { icon: '⚡', label: 'Ironman', color: 'var(--volt-lime)', glow: 'rgba(204,255,0,0.5)', desc: 'Físico Imparable (Stamina > 60%)' },
  fairplay: { icon: '🪙', label: 'Fair Play', color: 'var(--ultimate-gold)', glow: 'rgba(255,215,0,0.5)', desc: 'Finanzas Impecables (Sin deudas)' }
};

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

const Dashboard = ({ userId, userEmail, onLogout }) => {
  // ==========================================
  // ESTADOS DE REACT (Todos agrupados al inicio para evitar Temporal Dead Zone y ReferenceErrors)
  // ==========================================

  // 1. Estados principales (Roster y Match History)
  const [roster, setRoster] = useState(() => {
    const saved = localStorage.getItem('fulbo_roster');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Failed to parse roster from localStorage:", e);
      }
    }
    return DEFAULT_ROSTER;
  });

  const [matchHistory, setMatchHistory] = useState(() => {
    const saved = localStorage.getItem('fulbo_match_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Failed to parse matchHistory from localStorage:", e);
      }
    }
    return [];
  });

  // 2. Estados de navegación y detalles
  const [viewMode, setViewMode] = useState('builder'); 
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState(null);

  // 3. Estados de la cinemática de sobre (Pack Opening)
  const [showPackOpening, setShowPackOpening] = useState(false);
  const [walkoutPlayer, setWalkoutPlayer] = useState(null);
  const [walkoutRevealStage, setWalkoutRevealStage] = useState(0);

  // 4. Estados de Mercado Pago y configuración
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpUserId, setMpUserId] = useState('');
  const [showMpConfig, setShowMpConfig] = useState(false);

  // 9. Estados de Suscripción SaaS
  const [subscriptionType, setSubscriptionType] = useState('trial');
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState('');
  const [subscriptionChecking, setSubscriptionChecking] = useState(true);

  // 5. Estados del Match Day Lobby
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventFormat, setEventFormat] = useState(10);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('20:00');
  const [eventRegistrations, setEventRegistrations] = useState([]);
  const [hostId, setHostId] = useState(userId || null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // 6. Estados del Formulario de Jugadores
  const [name, setName] = useState('');
  const [role, setRole] = useState('Mediocampo');
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const [skills, setSkills] = useState({ pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });
  const [editingPlayerId, setEditingPlayerId] = useState(null);

  // 7. Estados de La Vaquita y armado de equipos
  const [pitchCost, setPitchCost] = useState('');
  const [paymentsMap, setPaymentsMap] = useState({});
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  // 8. Estados del partido en vivo e historial
  const [matchScore, setMatchScore] = useState({ A: 0, B: 0 });
  const [playerGoals, setPlayerGoals] = useState({}); 
  const [lastMatchResult, setLastMatchResult] = useState(null);

  // 10. Estados de Notificaciones e Interfaz
  const [toastMessage, setToastMessage] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState('active');

  // ==========================================
  // EFECTOS (useEffect) Y SINCRONIZACIÓN
  // ==========================================

  useEffect(() => {
    if (!initialLoadDone) return;
    localStorage.setItem('fulbo_roster', JSON.stringify(roster));
    if (isSupabaseConfigured && supabase) {
       supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) supabase.from('league_state').update({ roster, updated_at: new Date().toISOString() }).eq('host_id', user.id).then();
       }).catch(err => {
         console.error("Error updating roster on Supabase:", err);
       });
    }
  }, [roster, initialLoadDone]);

  useEffect(() => {
    if (!initialLoadDone) return;
    localStorage.setItem('fulbo_match_history', JSON.stringify(matchHistory));
    if (isSupabaseConfigured && supabase) {
       supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) supabase.from('league_state').update({ match_history: matchHistory, updated_at: new Date().toISOString() }).eq('host_id', user.id).then();
       }).catch(err => {
         console.error("Error updating match history on Supabase:", err);
       });
    }
  }, [matchHistory, initialLoadDone]);

  // Cloud state loading is now merged sequentially inside the main initDashboard useEffect to avoid race conditions.

  useEffect(() => {
    if (!roster || roster.length === 0) return;
    const needsMigration = roster.some(p => p && p.history && (p.history.pe === undefined || p.history.pp === undefined || ((p.history.pj || 0) > 0 && !p.lastMatchDate)));
    if (needsMigration) {
      const migratedRoster = roster.map(p => {
        if (!p) return p;
        if (!p.history) return p;
        
        let lastMatchDate = p.lastMatchDate;
        if ((p.history.pj || 0) > 0 && !lastMatchDate) {
          const matchesWithPlayer = matchHistory.filter(match => {
            const inA = match.teamA?.some(m => m && (m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase())));
            const inB = match.teamB?.some(m => m && (m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase())));
            return inA || inB;
          });
          if (matchesWithPlayer.length > 0) {
            const latest = matchesWithPlayer.reduce((latestMatch, currentMatch) => {
              const latestTime = new Date(latestMatch.eventDate || latestMatch.date || 0).getTime();
              const currentTime = new Date(currentMatch.eventDate || currentMatch.date || 0).getTime();
              return currentTime > latestTime ? currentMatch : latestMatch;
            }, matchesWithPlayer[0]);
            lastMatchDate = latest.eventDate || latest.date || new Date().toISOString();
          } else {
            lastMatchDate = new Date().toISOString();
          }
        }
        
        if (p.history.pe !== undefined && p.history.pp !== undefined) {
          return { ...p, lastMatchDate };
        }
        
        let pe = 0;
        let pp = 0;
        matchHistory.forEach(match => {
          const inA = match.teamA?.some(m => m && (m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase())));
          const inB = match.teamB?.some(m => m && (m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase())));
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
          lastMatchDate,
          history: {
            ...p.history,
            pe,
            pp
          }
        };
      });
      setRoster(migratedRoster);
    }
  }, [roster, matchHistory]);

  useEffect(() => {
    if (isSupabaseConfigured && supabase && hostId) {
      supabase.from('hosts').select('mercadopago_access_token, mercadopago_user_id').eq('id', hostId).then(({ data, error }) => {
        if (data && data.length > 0) {
          setMpAccessToken(data[0].mercadopago_access_token || '');
          setMpUserId(data[0].mercadopago_user_id || '');
        }
      }).catch(err => {
        console.error("Error fetching host MP settings:", err);
      });
    }
  }, [hostId]);

  const saveMpConfig = async () => {
    if (!isSupabaseConfigured || !supabase || !hostId) {
      alert("Error: Supabase no está configurado o no has iniciado sesión.");
      return;
    }
    
    try {
      let resolvedUserId = mpUserId;
      if (mpAccessToken && mpAccessToken.trim() !== '' && (!mpUserId || mpUserId.trim() === '')) {
        try {
          const res = await fetch('https://api.mercadopago.com/v1/users/me', {
            headers: { 'Authorization': `Bearer ${mpAccessToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.id) {
              resolvedUserId = String(data.id);
              setMpUserId(resolvedUserId);
            }
          }
        } catch (e) {
          console.error("No se pudo obtener el user_id automáticamente de Mercado Pago:", e);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || 'host@demo.com';

      const { error } = await supabase.from('hosts').update({
        email: email,
        mercadopago_access_token: mpAccessToken,
        mercadopago_user_id: resolvedUserId
      }).eq('id', hostId);

      if (error) {
        throw error;
      }

      alert("¡Configuración de Mercado Pago guardada con éxito!");
      setShowMpConfig(false);
    } catch (e) {
      console.error(e);
      alert("Error al guardar en Supabase: " + e.message + "\nAsegúrate de haber corrido las migraciones SQL en la base de datos.");
    }
  };

  const broadcastPaymentNotification = () => {
    setActiveEvent(prev => {
      if (!prev) return null;
      const updated = { ...prev, paymentBroadcasted: true, paymentBroadcastTime: Date.now() };
      
      // Sincronizar Inmediatamente con Supabase
      if (isSupabaseConfigured && supabase && hostId) {
        supabase.from('league_state').update({ active_event: updated }).eq('host_id', hostId).then();
      }
      
      setToastMessage("Notificación de pago enviada a todos los jugadores");
      setTimeout(() => setToastMessage(''), 3000);
      
      return updated;
    });
  };

  const renderMpConfigModal = () => {
    if (!showMpConfig) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: '1rem',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        <div className="glass-panel" style={{
          maxWidth: '500px', width: '100%',
          padding: '2.5rem', border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative'
        }}>
          <button 
            onClick={() => setShowMpConfig(false)}
            style={{
              position: 'absolute', top: '1rem', right: '1.2rem',
              background: 'transparent', border: 'none', color: 'var(--off-white)',
              fontSize: '1.8rem', cursor: 'pointer', fontFamily: 'var(--font-secondary)'
            }}
          >
            &times;
          </button>
          
          <h2 className="glow-text-volt" style={{ fontSize: '2rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-primary)' }}>
            ⚙️ CONFIGURACIÓN MP
          </h2>
          <p style={{ color: 'var(--off-white)', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1.5rem', fontFamily: 'var(--font-secondary)' }}>
            Ingresa tu **Access Token** de Mercado Pago (Producción o Sandbox) para generar cobros reales con conciliación automática de deudas en "La Vaquita".
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ color: 'var(--pure-white)', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px', fontFamily: 'var(--font-primary)' }}>MERCADOPAGO ACCESS TOKEN</label>
              <input 
                type="password" 
                value={mpAccessToken} 
                onChange={(e) => setMpAccessToken(e.target.value)} 
                placeholder="APP_USR-..." 
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  color: 'white',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--off-white)', fontFamily: 'var(--font-secondary)' }}>
                Consíguelo en tu panel de Mercado Pago Developers &gt; Credenciales.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ color: 'var(--pure-white)', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px', fontFamily: 'var(--font-primary)' }}>MERCADOPAGO USER ID (OPCIONAL)</label>
              <input 
                type="text" 
                value={mpUserId} 
                onChange={(e) => setMpUserId(e.target.value)} 
                placeholder="Ej: 123456789" 
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--off-white)', fontFamily: 'var(--font-secondary)' }}>
                Se detecta automáticamente al guardar el Access Token si se deja en blanco.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-primary" onClick={saveMpConfig} style={{ flex: 1 }}>GUARDAR</button>
            <button onClick={() => setShowMpConfig(false)} style={{ ...btnSec, flex: 1, borderColor: 'var(--crimson-red)', color: 'var(--crimson-red)' }}>CANCELAR</button>
          </div>
        </div>
      </div>
    );
  };

  const renderPlayerDetailsModal = () => {
    if (!selectedPlayerDetails) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        <div className="glass-panel responsive-flex" style={{
          maxWidth: '900px',
          width: '100%',
          display: 'flex',
          gap: '2.5rem',
          padding: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          {/* Close Button */}
          <button 
            onClick={() => setSelectedPlayerDetails(null)} 
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1.2rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--off-white)',
              fontSize: '1.8rem',
              cursor: 'pointer',
              transition: 'color 0.2s',
              fontFamily: 'var(--font-secondary)'
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--crimson-red)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--off-white)'}
          >
            &times;
          </button>

          {/* Left side: FUT Card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <PlayerCard 
              name={selectedPlayerDetails.name} 
              position={selectedPlayerDetails.role.substring(0,3).toUpperCase()} 
              stats={selectedPlayerDetails.stats} 
              avatar={selectedPlayerDetails.avatar} 
              ovr={calcOvr(selectedPlayerDetails)}
              stamina={selectedPlayerDetails.condition?.stamina ?? 100}
              badges={getPlayerBadges(selectedPlayerDetails)}
              isInjured={selectedPlayerDetails.condition?.isResting}
            />
            <span style={{ 
              marginTop: '1rem', 
              color: 'var(--ultimate-gold)', 
              fontFamily: 'var(--font-primary)', 
              fontSize: '1.3rem', 
              fontWeight: '900',
              letterSpacing: '1px'
            }}>
              {selectedPlayerDetails.role.toUpperCase()}
            </span>
          </div>

          {/* Right side: Elo chart & Stats */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h2 className="glow-text-volt" style={{ fontSize: '2.2rem', margin: '0 0 0.2rem 0' }}>{selectedPlayerDetails.name}</h2>
              <p style={{ color: 'var(--off-white)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
                Estadísticas del Rango Competitivo (Glicko-2)
              </p>
            </div>

            {/* Chart */}
            <EloChart history={selectedPlayerDetails.glicko?.history || [1500, selectedPlayerDetails.glicko?.rating || 1500]} />

            {/* Stats Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--off-white)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Rating Actual</div>
                <div className="glow-text-volt" style={{ fontSize: '1.4rem', fontWeight: '900', marginTop: '0.2rem' }}>
                  {Math.round(selectedPlayerDetails.glicko?.rating || 1500)}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--off-white)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Partidos Jugados</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', marginTop: '0.2rem', color: 'white' }}>
                  {selectedPlayerDetails.history?.pj || 0}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--off-white)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Win Rate %</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', marginTop: '0.2rem', color: 'var(--electric-cyan)' }}>
                  {selectedPlayerDetails.history?.pj > 0 
                    ? Math.round(((selectedPlayerDetails.history?.pg || 0) / selectedPlayerDetails.history.pj) * 100)
                    : 0}%
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--off-white)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Desviación (RD)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0.4rem', color: 'var(--off-white)' }}>
                  ±{Math.round(selectedPlayerDetails.glicko?.rd || 350)}
                </div>
              </div>
            </div>

            {/* Detailed Match History Record */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ background: 'rgba(204,255,0,0.02)', border: '1px solid rgba(204,255,0,0.1)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--volt-lime)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Ganados (PG)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '900', marginTop: '0.1rem', color: 'var(--volt-lime)' }}>{selectedPlayerDetails.history?.pg || 0}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--off-white)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Empatados (PE)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '900', marginTop: '0.1rem', color: 'white' }}>{selectedPlayerDetails.history?.pe || 0}</div>
              </div>
              <div style={{ background: 'rgba(255,59,48,0.02)', border: '1px solid rgba(255,59,48,0.1)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--crimson-red)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Perdidos (PP)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '900', marginTop: '0.1rem', color: 'var(--crimson-red)' }}>{selectedPlayerDetails.history?.pp || 0}</div>
              </div>
            </div>

            {/* PlayStyles / Logros Details */}
            {getPlayerBadges(selectedPlayerDetails).length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                <h4 style={{ color: 'var(--ultimate-gold)', fontSize: '0.8rem', marginBottom: '0.6rem', letterSpacing: '1.5px', fontFamily: 'var(--font-primary)' }}>PLAYSTYLES / LOGROS</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                  {getPlayerBadges(selectedPlayerDetails).map(b => {
                    const badge = BADGE_ICONS[b];
                    if (!badge) return null;
                    return (
                      <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: `1px solid ${badge.color}` }}>
                        <span style={{ fontSize: '1rem', filter: `drop-shadow(0 0 4px ${badge.glow})` }}>{badge.icon}</span>
                        <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'var(--font-secondary)' }}>{badge.label}</span>
                        <span style={{ color: 'var(--off-white)', fontSize: '0.65rem', fontFamily: 'var(--font-secondary)' }}>({badge.desc})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button 
                onClick={() => {
                   healPlayer(selectedPlayerDetails.id);
                   setSelectedPlayerDetails(null);
                }} 
                className="btn-primary" 
                style={{ flex: 1, background: 'rgba(255,59,48,0.1)', borderColor: '#FF3B30', color: '#FF3B30', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 'bold' }}
              >
                🚑 HOSPITAL (Lesión/Alta)
              </button>
              <button 
                onClick={() => {
                   startEdit(selectedPlayerDetails);
                   setViewMode('builder');
                   setSelectedPlayerDetails(null);
                }} 
                className="btn-primary" 
                style={{ flex: 1, background: 'var(--electric-cyan)', borderColor: 'var(--electric-cyan)', color: 'black', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 'bold' }}
              >
                ⚙️ MEJORAR SKILLS
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const initDashboard = async () => {
        let currentHostId = hostId;
        let activeUser = null;
        
        // 1. Get the current authenticated user
        try {
          const { data: { user } } = await supabase.auth.getUser();
          activeUser = user;
          if (user) {
            currentHostId = user.id;
            setHostId(user.id);
          }
        } catch (err) {
          console.error("Error fetching user session:", err);
        }

        if (!activeUser) {
          setSubscriptionChecking(false);
          return;
        }

        // 2. Fetch or self-heal host details
        try {
          const { data: hostData } = await supabase
            .from('hosts')
            .select('subscription_type, subscription_status, subscription_ends_at')
            .eq('id', currentHostId);
          
          if (hostData && hostData.length > 0) {
            setSubscriptionType(hostData[0].subscription_type || 'trial');
            setSubscriptionStatus(hostData[0].subscription_status || 'active');
            setSubscriptionEndsAt(hostData[0].subscription_ends_at || '');
          } else {
            // Auto-heal: Insert host details if they are missing (e.g. trigger failed to execute)
            const defaultEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('hosts').insert({
              id: currentHostId,
              email: activeUser.email || 'host@demo.com',
              subscription_type: 'trial',
              subscription_status: 'active',
              subscription_ends_at: defaultEndsAt
            });
            setSubscriptionType('trial');
            setSubscriptionStatus('active');
            setSubscriptionEndsAt(defaultEndsAt);
          }
        } catch (err) {
          console.error("Error fetching host subscription:", err);
        }
        setSubscriptionChecking(false);

        // 3. Fetch or self-heal league_state (only AFTER hosts is guaranteed to exist!)
        try {
          const { data: stateData } = await supabase
            .from('league_state')
            .select('*')
            .eq('host_id', currentHostId);
          
          if (stateData && stateData.length > 0) {
            const leagueData = stateData[0];
            if (Array.isArray(leagueData.roster) && leagueData.roster.length > 0) {
              setRoster(leagueData.roster);
            }
            if (Array.isArray(leagueData.match_history) && leagueData.match_history.length > 0) {
              setMatchHistory(leagueData.match_history);
            }
            if (leagueData.active_event) {
              const ae = leagueData.active_event;
              setActiveEvent(ae);
              if (ae.status === 'preview') {
                setTeamA(ae.teamA || []);
                setTeamB(ae.teamB || []);
                setPitchCost(ae.pitchCost || '');
                setPaymentsMap(ae.paymentsMap || {});
                setViewMode('builder');
              } else if (ae.status === 'match') {
                setTeamA(ae.teamA || []);
                setTeamB(ae.teamB || []);
                setPitchCost(ae.pitchCost || '');
                setPaymentsMap(ae.paymentsMap || {});
                setMatchScore(ae.matchScore || { A: 0, B: 0 });
                setPlayerGoals(ae.playerGoals || {});
                setViewMode('match');
              }
            }
          } else {
            // Auto-heal: Insert default league state since hosts is now guaranteed to exist
            await supabase.from('league_state').insert({
              host_id: currentHostId,
              roster: roster,
              match_history: matchHistory,
              active_event: null,
              updated_at: new Date().toISOString()
            });
          }
          setInitialLoadDone(true);
        } catch (err) {
          console.error("Error fetching or initializing league state:", err);
        }
      };
      
      initDashboard();
    } else {
      setSubscriptionChecking(false);
    }
  }, [userId]);

  useEffect(() => {
    if (initialLoadDone && isSupabaseConfigured && supabase && hostId) {
       supabase.from('league_state').update({ active_event: activeEvent, updated_at: new Date().toISOString() }).eq('host_id', hostId).then();
    }
  }, [activeEvent, hostId, initialLoadDone]);

  // Sincronizar cambios locales de la vaquita con activeEvent
  useEffect(() => {
    if (activeEvent && (activeEvent.status === 'preview' || activeEvent.status === 'match')) {
      if (activeEvent.pitchCost !== pitchCost || JSON.stringify(activeEvent.paymentsMap) !== JSON.stringify(paymentsMap)) {
        setActiveEvent(prev => {
          if (!prev) return null;
          return {
            ...prev,
            pitchCost: pitchCost,
            paymentsMap: paymentsMap
          };
        });
      }
    }
  }, [pitchCost, paymentsMap]);

  // Suscribirse a cambios de league_state en tiempo real (evitando loops infinitos)
  useEffect(() => {
    if (!hostId || !isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel(`league_state_host_${hostId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_state'
        },
        (payload) => {
          if (payload.new && payload.new.host_id === hostId) {
            const nextEvent = payload.new.active_event;
            setActiveEvent(curr => {
              if (JSON.stringify(curr) === JSON.stringify(nextEvent)) {
                return curr; // De-duplicar para evitar bucle
              }
              if (!nextEvent) {
                // Clear local states if event was deleted/finished on another device
                setTeamA([]);
                setTeamB([]);
                setPitchCost('');
                setPaymentsMap({});
                setMatchScore({ A: 0, B: 0 });
                setPlayerGoals({});
              } else if (nextEvent.status === 'preview') {
                setTeamA(nextEvent.teamA || []);
                setTeamB(nextEvent.teamB || []);
                setPitchCost(nextEvent.pitchCost || '');
                setPaymentsMap(nextEvent.paymentsMap || {});
              } else if (nextEvent.status === 'match') {
                setTeamA(nextEvent.teamA || []);
                setTeamB(nextEvent.teamB || []);
                setPitchCost(nextEvent.pitchCost || '');
                setPaymentsMap(nextEvent.paymentsMap || {});
                setMatchScore(nextEvent.matchScore || { A: 0, B: 0 });
                setPlayerGoals(nextEvent.playerGoals || {});
              }
              return nextEvent;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hostId]);

  useEffect(() => {
    if (activeEvent && hostId) {
      const eventDateObj = new Date(activeEvent.date + 'T23:59:59');
      const dayAfterEvent = new Date(eventDateObj.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > dayAfterEvent) {
        // Auto-delete / archive expired event (day after the event has passed)
        setActiveEvent(null);
        setEventRegistrations([]);
        setTeamA([]);
        setTeamB([]);
        setPitchCost('');
        setPaymentsMap({});
        setMatchScore({ A: 0, B: 0 });
        setPlayerGoals({});
        if (isSupabaseConfigured && supabase) {
          supabase.from('league_state').update({ active_event: null, updated_at: new Date().toISOString() }).eq('host_id', hostId).then();
          supabase.from('event_registrations').delete().eq('host_id', hostId).then();
        }
      }
    }
  }, [activeEvent, hostId]);

  useEffect(() => {
    if (!activeEvent || !isSupabaseConfigured || !supabase || !hostId) return;

    // Obtener registros iniciales
    const fetchRegistrations = async () => {
      const { data } = await supabase.from('event_registrations').select('*').eq('host_id', hostId);
      if (data) setEventRegistrations(data);
    };
    fetchRegistrations();

    // Suscribirse a cambios en tiempo real sin filtro de UUID para máxima compatibilidad
    const channel = supabase
      .channel('lobby-registrations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_registrations'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setToastMessage(`⚽ ¡${payload.new.name} se ha unido al partido!`);
            setTimeout(() => setToastMessage(''), 4000);
          }
          fetchRegistrations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEvent, hostId]);

  const markNotificationsAsRead = () => {
    if (!activeEvent || !activeEvent.notifications) return;
    const updatedNotifications = activeEvent.notifications.map(n => ({ ...n, read: true }));
    setActiveEvent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        notifications: updatedNotifications
      };
    });
  };

  const clearNotifications = () => {
    setActiveEvent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        notifications: []
      };
    });
  };

  const cancelPreview = () => {
    if (window.confirm('¿Cancelar armado de equipos? El partido volverá al estado de inscripción.')) {
      setTeamA([]);
      setTeamB([]);
      setPitchCost('');
      setPaymentsMap({});
      setIsDrafting(false);
      setActiveEvent(prev => {
        if (!prev) return null;
        const { teamA, teamB, pitchCost, paymentsMap, ...rest } = prev;
        return { ...rest, status: 'lobby' };
      });
    }
  };

  const cancelLiveMatch = () => {
    if (window.confirm('¿Cancelar partido en curso? No se guardará el historial ni estadísticas del partido.')) {
      setTeamA([]);
      setTeamB([]);
      setPitchCost('');
      setPaymentsMap({});
      setIsDrafting(false);
      setActiveEvent(prev => {
        if (!prev) return null;
        const { teamA, teamB, pitchCost, paymentsMap, matchScore, playerGoals, ...rest } = prev;
        return { ...rest, status: 'lobby' };
      });
      setViewMode('builder');
    }
  };

  const copyLeagueLink = () => {
    if (hostId) {
       navigator.clipboard.writeText(`${window.location.origin}/?league=${hostId}`);
       alert('¡Enlace Mágico copiado al portapapeles! Pégalo en WhatsApp para que los jugadores vean sus cartas.');
    } else {
       alert('El enlace solo está disponible si inicias sesión real en la Nube (Cloud Security Gateway).');
    }
  };
  


  const handleSkillChange = (e) => setSkills({...skills, [e.target.name]: parseInt(e.target.value) || 0 });

  const resetForm = () => {
    setName('');
    setRole('Mediocampo');
    setCurrentAvatar(null);
    setSkills({ pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });
    setEditingPlayerId(null);
  };

  const savePlayer = async (e) => {
    e.preventDefault();
    if (!name) return;
    
    if (editingPlayerId) {
      const inRoster = roster.some(p => p.id === editingPlayerId);
      if (inRoster) {
        setRoster(roster.map(p => p.id === editingPlayerId ? { ...p, name, role, avatar: currentAvatar, stats: {...skills} } : p));
      } else {
        // Add guest player to roster
        const newPlayer = { 
          id: editingPlayerId, 
          name, 
          role, 
          avatar: currentAvatar, 
          stats: {...skills}, 
          history: { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 }, 
          glicko: { rating: 1500, rd: 350, vol: 0.06 }, 
          financial: { debt: 0, isBanned: false }, 
          condition: { stamina: 100 } 
        };
        setRoster([...roster, newPlayer]);
      }
      
      // Update registration details in local state and database
      setEventRegistrations(prev => prev.map(reg => reg.id === editingPlayerId ? { ...reg, name, role, stats: {...skills}, avatar: currentAvatar } : reg));
      if (isSupabaseConfigured && supabase) {
        const isUuid = (str) => {
          if (!str) return false;
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        };
        if (isUuid(editingPlayerId)) {
          await supabase.from('event_registrations').update({
            name,
            role,
            stats: skills,
            avatar: currentAvatar
          }).eq('id', editingPlayerId);
        }
      }
    } else {
      const newPlayer = { 
        id: Date.now().toString(), 
        name, 
        role, 
        avatar: currentAvatar, 
        stats: {...skills}, 
        history: { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 }, 
        glicko: { rating: 1500, rd: 350, vol: 0.06 }, 
        financial: { debt: 0, isBanned: false }, 
        condition: { stamina: 100 } 
      };
      setRoster([...roster, newPlayer]);
      if (activeEvent) {
        await addPlayerToEvent(newPlayer);
      }
    }
    resetForm();
  };

  const startEdit = (player) => {
    setName(player.name);
    setRole(player.role);
    setCurrentAvatar(player.avatar);
    setSkills({...player.stats});
    setEditingPlayerId(player.id);
  };

  const removePlayer = (id) => {
    if (editingPlayerId === id) resetForm();
    setRoster(roster.filter(p => p.id !== id));
  };
  
  const healPlayer = (id) => {
    const inRoster = roster.some(p => p.id === id);
    if (inRoster) {
      setRoster(roster.map(p => {
        if (p.id === id) {
          const isCurrentlyResting = p.condition?.isResting || false;
          return {
            ...p,
            condition: {
              ...p.condition,
              isResting: !isCurrentlyResting,
              stamina: isCurrentlyResting ? 100 : 50
            }
          };
        }
        return p;
      }));
    } else {
      // Find them in registrations to get their details
      const reg = eventRegistrations.find(r => r.id === id);
      if (reg) {
        const newPlayer = {
          id: id,
          name: reg.name,
          role: reg.role || 'Mediocampo',
          avatar: reg.avatar || '👤',
          stats: reg.stats || { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 },
          history: { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 }, 
          glicko: { rating: 1500, rd: 350, vol: 0.06 }, 
          financial: { debt: 0, isBanned: false }, 
          condition: { isResting: true, stamina: 50 }
        };
        setRoster([...roster, newPlayer]);
      }
    }
  };

  const addPlayerToEvent = async (p) => {
    if (!activeEvent) return;
    const isRegistered = eventRegistrations.some(reg => reg.name.toLowerCase().trim() === p.name.toLowerCase().trim());
    if (isRegistered) return;

    // Check if player ID is a valid UUID before sending it to Supabase
    const isUuid = (str) => {
      if (!str) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    const newReg = {
      host_id: hostId,
      player_id: isUuid(p.id) ? p.id : null,
      name: p.name,
      role: p.role,
      stats: p.stats,
      avatar: p.avatar
    };

    if (isSupabaseConfigured && supabase) {
      // Optimistic update: instantly add to local state to prevent lag and dropdown conflicts
      const tempId = Date.now().toString();
      setEventRegistrations(prev => {
        const alreadyIn = prev.some(r => r.name.toLowerCase().trim() === p.name.toLowerCase().trim());
        if (alreadyIn) return prev;
        return [...prev, { ...newReg, id: tempId }];
      });

      const { error } = await supabase.from('event_registrations').insert(newReg);
      if (error) {
        console.error("Error adding player to event:", error);
        alert("Error al convocar al jugador: " + error.message);
        // Rollback optimistic update
        setEventRegistrations(prev => prev.filter(r => r.id !== tempId));
      }
    } else {
      setEventRegistrations(prev => [...prev, { ...newReg, id: Date.now().toString() }]);
    }
  };

  const removePlayerFromEvent = async (name, regId) => {
    if (!activeEvent) return;
    
    // Save previous state for rollback
    const previousRegs = [...eventRegistrations];
    const previousA = [...teamA];
    const previousB = [...teamB];

    // Optimistic update: instantly remove from local state and team lists
    setEventRegistrations(prev => prev.filter(reg => reg.name.toLowerCase().trim() !== name.toLowerCase().trim()));
    
    const newA = teamA.filter(x => x.name.toLowerCase().trim() !== name.toLowerCase().trim());
    const newB = teamB.filter(x => x.name.toLowerCase().trim() !== name.toLowerCase().trim());
    setTeamA(newA);
    setTeamB(newB);
    setActiveEvent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        teamA: newA,
        teamB: newB
      };
    });

    if (isSupabaseConfigured && supabase) {
      const isUuid = (str) => {
        if (!str) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      };

      const deleteQuery = (regId && isUuid(regId)) 
        ? supabase.from('event_registrations').delete().eq('id', regId).eq('host_id', hostId)
        : supabase.from('event_registrations').delete().eq('host_id', hostId).eq('name', name);
        
      const { error } = await deleteQuery;
      if (error) {
        console.error("Error removing player from event:", error);
        alert("Error al quitar al jugador: " + error.message);
        // Rollback
        setEventRegistrations(previousRegs);
        setTeamA(previousA);
        setTeamB(previousB);
        setActiveEvent(prev => {
          if (!prev) return null;
          return {
            ...prev,
            teamA: previousA,
            teamB: previousB
          };
        });
      }
    }
  };

  const calcRawOvr = (stats) => {
    if (!stats) return 75;
    return Math.round(((stats.pac || 75) + (stats.sho || 75) + (stats.pas || 75) + (stats.dri || 75) + (stats.def || 75) + (stats.phy || 75)) / 6);
  };
  const calcOvr = (p) => {
    if (!p) return 75;
    const raw = calcRawOvr(p.stats);
    const stam = p.condition?.stamina ?? 100;
    // Opción B: Penalización global multiplicativa. (100% de stamina = 100% OVR, 0% stamina = 50% OVR)
    return Math.round(raw * (0.5 + (0.5 * (stam / 100))));
  };
  const calcHybridScore = (p) => {
    if (!p) return 75;
    return (calcOvr(p) + ((p.glicko?.rating || 1500) / 20)) / 2;
  };

  const balanceTeamsLocally = (useLobby = false) => {
    setIsLoading(true);
    setTimeout(() => {
      let pool = [];
      if (useLobby) {
        // Limpiar duplicados
        const uniqueMap = {};
        eventRegistrations.forEach(r => { if (r && r.name) { const key = r.id || r.name.toLowerCase().trim(); uniqueMap[key] = r; } });
        const finalRegs = Object.values(uniqueMap).slice(0, activeEvent?.format || 100);

        if (finalRegs.length < 8) {
          alert("No se puede armar equipos con menos de 8 jugadores inscriptos.");
          setIsLoading(false);
          return;
        }

        pool = finalRegs.map(reg => {
          const existingPlayer = roster.find(p => p && p.name && reg && reg.name && p.name.toLowerCase().trim() === reg.name.toLowerCase().trim());
          return {
            id: existingPlayer ? existingPlayer.id : (reg.id || Math.random().toString(36).substr(2, 9)),
            player_id: reg.player_id || (existingPlayer ? existingPlayer.player_id : null),
            name: reg.name,
            role: reg.role,
            avatar: reg.avatar || (existingPlayer ? existingPlayer.avatar : '👤'),
            stats: reg.stats, 
            history: existingPlayer ? existingPlayer.history : { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 },
            glicko: existingPlayer ? existingPlayer.glicko : { rating: 1500, rd: 350, vol: 0.06 },
            financial: existingPlayer ? existingPlayer.financial : { debt: 0, isBanned: false },
            condition: existingPlayer ? existingPlayer.condition : { stamina: 100 }
          };
        });
      } else {
        pool = roster.filter(p => !p.condition?.isResting);
      }
      
      const mapRole = (r) => {
         if (r === 'Ancla') return 'Defensor';
         if (r === 'Creativo') return 'Mediocampo';
         if (r === 'Finalizador') return 'Delantero';
         if (r === 'Capitán') return 'Mediocampo';
         return r;
      };
      const tA = [];
      const tB = [];
      let sumA = 0;
      let sumB = 0;
      
      const activePool = pool.filter(p => p);
      
      const grouped = {
        Arquero: [],
        Defensor: [],
        Mediocampo: [],
        Delantero: []
      };
      
      activePool.forEach(p => {
        const r = mapRole(p.role);
        if (grouped[r]) grouped[r].push(p);
        else grouped.Mediocampo.push(p);
      });
      
      Object.keys(grouped).forEach(r => {
        grouped[r].sort((a, b) => calcHybridScore(b) - calcHybridScore(a));
      });
      
      const rolesOrder = ['Arquero', 'Defensor', 'Mediocampo', 'Delantero'];
      
      rolesOrder.forEach(r => {
        const players = grouped[r];
        players.forEach(p => {
          const diffSize = tA.length - tB.length;
          if (diffSize === 0) {
            if (sumA <= sumB) {
              tA.push(p);
              sumA += calcHybridScore(p);
            } else {
              tB.push(p);
              sumB += calcHybridScore(p);
            }
          } else if (diffSize < 0) {
            tA.push(p);
            sumA += calcHybridScore(p);
          } else {
            tB.push(p);
            sumB += calcHybridScore(p);
          }
        });
      });

      setTeamA(tA);
      setTeamB(tB);
      setActiveEvent(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'preview',
          teamA: tA,
          teamB: tB,
          pitchCost: pitchCost,
          paymentsMap: paymentsMap
        };
      });

      const allBalanced = [...tA, ...tB];
      let bestPlayer = null;
      let highestOvr = -1;
      allBalanced.forEach(p => {
        const ovr = calcOvr(p);
        if (ovr > highestOvr) {
          highestOvr = ovr;
          bestPlayer = p;
        }
      });
      setWalkoutPlayer(bestPlayer);

      setIsLoading(false);
      setShowPackOpening(true);
      setWalkoutRevealStage(0);
    }, 600);
  };

  const balanceTeamsRandomlyByRole = (useLobby = true) => {
    setIsLoading(true);
    setTimeout(() => {
      let pool = [];
      if (useLobby) {
        // Limpiar duplicados por nombre
        const uniqueMap = {};
        eventRegistrations.forEach(r => { if (r && r.name) { const key = r.id || r.name.toLowerCase().trim(); uniqueMap[key] = r; } });
        const finalRegs = Object.values(uniqueMap).slice(0, activeEvent?.format || 100);

        if (finalRegs.length < 8) {
          alert("No se puede armar equipos con menos de 8 jugadores inscriptos.");
          setIsLoading(false);
          return;
        }

        pool = finalRegs.map(reg => {
          const existingPlayer = roster.find(p => p && p.name && reg && reg.name && p.name.toLowerCase().trim() === reg.name.toLowerCase().trim());
          return {
            id: existingPlayer ? existingPlayer.id : (reg.id || Math.random().toString(36).substr(2, 9)),
            player_id: reg.player_id || (existingPlayer ? existingPlayer.player_id : null),
            name: reg.name,
            role: reg.role,
            avatar: reg.avatar || (existingPlayer ? existingPlayer.avatar : '👤'),
            stats: reg.stats, 
            history: existingPlayer ? existingPlayer.history : { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 },
            glicko: existingPlayer ? existingPlayer.glicko : { rating: 1500, rd: 350, vol: 0.06 },
            financial: existingPlayer ? existingPlayer.financial : { debt: 0, isBanned: false },
            condition: existingPlayer ? existingPlayer.condition : { stamina: 100 }
          };
        });
      } else {
        pool = roster.filter(p => !p.condition?.isResting);
      }
      
      const mapRole = (r) => {
         if (r === 'Ancla') return 'Defensor';
         if (r === 'Creativo') return 'Mediocampo';
         if (r === 'Finalizador') return 'Delantero';
         if (r === 'Capitán') return 'Mediocampo';
         return r;
      };
      
      const tA = [];
      const tB = [];
      let sumA = 0;
      let sumB = 0;
      
      const activePool = pool.filter(p => p);
      
      const grouped = {
        Arquero: [],
        Defensor: [],
        Mediocampo: [],
        Delantero: []
      };
      
      activePool.forEach(p => {
        const r = mapRole(p.role);
        if (grouped[r]) grouped[r].push(p);
        else grouped.Mediocampo.push(p);
      });
      
      Object.keys(grouped).forEach(r => {
        grouped[r].sort((a, b) => calcHybridScore(b) - calcHybridScore(a));
      });
      
      const rolesOrder = ['Arquero', 'Defensor', 'Mediocampo', 'Delantero'];
      
      rolesOrder.forEach(r => {
        const players = grouped[r];
        // Procesar en parejas con valoraciones generales OVR similares
        for (let i = 0; i < players.length; i += 2) {
          if (i + 1 < players.length) {
            const p1 = players[i];
            const p2 = players[i+1];
            const score1 = calcHybridScore(p1);
            const score2 = calcHybridScore(p2);
            
            const diffSize = tA.length - tB.length;
            const p1ToA = Math.random() < 0.5;
            
            if (diffSize === 0) {
              if (p1ToA) {
                tA.push(p1);
                tB.push(p2);
                sumA += score1;
                sumB += score2;
              } else {
                tA.push(p2);
                tB.push(p1);
                sumA += score2;
                sumB += score1;
              }
            } else if (diffSize < 0) {
              // tA tiene menos jugadores. Buscamos equilibrar la suma MMR/OVR
              const diffX = Math.abs((sumA + score1) - (sumB + score2));
              const diffY = Math.abs((sumA + score2) - (sumB + score1));
              
              if (diffX < diffY) {
                tA.push(p1);
                tB.push(p2);
                sumA += score1;
                sumB += score2;
              } else if (diffY < diffX) {
                tA.push(p2);
                tB.push(p1);
                sumA += score2;
                sumB += score1;
              } else {
                if (p1ToA) {
                  tA.push(p1);
                  tB.push(p2);
                  sumA += score1;
                  sumB += score2;
                } else {
                  tA.push(p2);
                  tB.push(p1);
                  sumA += score2;
                  sumB += score1;
                }
              }
            } else {
              // tB tiene menos jugadores
              const diffX = Math.abs((sumA + score2) - (sumB + score1));
              const diffY = Math.abs((sumA + score1) - (sumB + score2));
              
              if (diffX < diffY) {
                tB.push(p1);
                tA.push(p2);
                sumB += score1;
                sumA += score2;
              } else if (diffY < diffX) {
                tB.push(p2);
                tA.push(p1);
                sumB += score2;
                sumA += score1;
              } else {
                if (p1ToA) {
                  tB.push(p1);
                  tA.push(p2);
                  sumB += score1;
                  sumA += score2;
                } else {
                  tB.push(p2);
                  tA.push(p1);
                  sumB += score2;
                  sumA += score1;
                }
              }
            }
          } else {
            // Jugador impar
            const p = players[i];
            const score = calcHybridScore(p);
            const diffSize = tA.length - tB.length;
            if (diffSize === 0) {
              if (sumA <= sumB) {
                tA.push(p);
                sumA += score;
              } else {
                tB.push(p);
                sumB += score;
              }
            } else if (diffSize < 0) {
              tA.push(p);
              sumA += score;
            } else {
              tB.push(p);
              sumB += score;
            }
          }
        }
      });
      
      setTeamA(tA);
      setTeamB(tB);
      setActiveEvent(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'preview',
          teamA: tA,
          teamB: tB,
          pitchCost: pitchCost,
          paymentsMap: paymentsMap
        };
      });
      
      const allBalanced = [...tA, ...tB];
      let bestPlayer = null;
      let highestOvr = -1;
      allBalanced.forEach(p => {
        const ovr = calcOvr(p);
        if (ovr > highestOvr) {
          highestOvr = ovr;
          bestPlayer = p;
        }
      });
      setWalkoutPlayer(bestPlayer);
      
      setIsLoading(false);
      setShowPackOpening(true);
      setWalkoutRevealStage(0);
      setViewMode('builder');
    }, 600);
  };

  const movePlayerToTeam = (player, targetTeam) => {
    let newA = [...teamA];
    let newB = [...teamB];
    
    if (targetTeam === 'A') {
      if (newA.some(x => x.id === player.id)) return;
      newB = newB.filter(x => x.id !== player.id);
      newA.push(player);
    } else {
      if (newB.some(x => x.id === player.id)) return;
      newA = newA.filter(x => x.id !== player.id);
      newB.push(player);
    }
    
    setTeamA(newA);
    setTeamB(newB);
    setActiveEvent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        teamA: newA,
        teamB: newB
      };
    });
  };

  useEffect(() => {
    if (isDrafting) {
      const totalPlayers = teamA.length + teamB.length;
      if (revealedCount < totalPlayers) {
        const timer = setTimeout(() => {
          setRevealedCount(prev => prev + 1);
        }, 400);
        return () => clearTimeout(timer);
      } else {
        setIsDrafting(false);
      }
    }
  }, [isDrafting, revealedCount, teamA.length, teamB.length]);

  const startMatch = () => {
    setMatchScore({ A: 0, B: 0 });
    setPlayerGoals({});
    setViewMode('match');
    setActiveEvent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'match',
        matchScore: { A: 0, B: 0 },
        playerGoals: {}
      };
    });
  };

  const addGoal = (teamId, playerId) => {
    const goalsToAdd = (playerGoals[playerId] || 0) + 1;
    setPlayerGoals(prev => ({ ...prev, [playerId]: goalsToAdd }));
    setMatchScore(prev => {
      const newScore = { ...prev, [teamId]: prev[teamId] + 1 };
      setActiveEvent(curr => {
        if (!curr) return null;
        return {
          ...curr,
          matchScore: newScore,
          playerGoals: { ...curr.playerGoals, [playerId]: goalsToAdd }
        };
      });
      return newScore;
    });
  };

  const removeGoal = (teamId, playerId) => {
    if ((playerGoals[playerId] || 0) > 0) {
      const goalsToSub = playerGoals[playerId] - 1;
      setPlayerGoals(prev => ({ ...prev, [playerId]: goalsToSub }));
      setMatchScore(prev => {
        const newScore = { ...prev, [teamId]: Math.max(0, prev[teamId] - 1) };
        setActiveEvent(curr => {
          if (!curr) return null;
          return {
            ...curr,
            matchScore: newScore,
            playerGoals: { ...curr.playerGoals, [playerId]: goalsToSub }
          };
        });
        return newScore;
      });
    }
  };

  const finishMatch = () => {
    const winner = matchScore.A > matchScore.B ? 'A' : (matchScore.B > matchScore.A ? 'B' : 'Draw');
    
    // Glicko-2 Logic
    const settings = { tau: 0.5, rating: 1500, rd: 350, vol: 0.06 };
    const ranking = new glicko2.Glicko2(settings);
    
    const teamAPlayers = teamA.map(p => ({ p, g: ranking.makePlayer(p.glicko?.rating || 1500, p.glicko?.rd || 350, p.glicko?.vol || 0.06) }));
    const teamBPlayers = teamB.map(p => ({ p, g: ranking.makePlayer(p.glicko?.rating || 1500, p.glicko?.rd || 350, p.glicko?.vol || 0.06) }));

    const avgRatingA = teamAPlayers.reduce((sum, obj) => sum + obj.g.getRating(), 0) / (teamAPlayers.length || 1);
    const avgRdA = teamAPlayers.reduce((sum, obj) => sum + obj.g.getRd(), 0) / (teamAPlayers.length || 1);
    
    const avgRatingB = teamBPlayers.reduce((sum, obj) => sum + obj.g.getRating(), 0) / (teamBPlayers.length || 1);
    const avgRdB = teamBPlayers.reduce((sum, obj) => sum + obj.g.getRd(), 0) / (teamBPlayers.length || 1);

    const compA = ranking.makePlayer(avgRatingA, avgRdA, 0.06);
    const compB = ranking.makePlayer(avgRatingB, avgRdB, 0.06);

    const matches = [];
    if (winner === 'A') {
       teamAPlayers.forEach(a => matches.push([a.g, compB, 1]));
       teamBPlayers.forEach(b => matches.push([b.g, compA, 0]));
    } else if (winner === 'B') {
       teamAPlayers.forEach(a => matches.push([a.g, compB, 0]));
       teamBPlayers.forEach(b => matches.push([b.g, compA, 1]));
    } else {
       teamAPlayers.forEach(a => matches.push([a.g, compB, 0.5]));
       teamBPlayers.forEach(b => matches.push([b.g, compA, 0.5]));
    }

    ranking.updateRatings(matches);

    const newGlickoMap = {};
    [...teamAPlayers, ...teamBPlayers].forEach(obj => {
       newGlickoMap[obj.p.id] = { rating: obj.g.getRating(), rd: obj.g.getRd(), vol: obj.g.getVol() };
    });

    const updatedRoster = [...roster];
    
    const currentQuota = pitchCost && (teamA.length + teamB.length) > 0 ? (parseFloat(pitchCost) / (teamA.length + teamB.length)) : 0;
    
    // Calculate MVP of this match (highest goal scorer)
    let mvpId = null;
    let maxGoals = 0;
    Object.entries(playerGoals).forEach(([id, goals]) => {
       if (goals > maxGoals) {
          maxGoals = goals;
          mvpId = id;
       }
    });

    [...teamA, ...teamB].forEach(matchPlayer => {
       const existingIndex = updatedRoster.findIndex(p => p.id === matchPlayer.id || (p.name && matchPlayer.name && p.name.toLowerCase() === matchPlayer.name.toLowerCase()));
       
       const inA = teamA.some(a => a.id === matchPlayer.id);
       const inB = teamB.some(b => b.id === matchPlayer.id);
       const winnerMatches = (inA && winner === 'A') || (inB && winner === 'B');
       
       let debt = currentQuota > 0 && !paymentsMap[matchPlayer.id] ? currentQuota : 0;
       const staminaLoss = Math.floor(Math.random() * 16 + 15);
       
       const newRating = newGlickoMap[matchPlayer.id]?.rating || (existingIndex >= 0 ? updatedRoster[existingIndex].glicko?.rating : 1500) || 1500;
       const isMvp = matchPlayer.id === mvpId;

       const prevStats = (existingIndex >= 0 ? updatedRoster[existingIndex].stats : matchPlayer.stats) || { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 };
       let newStats = { ...prevStats };
       
       if (winnerMatches) {
         newStats.pac = Math.min(99, newStats.pac + 1);
         newStats.sho = Math.min(99, newStats.sho + 1);
         newStats.pas = Math.min(99, newStats.pas + 1);
         newStats.dri = Math.min(99, newStats.dri + 1);
         newStats.def = Math.min(99, newStats.def + 1);
         newStats.phy = Math.min(99, newStats.phy + 1);
       }
       const goalsScored = playerGoals[matchPlayer.id] || 0;
       if (goalsScored > 0) {
         newStats.sho = Math.min(99, newStats.sho + goalsScored);
       }

       if (existingIndex >= 0) {
          const ep = updatedRoster[existingIndex];
          const prevHistory = ep.glicko?.history || [1500];
          updatedRoster[existingIndex] = {
             ...ep,
             player_id: matchPlayer.player_id || ep.player_id || null,
             lastMatchDate: new Date().toISOString(),
             stats: newStats,
             history: { 
                 pj: (ep.history?.pj || 0) + 1, 
                 pg: (ep.history?.pg || 0) + (winnerMatches ? 1 : 0), 
                 pe: (ep.history?.pe || 0) + (winner === 'Draw' ? 1 : 0),
                 pp: (ep.history?.pp || 0) + ((!winnerMatches && winner !== 'Draw') ? 1 : 0),
                 goals: (ep.history?.goals || 0) + goalsScored,
                 mvpCount: (ep.history?.mvpCount || 0) + (isMvp ? 1 : 0)
             },
             glicko: {
                 ...(newGlickoMap[matchPlayer.id] || ep.glicko),
                 history: [...prevHistory, newRating]
             },
             financial: { 
                 debt: (ep.financial?.debt || 0) + debt, 
                 isBanned: ((ep.financial?.debt || 0) + debt) > 0 
             },
             condition: { 
                 stamina: Math.max(0, (ep.condition?.stamina ?? 100) - staminaLoss) 
             }
          };
       } else {
          updatedRoster.push({
             ...matchPlayer,
             lastMatchDate: new Date().toISOString(),
             stats: newStats,
             history: { 
                 pj: 1, 
                 pg: winnerMatches ? 1 : 0, 
                 pe: winner === 'Draw' ? 1 : 0,
                 pp: (!winnerMatches && winner !== 'Draw') ? 1 : 0,
                 goals: goalsScored,
                 mvpCount: isMvp ? 1 : 0
             },
             glicko: {
                 ...(newGlickoMap[matchPlayer.id] || { rating: 1500, rd: 350, vol: 0.06 }),
                 history: [1500, newRating]
             },
             financial: { debt, isBanned: debt > 0 },
             condition: { stamina: Math.max(0, 100 - staminaLoss) }
          });
       }
    });

    const finalRoster = updatedRoster.map(p => {
       const played = teamA.some(a => a.id === p.id) || teamB.some(b => b.id === p.id);
       if (!played) {
          return { ...p, condition: { stamina: Math.min(100, (p.condition?.stamina ?? 100) + 40) } };
       }
       return p;
    });

    setRoster(finalRoster);
    const resultObj = { id: Date.now(), date: new Date().toISOString(), teamA, teamB, matchScore, playerGoals, winner };
    setLastMatchResult(resultObj);
    setMatchHistory(prev => [resultObj, ...prev]);
    setPitchCost('');
    setPaymentsMap({});
    setTeamA([]);
    setTeamB([]);
    setMatchScore({ A: 0, B: 0 });
    setPlayerGoals({});
    setViewMode('stats');
    
    if (activeEvent) {
       setActiveEvent(null);
       setEventRegistrations([]);
       if (isSupabaseConfigured && supabase) supabase.from('event_registrations').delete().eq('host_id', hostId).then();
    }
  };

  const getTeamRating = (team) => team.length === 0 ? 0 : (team.reduce((acc, p) => acc + calcOvr(p), 0) / team.length).toFixed(1);

  // WHATSAPP GENERATORS
  const getAvatarChar = (av) => (av && av.startsWith('data:image')) ? '👤' : (av || '👤');

  const shareTeamsWA = () => {
    const text = `🏆 *FULBO MATCHMAKING* 🏆\n\n🔵 *EQUIPO A (OVR: ${getTeamRating(teamA)})*\n${teamA.map(p => `• ${getAvatarChar(p.avatar)} ${p.name} (${p.role})`).join('\n')}\n\n🔴 *EQUIPO B (OVR: ${getTeamRating(teamB)})*\n${teamB.map(p => `• ${getAvatarChar(p.avatar)} ${p.name} (${p.role})`).join('\n')}\n\n👉 Generado por la IA de Fulbo`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareResultWA = () => {
    if (!lastMatchResult) return;
    const { matchScore: ms, playerGoals: pg, winner, teamA, teamB } = lastMatchResult;
    
    let mvp = null;
    let maxGoals = 0;
    Object.entries(pg).forEach(([id, goals]) => {
       if (goals > maxGoals) {
          maxGoals = goals;
          mvp = roster.find(r => r.id === id);
       }
    });

    const diff = Math.abs(ms.A - ms.B);
    let narrative = "";

    if (winner === 'Draw') {
      narrative = `⚔️ ¡Épico empate a ${ms.A} goles! Ambos equipos dejaron la vida en la cancha y la paridad táctica fue absoluta.`;
    } else {
      const wTeam = winner === 'A' ? 'Equipo A' : 'Equipo B';
      const lTeam = winner === 'A' ? 'Equipo B' : 'Equipo A';
      
      if (diff >= 3) {
        narrative = `🔥 ¡DOMINIO ABSOLUTO! El ${wTeam} pasó por encima al ${lTeam} con una goleada de ${Math.max(ms.A, ms.B)} a ${Math.min(ms.A, ms.B)}. Una masterclass táctica.`;
      } else if (diff === 1) {
        narrative = `⚡ ¡DRAMA HASTA EL FINAL! El ${wTeam} se llevó la victoria por un ajustado ${Math.max(ms.A, ms.B)} a ${Math.min(ms.A, ms.B)} en un duelo de infarto.`;
      } else {
        narrative = `💥 ¡SÓLIDA VICTORIA! El ${wTeam} controló los tiempos y superó al ${lTeam} con un contundente ${Math.max(ms.A, ms.B)} a ${Math.min(ms.A, ms.B)}.`;
      }
    }

    if (mvp) {
       narrative += `\n\n⭐ *MVP:* La figura de la cancha fue ${mvp.name}, quien destrozó las redes con ${maxGoals} gol(es).`;
    }

    const scorersText = Object.entries(pg).filter(([_, g]) => g > 0).map(([id, goals]) => {
      const p = roster.find(r => r.id === id);
      return p ? `• ${p.name}: ${goals} ⚽` : '';
    }).join('\n');

    const text = `⚽ *CRÓNICA OFICIAL - FULBO* ⚽\n\n${narrative}\n\n📊 *MARCADOR FINAL*\n🏆 *Equipo A:* ${ms.A}\n💀 *Equipo B:* ${ms.B}\n\n${scorersText ? `🔥 *Goleadores:*\n${scorersText}\n` : ''}\n👉 Organizado en *Fulbo App*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const inputStyle = { background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--pure-white)', padding: '0.6rem', borderRadius: '6px', width: '100%', fontFamily: 'var(--font-secondary)' };
  const btnSec = { background: 'transparent', border: '1px solid var(--electric-cyan)', color: 'var(--electric-cyan)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-primary)' };

  // --- RENDERS ---

  const isSubscriptionExpired = () => {
    if (userEmail === 'chris.r.lemos@gmail.com') return false;
    if (subscriptionChecking) return false;
    if (subscriptionStatus !== 'active') return true;
    if (subscriptionEndsAt && new Date(subscriptionEndsAt) < new Date()) return true;
    return false;
  };

  if (!subscriptionChecking && isSubscriptionExpired()) {
    const handlePaySubscription = async () => {
      try {
        setIsLoading(true);
        const redirectUrl = `${window.location.origin}/?subscription_payment=approved&host_id=${hostId}`;
        const response = await fetch('/api/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostId, redirectUrl })
        });
        const data = await response.json();
        if (response.ok && data.initPoint) {
          window.location.href = data.initPoint;
        } else {
          alert("Error al conectar con Mercado Pago: " + (data.error || "Inténtalo más tarde."));
        }
      } catch (err) {
        console.error(err);
        alert("Error al conectar con la pasarela.");
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pitch-black)', padding: '1rem' }}>
        <div className="glass-panel" style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '3.5rem 2rem', borderTop: '4px solid var(--crimson-red)', animation: 'fadeIn 0.5s ease-out', boxShadow: '0 0 30px rgba(255,0,85,0.2)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 className="glow-text-volt" style={{ color: 'var(--crimson-red)', textShadow: '0 0 15px rgba(255,0,85,0.4)', fontSize: '2.2rem', marginBottom: '1.5rem' }}>SERVICIO SUSPENDIDO</h2>
          
          <p style={{ color: 'var(--pure-white)', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Tu período de prueba o suscripción mensual a FULBO ha caducado o se encuentra inactivo. Para continuar administrando tus torneos, balanceando equipos con IA y cobrando cuotas, activa tu plan premium.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem' }}>
            <span style={{ color: 'var(--off-white)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.3rem' }}>Plan Profesional Mensual</span>
            <span style={{ color: 'var(--ultimate-gold)', fontSize: '1.8rem', fontWeight: '900', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>$9.999 ARS / mes</span>
            <span style={{ color: 'var(--off-white)', fontSize: '0.7rem', display: 'block', marginTop: '0.5rem' }}>* Incluye matchmaking ilimitado de hasta 15 invitados por partido.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn-primary" onClick={handlePaySubscription} disabled={isLoading} style={{ borderColor: 'var(--volt-lime)', color: 'black', background: 'var(--volt-lime)', boxShadow: '0 0 25px rgba(204,255,0,0.3)', padding: '1.2rem', fontSize: '1.2rem' }}>
              {isLoading ? 'CREANDO ENLACE...' : '💳 ACTIVAR CON MERCADO PAGO'}
            </button>
            <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--off-white)', color: 'var(--off-white)', padding: '0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Cerrar Sesión / Usar otra cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERS ---

  if (viewMode === 'active_matches') {
    // Limpiar duplicados por nombre
    const uniqueRegistrationsMap = {};
    eventRegistrations.forEach(r => {
      if (r && r.name) {
        const key = r.id || r.name.toLowerCase().trim();
        uniqueRegistrationsMap[key] = r;
      }
    });
    const uniqueRegistrations = Object.values(uniqueRegistrationsMap).slice(0, activeEvent?.format || 100);

    return (
      <div className="page-container" style={{ maxWidth: '1000px', animation: 'fadeIn 0.5s' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="glow-text-volt" style={{ fontSize: '3.5rem', margin: 0 }}>PARTIDOS CREADOS</h1>
          <p style={{ color: 'var(--off-white)', letterSpacing: '3px' }}>Convocatorias activas y partidos en curso</p>
          
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setViewMode('builder')} style={{ width: 'auto' }}>VOLVER AL ARMADO</button>
            <button onClick={() => setViewMode('stats')} style={btnSec}>🏆 LEADERBOARD</button>
            <button onClick={() => setViewMode('history')} style={btnSec}>📚 HISTÓRICO</button>
          </div>
        </header>

        {activeEvent ? (
          <div className="glass-panel" style={{ padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{
                  background: activeEvent.status === 'lobby' ? 'var(--volt-lime)' : (activeEvent.status === 'preview' ? 'var(--ultimate-gold)' : 'var(--crimson-red)'),
                  color: 'black',
                  padding: '0.2rem 0.8rem',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase'
                }}>
                  {activeEvent.status === 'lobby' ? 'Lobby Abierto' : (activeEvent.status === 'preview' ? 'Equipos Listos' : 'En Juego ⚽')}
                </span>
                <h2 style={{ color: 'white', marginTop: '0.5rem', marginBottom: 0 }}>
                  Partido del {activeEvent.date} a las {activeEvent.time}
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--off-white)', fontSize: '0.8rem' }}>Formato</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--electric-cyan)' }}>
                  {activeEvent.format} Jugadores ({activeEvent.format/2}v{activeEvent.format/2})
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h3 style={{ color: 'var(--volt-lime)', marginBottom: '1rem' }}>Cupo y Asistencia</h3>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                    <span style={{ color: 'var(--off-white)' }}>Confirmados:</span>
                    <strong style={{ color: 'white' }}>{uniqueRegistrations.length} / {activeEvent.format}</strong>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem' }}>
                    <div style={{
                      width: `${Math.min(100, (uniqueRegistrations.length / activeEvent.format) * 100)}%`,
                      height: '100%',
                      background: uniqueRegistrations.length >= activeEvent.format ? 'var(--crimson-red)' : 'var(--volt-lime)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--off-white)' }}>Vacantes disponibles:</span>
                    <strong className="glow-text-volt" style={{ color: uniqueRegistrations.length >= activeEvent.format ? 'var(--crimson-red)' : 'var(--volt-lime)' }}>
                      {Math.max(0, activeEvent.format - uniqueRegistrations.length)}
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {activeEvent.status === 'lobby' && (
                    <button 
                      onClick={() => balanceTeamsRandomlyByRole(true)} 
                      className="btn-primary" 
                      disabled={isLoading || uniqueRegistrations.length < 8}
                      style={{ background: 'linear-gradient(135deg, var(--ultimate-gold) 0%, #FFA500 100%)', color: 'black', fontWeight: 'bold', border: 'none' }}
                    >
                      🎲 ARMAR EQUIPOS ALEATORIOS POR ROL
                    </button>
                  )}
                  {activeEvent.status === 'preview' && (
                    <>
                      <button 
                        onClick={() => balanceTeamsRandomlyByRole(true)} 
                        className="btn-primary" 
                        disabled={isLoading || uniqueRegistrations.length < 8}
                        style={{ background: 'linear-gradient(135deg, var(--ultimate-gold) 0%, #FFA500 100%)', color: 'black', fontWeight: 'bold', border: 'none' }}
                      >
                        🎲 RE-ARMAR ALEATORIO
                      </button>
                      <button 
                        onClick={() => balanceTeamsLocally(true)} 
                        className="btn-primary" 
                        disabled={isLoading || uniqueRegistrations.length < 8}
                      >
                        🔄 RE-ARMAR POR ROL
                      </button>
                    </>
                  )}
                  <button onClick={copyLeagueLink} className="btn-primary" style={{ background: 'transparent', borderColor: 'var(--electric-cyan)', color: 'var(--electric-cyan)' }}>
                    🔗 COMPARTIR ENLACE DE INVITACIÓN
                  </button>
                  <button onClick={() => setViewMode('builder')} className="btn-primary">
                    ⚙️ IR A LA ADMINISTRACIÓN DEL PARTIDO
                  </button>
                </div>
              </div>

              <div>
                {activeEvent.status === 'lobby' ? (
                  <>
                    <h3 style={{ color: 'var(--electric-cyan)', marginBottom: '1rem' }}>Jugadores Convocados ({uniqueRegistrations.length})</h3>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '300px', overflowY: 'auto' }}>
                      {uniqueRegistrations.length === 0 ? (
                        <p style={{ color: 'var(--off-white)', textAlign: 'center', margin: '2rem 0' }}>Nadie se ha registrado en el lobby aún.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {uniqueRegistrations.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>{r.avatar || '👤'}</span>
                                <span style={{ color: 'white', fontWeight: 'bold' }}>{r.name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--off-white)', fontSize: '0.8rem' }}>{r.role}</span>
                                <button 
                                  onClick={() => removePlayerFromEvent(r.name, r.id)} 
                                  style={{ background: 'transparent', border: 'none', color: 'var(--crimson-red)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', padding: '0 0.2rem' }}
                                  title="Quitar del Lobby"
                                >
                                  ❌
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ color: 'var(--electric-cyan)', marginBottom: '1rem' }}>Equipos Armados</h3>
                    <div className="responsive-flex" style={{ display: 'flex', position: 'relative', alignItems: 'center', gap: '1rem' }}>
                      {/* Team A */}
                      <div className="team-column-a" style={{ background: 'rgba(204,255,0,0.03)', border: '1px solid rgba(204,255,0,0.1)', padding: '1rem', borderRadius: '8px', width: '100%' }}>
                        <h4 className="glow-text-volt" style={{ margin: '0 0 0.6rem 0', fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'center' }}>EQUIPO A (OVR: {getTeamRating(teamA)})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {teamA.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.85rem', color: 'white' }}>{p.avatar || '👤'} {p.name} <span style={{ color: 'var(--off-white)', fontSize: '0.75rem' }}>({p.role.substring(0,3).toUpperCase()})</span></span>
                              {activeEvent.status === 'preview' && (
                                <button 
                                  onClick={() => movePlayerToTeam(p, 'B')} 
                                  style={{ background: 'transparent', border: 'none', color: 'var(--volt-lime)', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  Mover a B ➔
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* VS Divider */}
                      <div className="responsive-hidden" style={{ width: '45px', height: '45px', background: 'var(--pitch-black)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 0 15px rgba(0,0,0,0.8)', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: '900', fontSize: '1rem', color: 'var(--pure-white)' }}>VS</span>
                      </div>

                      {/* Team B */}
                      <div className="team-column-b" style={{ background: 'rgba(0,240,255,0.03)', border: '1px solid rgba(0,240,255,0.1)', padding: '1rem', borderRadius: '8px', width: '100%' }}>
                        <h4 className="glow-text-cyan" style={{ margin: '0 0 0.6rem 0', fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'center' }}>EQUIPO B (OVR: {getTeamRating(teamB)})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {teamB.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.85rem', color: 'white' }}>{p.avatar || '👤'} {p.name} <span style={{ color: 'var(--off-white)', fontSize: '0.75rem' }}>({p.role.substring(0,3).toUpperCase()})</span></span>
                              {activeEvent.status === 'preview' && (
                                <button 
                                  onClick={() => movePlayerToTeam(p, 'A')} 
                                  style={{ background: 'transparent', border: 'none', color: 'var(--electric-cyan)', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  &larr; Mover a A
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <span style={{ fontSize: '4rem' }}>📅</span>
            <h2 style={{ color: 'white', marginTop: '1.5rem' }}>No hay ningún partido creado activo</h2>
            <p style={{ color: 'var(--off-white)', maxWidth: '400px', margin: '0.5rem auto 1.5rem auto' }}>
              Crea un evento en la pestaña de Armado para abrir la convocatoria y permitir que los jugadores se registren.
            </p>
            <button onClick={() => setViewMode('builder')} className="btn-primary" style={{ width: 'auto', padding: '1rem 2.5rem' }}>
              CREAR PARTIDO AHORA
            </button>
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'history') {
    return (
      <div className="page-container" style={{ maxWidth: '1000px', animation: 'fadeIn 0.5s' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="glow-text-volt" style={{ fontSize: '3.5rem', margin: 0 }}>HISTÓRICO</h1>
          <p style={{ color: 'var(--off-white)', letterSpacing: '3px' }}>Registro de todos los partidos disputados</p>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setViewMode('builder')} style={{ width: 'auto' }}>VOLVER AL ARMADO</button>
            <button onClick={() => setViewMode('stats')} style={btnSec}>🏆 LEADERBOARD</button>
          </div>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {matchHistory.length === 0 ? (
             <p style={{ textAlign: 'center', color: 'var(--off-white)', fontSize: '1.2rem', marginTop: '2rem' }}>No hay partidos registrados aún.</p>
          ) : (
            matchHistory.map((match, idx) => {
              const dateStr = new Date(match.date).toLocaleDateString() + ' ' + new Date(match.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              return (
                <div key={match.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: match.winner === 'A' ? '4px solid var(--volt-lime)' : (match.winner === 'B' ? '4px solid var(--electric-cyan)' : '4px solid gray') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--off-white)', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                    <span>Partido #{matchHistory.length - idx}</span>
                    <span>{dateStr}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <h4 style={{ margin: 0, color: 'var(--volt-lime)', fontSize: '1.2rem' }}>Equipo A</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--off-white)', marginTop: '0.5rem' }}>
                        {match.teamA.map(p => p.name).join(', ')}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 2rem' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: '900', fontFamily: 'var(--font-primary)', color: match.winner === 'A' ? 'var(--volt-lime)' : 'white' }}>{match.matchScore.A}</span>
                      <span style={{ fontSize: '1.2rem', color: 'var(--off-white)' }}>-</span>
                      <span style={{ fontSize: '2.5rem', fontWeight: '900', fontFamily: 'var(--font-primary)', color: match.winner === 'B' ? 'var(--electric-cyan)' : 'white' }}>{match.matchScore.B}</span>
                    </div>

                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <h4 style={{ margin: 0, color: 'var(--electric-cyan)', fontSize: '1.2rem' }}>Equipo B</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--off-white)', marginTop: '0.5rem' }}>
                        {match.teamB.map(p => p.name).join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {renderPlayerDetailsModal()}
      </div>
    );
  }

  if (viewMode === 'dreamteam') {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const activeThisMonth = roster.filter(p => {
      if (!p.lastMatchDate) return false;
      const d = new Date(p.lastMatchDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    // Fallback to all-time if no one played this month just so it's not empty, but ideally just this month.
    const playersToRank = activeThisMonth.length >= 5 ? activeThisMonth : roster;
    const topPlayers = [...playersToRank].sort((a,b) => calcHybridScore(b) - calcHybridScore(a)).slice(0, 5);

    return (
      <div className="page-container" style={{ maxWidth: '1000px', animation: 'fadeIn 0.5s' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="glow-text-volt" style={{ fontSize: '3.5rem', margin: 0 }}>🏆 DREAM TEAM</h1>
          <p style={{ color: 'var(--off-white)', letterSpacing: '3px' }}>LOS 5 MEJORES JUGADORES DEL MES</p>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setViewMode('builder')} style={{ width: 'auto' }}>VOLVER AL ARMADO</button>
          </div>
        </header>

        <div style={{ position: 'relative', height: '600px', background: 'radial-gradient(circle, rgba(204,255,0,0.1) 0%, rgba(0,0,0,0.8) 70%)', border: '2px solid var(--volt-lime)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', boxShadow: '0 0 50px rgba(204,255,0,0.2)' }}>
          <div style={{ position: 'absolute', top: '5%', transform: 'scale(1.2)', zIndex: 5, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.6))' }}>
            {topPlayers[0] && <PlayerCard name={topPlayers[0].name} position={topPlayers[0].role.substring(0,3).toUpperCase()} stats={topPlayers[0].stats} avatar={topPlayers[0].avatar} ovr={calcOvr(topPlayers[0])} badges={getPlayerBadges(topPlayers[0])} />}
          </div>
          <div style={{ position: 'absolute', top: '35%', left: '15%', zIndex: 4 }}>
            {topPlayers[1] && <PlayerCard name={topPlayers[1].name} position={topPlayers[1].role.substring(0,3).toUpperCase()} stats={topPlayers[1].stats} avatar={topPlayers[1].avatar} ovr={calcOvr(topPlayers[1])} badges={getPlayerBadges(topPlayers[1])} />}
          </div>
          <div style={{ position: 'absolute', top: '35%', right: '15%', zIndex: 4 }}>
            {topPlayers[2] && <PlayerCard name={topPlayers[2].name} position={topPlayers[2].role.substring(0,3).toUpperCase()} stats={topPlayers[2].stats} avatar={topPlayers[2].avatar} ovr={calcOvr(topPlayers[2])} badges={getPlayerBadges(topPlayers[2])} />}
          </div>
          <div style={{ position: 'absolute', bottom: '10%', left: '25%', zIndex: 3 }}>
            {topPlayers[3] && <PlayerCard name={topPlayers[3].name} position={topPlayers[3].role.substring(0,3).toUpperCase()} stats={topPlayers[3].stats} avatar={topPlayers[3].avatar} ovr={calcOvr(topPlayers[3])} badges={getPlayerBadges(topPlayers[3])} />}
          </div>
          <div style={{ position: 'absolute', bottom: '10%', right: '25%', zIndex: 3 }}>
            {topPlayers[4] && <PlayerCard name={topPlayers[4].name} position={topPlayers[4].role.substring(0,3).toUpperCase()} stats={topPlayers[4].stats} avatar={topPlayers[4].avatar} ovr={calcOvr(topPlayers[4])} badges={getPlayerBadges(topPlayers[4])} />}
          </div>
        </div>
      </div>
    );
  }


  if (viewMode === 'hospital') {
    const injuredPlayers = roster.filter(p => p.condition?.isResting);

    return (
      <div className="page-container" style={{ maxWidth: '1000px', animation: 'fadeIn 0.5s' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="glow-text-volt" style={{ fontSize: '3.5rem', margin: 0, textShadow: '0 0 20px rgba(255,59,48,0.5)', color: '#FF3B30' }}>🏥 HOSPITAL</h1>
          <p style={{ color: 'var(--off-white)', letterSpacing: '3px' }}>Jugadores en proceso de recuperación médica</p>
        </header>

        {injuredPlayers.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1.5rem' }}>💚</span>
            <h2 style={{ color: 'white', marginBottom: '0.5rem' }}>¡Plantilla Completa y Saludable!</h2>
            <p style={{ color: 'var(--off-white)' }}>No hay ningún jugador registrado en el hospital en este momento.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
            {injuredPlayers.map(p => (
              <div key={p.id} className="glass-panel" style={{ border: '1px solid rgba(255, 59, 48, 0.3)', boxShadow: '0 8px 32px 0 rgba(255, 59, 48, 0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '1.5rem', filter: 'drop-shadow(0 0 5px rgba(255,59,48,0.5))' }}>🤕</div>
                {p.avatar && (
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', border: '2px solid rgba(255,59,48,0.3)' }}>
                    {p.avatar.startsWith('data:image') ? <img src={p.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span style={{fontSize:'2rem'}}>{p.avatar}</span>}
                  </div>
                )}
                <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '0.2rem' }}>{p.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--electric-cyan)', textTransform: 'uppercase', marginBottom: '1rem' }}>{p.role}</span>
                
                <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--off-white)', marginBottom: '0.3rem' }}>ENERGÍA / RECUPERACIÓN</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${p.condition?.stamina ?? 50}%`, height: '100%', background: '#FF3B30' }}></div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#FF3B30' }}>{p.condition?.stamina ?? 50}%</span>
                  </div>
                </div>

                <button 
                  onClick={() => healPlayer(p.id)} 
                  className="btn-primary" 
                  style={{ width: '100%', background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', color: 'white', border: 'none', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                >
                  ❤️ DAR ALTA
                </button>
              </div>
            ))}
          </div>
        )}
        {renderPlayerDetailsModal()}
      </div>
    );
  }

  if (viewMode === 'stats') {
    const filteredRoster = roster.filter(p => {
      if (leaderboardFilter === 'hospital') {
        return p.condition?.isResting === true;
      }
      
      if (p.condition?.isResting) return false;
      if ((p.history?.pj || 0) === 0) return false;

      const lastTime = p.lastMatchDate ? new Date(p.lastMatchDate).getTime() : Date.now();
      const isActive = (Date.now() - lastTime) < 30 * 24 * 60 * 60 * 1000;
      return leaderboardFilter === 'active' ? isActive : !isActive;
    });
    const sortedRoster = [...filteredRoster].sort((a, b) => {
      return (b.glicko?.rating || 1500) - (a.glicko?.rating || 1500);
    });

    return (
      <div className="page-container" style={{ maxWidth: '1000px', animation: 'fadeIn 0.5s' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="glow-text-volt" style={{ fontSize: '3.5rem', margin: 0 }}>LEADERBOARD MMR</h1>
          <p style={{ color: 'var(--off-white)', letterSpacing: '3px' }}>Rango Competitivo Oficial (Glicko-2)</p>
          
          {lastMatchResult && (
             <div style={{ marginTop: '1.5rem', animation: 'pulse 2s infinite' }}>
               <button onClick={shareResultWA} className="btn-primary" style={{ width: 'auto', fontSize: '1rem', padding: '1rem 2rem', background: '#25D366', color: 'white', borderColor: '#25D366', boxShadow: '0 0 20px rgba(37,211,102,0.5)' }}>
                  COMPARTIR RESULTADO EN WHATSAPP 📱
                </button>
             </div>
          )}

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setViewMode('builder')} style={{ width: 'auto' }}>VOLVER AL ARMADO</button>
            <button onClick={() => setViewMode('history')} style={btnSec}>📚 HISTÓRICO</button>
            <button onClick={() => { if(window.confirm('¿Borrar historial global?')) { setRoster(roster.map(p => ({...p, history:{pj:0,pg:0,pe:0,pp:0,goals:0}}))); } }} style={{...btnSec, borderColor: 'var(--crimson-red)', color: 'var(--crimson-red)'}}>RESETEAR TEMPORADA</button>
          </div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 2rem 0' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button 
              onClick={() => setLeaderboardFilter('active')} 
              style={{ 
                background: leaderboardFilter === 'active' ? 'linear-gradient(135deg, var(--volt-lime) 0%, #128C7E 100%)' : 'transparent', 
                color: leaderboardFilter === 'active' ? 'black' : 'var(--off-white)',
                border: 'none',
                borderRadius: '25px',
                padding: '0.6rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              🏃 JUGADORES ACTIVOS
            </button>
            <button 
              onClick={() => setLeaderboardFilter('inactive')} 
              style={{ 
                background: leaderboardFilter === 'inactive' ? 'linear-gradient(135deg, var(--crimson-red) 0%, #8b0000 100%)' : 'transparent', 
                color: leaderboardFilter === 'inactive' ? 'white' : 'var(--off-white)',
                border: 'none',
                borderRadius: '25px',
                padding: '0.6rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              💤 INACTIVOS (ÚLT. MES)
            </button>
            <button 
              onClick={() => setLeaderboardFilter('hospital')} 
              style={{ 
                background: leaderboardFilter === 'hospital' ? 'linear-gradient(135deg, #FF3B30 0%, #8b0000 100%)' : 'transparent', 
                color: leaderboardFilter === 'hospital' ? 'white' : 'var(--off-white)',
                border: 'none',
                borderRadius: '25px',
                padding: '0.6rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              🚑 HOSPITAL
            </button>
          </div>
        </div>

        <div className="glass-panel responsive-table-wrapper" style={{ padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--electric-cyan)' }}>#</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--pure-white)' }}>JUGADOR</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--off-white)', textAlign: 'center' }}>OVR</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--volt-lime)', textAlign: 'center' }}>MMR 📈</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--volt-lime)', textAlign: 'center' }}>PJ</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--volt-lime)', textAlign: 'center' }}>PG</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--volt-lime)', textAlign: 'center' }}>PE</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--volt-lime)', textAlign: 'center' }}>PP</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--ultimate-gold)', textAlign: 'center' }}>GOLES</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--electric-cyan)', textAlign: 'center' }}>WIN %</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoster.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '3rem', textAlign: 'center', color: 'var(--off-white)' }}>
                    No hay jugadores en esta categoría.
                  </td>
                </tr>
              ) : (
                sortedRoster.map((p, i) => {
                const pj = p.history?.pj || 0;
                const pg = p.history?.pg || 0;
                const pe = p.history?.pe || 0;
                const pp = p.history?.pp || 0;
                const winRate = pj > 0 ? Math.round((pg/pj)*100) : 0;
                const mmr = Math.round(p.glicko?.rating || 1500);
                return (
                  <tr key={p.id} className="clickable-row" onClick={() => setSelectedPlayerDetails(p)} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i%2===0?'transparent':'rgba(0,0,0,0.2)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold', fontSize: '1.2rem', color: i<3?'var(--ultimate-gold)':'var(--off-white)' }}>{i+1}</td>
                    <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{width:'35px', height:'35px', borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--pitch-black)'}}>
                        {p.avatar?.startsWith('data:image') ? <img src={p.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span>{p.avatar || '👤'}</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--off-white)' }}>{p.role}</div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>{calcOvr(p)}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--volt-lime)', fontWeight: '900', fontSize: '1.1rem', textShadow: '0 0 5px rgba(204,255,0,0.5)' }}>
                      {mmr} <span style={{ fontSize: '0.8rem', verticalAlign: 'middle', opacity: 0.7 }} title="Ver Historial Elo 📈">📈</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>{pj}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--volt-lime)', fontWeight: 'bold' }}>{pg}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--off-white)', opacity: 0.8 }}>{pe}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--crimson-red)', fontWeight: '500' }}>{pp}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--ultimate-gold)', fontWeight: 'bold' }}>{p.history?.goals || 0}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--electric-cyan)' }}>{winRate}%</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
        {renderPlayerDetailsModal()}
      </div>
    );
  }

  if (viewMode === 'match') {
    return (
      <div className="page-container" style={{ animation: 'fadeIn 0.5s' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-block', background: 'var(--crimson-red)', color: 'white', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
            ● LIVE MATCH
          </div>
        </header>

        <div className="glass-panel responsive-flex" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3rem', padding: '3rem', marginBottom: '3rem', border: '2px solid rgba(255,255,255,0.1)' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h2 className="glow-text-volt" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>EQUIPO A</h2>
            <div style={{ fontSize: '8rem', fontFamily: 'var(--font-primary)', fontWeight: '900', lineHeight: 1, textShadow: '0 0 30px rgba(204,255,0,0.5)' }}>{matchScore.A}</div>
          </div>
          <div style={{ fontSize: '3rem', color: 'var(--off-white)', fontWeight: 'bold' }}>VS</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h2 className="glow-text-cyan" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>EQUIPO B</h2>
            <div style={{ fontSize: '8rem', fontFamily: 'var(--font-primary)', fontWeight: '900', lineHeight: 1, textShadow: '0 0 30px rgba(0,240,255,0.5)' }}>{matchScore.B}</div>
          </div>
        </div>

        <div className="scorers-grid">
          
          <div className="glass-panel">
            <h3 style={{ color: 'var(--volt-lime)', textAlign: 'center', marginBottom: '1.5rem' }}>Anotadores - Equipo A</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {teamA.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px' }}>
                  <div onClick={() => setSelectedPlayerDetails(p)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                    <div style={{width:'40px', height:'40px', borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--pitch-black)'}}>
                      {p.avatar?.startsWith('data:image') ? <img src={p.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span style={{fontSize:'1.5rem'}}>{p.avatar || '👤'}</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{p.name}</div>
                      {playerGoals[p.id] > 0 && <div style={{ color: 'var(--ultimate-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>⚽ x{playerGoals[p.id]}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => removeGoal('A', p.id)} style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '1.5rem' }}>-</button>
                    <button onClick={() => addGoal('A', p.id)} style={{ width: '50px', height: '40px', borderRadius: '8px', background: 'var(--volt-lime)', border: 'none', color: 'black', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>+ ⚽</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel">
            <h3 style={{ color: 'var(--electric-cyan)', textAlign: 'center', marginBottom: '1.5rem' }}>Anotadores - Equipo B</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {teamB.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px' }}>
                  <div onClick={() => setSelectedPlayerDetails(p)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                    <div style={{width:'40px', height:'40px', borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--pitch-black)'}}>
                      {p.avatar?.startsWith('data:image') ? <img src={p.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span style={{fontSize:'1.5rem'}}>{p.avatar || '👤'}</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{p.name}</div>
                      {playerGoals[p.id] > 0 && <div style={{ color: 'var(--ultimate-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>⚽ x{playerGoals[p.id]}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => removeGoal('B', p.id)} style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '1.5rem' }}>-</button>
                    <button onClick={() => addGoal('B', p.id)} style={{ width: '50px', height: '40px', borderRadius: '8px', background: 'var(--electric-cyan)', border: 'none', color: 'black', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>+ ⚽</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem', gap: '2rem' }}>
          <button onClick={cancelLiveMatch} style={{ ...btnSec, borderColor: 'var(--off-white)', color: 'var(--off-white)', fontSize: '1.2rem', padding: '1rem 3rem' }}>CANCELAR</button>
          <button onClick={finishMatch} className="btn-primary" style={{ width: 'auto', fontSize: '1.5rem', padding: '1rem 4rem' }}>FINALIZAR PARTIDO</button>
        </div>
        {renderPlayerDetailsModal()}
      </div>
    );
  }

  // DEFAULT BUILDER MODE
  


  // Limpiar duplicados por nombre
  const uniqueRegistrationsMap = {};
  eventRegistrations.forEach(r => {
    if (r && r.name) {
      uniqueRegistrationsMap[r.name.toLowerCase().trim()] = r;
    }
  });
  const uniqueRegistrations = Object.values(uniqueRegistrationsMap).slice(0, activeEvent?.format || 100);

  const isPlanExpired = () => {
    if (userEmail === 'chris.r.lemos@gmail.com') return false;
    if (subscriptionChecking) return false;
    if (subscriptionStatus !== 'active') return true;
    if (subscriptionEndsAt && new Date(subscriptionEndsAt) < new Date()) return true;
    return false;
  };

  const handlePaywallPayment = async () => {
    try {
      setToastMessage('Redirigiendo a Mercado Pago...');
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: hostId, redirectUrl: `${window.location.origin}/?subscription_payment=approved&host_id=${hostId}` })
      });
      const data = await response.json();
      if (response.ok && data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        setToastMessage("Error al procesar pago: " + (data.error || ""));
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (e) {
      setToastMessage('Error de conexión con Mercado Pago');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {isPlanExpired() && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(10,10,15,0.98)',
          backdropFilter: 'blur(15px)',
          zIndex: 100000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏱️</span>
          <h2 className="glow-text-volt" style={{ color: 'var(--crimson-red)', fontSize: '2.5rem', marginBottom: '1rem' }}>TU PRUEBA HA FINALIZADO</h2>
          <p style={{ color: 'var(--off-white)', fontSize: '1.2rem', maxWidth: '600px', lineHeight: '1.6', marginBottom: '2rem' }}>
            Tus 7 días de prueba como Organizador han expirado. Para continuar creando ligas, organizando partidos y utilizando el motor de matchmaking avanzado, debes activar tu suscripción Premium Pro.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '400px' }}>
            <button 
              onClick={handlePaywallPayment}
              className="btn-primary" 
              style={{ 
                background: 'var(--electric-cyan)', 
                color: 'black', 
                borderColor: 'var(--electric-cyan)', 
                padding: '1.2rem 2.5rem', 
                fontSize: '1.2rem',
                fontWeight: 'bold',
                boxShadow: '0 0 30px rgba(0, 240, 255, 0.4)',
                cursor: 'pointer'
              }}
            >
              SUSCRIBIRSE POR $9.999 ARS / MES 💳
            </button>
            <button 
              onClick={onLogout}
              style={{
                background: 'transparent',
                border: '1px solid var(--off-white)',
                color: 'var(--off-white)',
                padding: '1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              🚪 Cerrar Sesión (Entrar como Jugador)
            </button>
          </div>
        </div>
      )}
      {showPackOpening && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'radial-gradient(circle at center, #0F0F16 0%, #050507 100%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          overflow: 'hidden'
        }}>
          <style>{`
            @keyframes packGlow {
              0% { box-shadow: 0 0 20px rgba(255,215,0,0.3); }
              50% { box-shadow: 0 0 50px rgba(255,215,0,0.7); }
              100% { box-shadow: 0 0 20px rgba(255,215,0,0.3); }
            }
            @keyframes glitch {
              0% { transform: translate(0) }
              20% { transform: translate(-2px, 2px) }
              40% { transform: translate(-2px, -2px) }
              60% { transform: translate(2px, 2px) }
              80% { transform: translate(2px, -2px) }
              100% { transform: translate(0) }
            }
            @keyframes cardReveal {
              0% { transform: scale(0.3) rotateY(90deg); opacity: 0; }
              70% { transform: scale(1.15) rotateY(-10deg); opacity: 1; }
              100% { transform: scale(1) rotateY(0deg); opacity: 1; }
            }
            .pack-pulsating {
              animation: packGlow 2s infinite ease-in-out;
            }
            .pack-glitch {
              animation: glitch 0.15s infinite;
            }
            .card-reveal-anim {
              animation: cardReveal 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
          `}</style>
          
          <div style={{
            position: 'absolute',
            width: '200%',
            height: '200%',
            background: 'repeating-linear-gradient(45deg, rgba(204,255,0,0.01) 0px, rgba(204,255,0,0.01) 10px, transparent 10px, transparent 20px)',
            transform: 'rotate(-25deg)',
            zIndex: 1
          }} />

          {/* Stage 0: Unopened Pack */}
          {walkoutRevealStage === 0 && (
            <div style={{ zIndex: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
              <h2 className="glow-text-volt" style={{ fontSize: '3rem', letterSpacing: '8px', fontStyle: 'italic', fontWeight: '900' }}>
                DRAFT PACK OPENING
              </h2>
              <p style={{ color: 'var(--electric-cyan)', letterSpacing: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                LA IA HA GENERADO EL BALANCEO DE EQUIPOS
              </p>
              
              <div 
                onClick={() => {
                  setWalkoutRevealStage(1);
                  setTimeout(() => {
                    setWalkoutRevealStage(2);
                  }, 1200);
                }}
                className="pack-pulsating"
                style={{
                  width: '180px',
                  height: '270px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 50%, #8B6508 100%)',
                  border: '3px solid #FFF',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.5rem 1rem',
                  boxShadow: '0 0 30px rgba(255,215,0,0.4)',
                  transform: 'perspective(1000px) rotateY(-15deg) rotateX(10deg)',
                  transition: 'transform 0.3s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'perspective(1000px) rotateY(-15deg) rotateX(10deg)'}
              >
                <div style={{ border: '1px solid rgba(255,255,255,0.4)', width: '100%', height: '100%', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0.5rem' }}>
                  <div style={{ color: 'white', fontWeight: '900', fontSize: '1.8rem', fontStyle: 'italic', letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>DRAFT</div>
                  <div style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.6))' }}>⚡</div>
                  <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '4px' }}>OPEN</div>
                </div>
              </div>
              
              <p style={{ color: 'var(--off-white)', letterSpacing: '2px', fontSize: '0.75rem', marginTop: '1rem', animation: 'pulse 1.5s infinite' }}>
                [ Toca el sobre para abrir el Pack ]
              </p>
            </div>
          )}

          {/* Stage 1: Glitch / Opening Effect */}
          {walkoutRevealStage === 1 && (
            <div style={{ zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#FFF', animation: 'pulse 0.1s infinite' }}>
              <div className="pack-glitch" style={{ fontSize: '5rem', fontWeight: '900', color: 'black', fontStyle: 'italic', letterSpacing: '10px' }}>
                ABRIENDO SOBRE...
              </div>
            </div>
          )}

          {/* Stage 2: Walkout Reveal */}
          {walkoutRevealStage === 2 && walkoutPlayer && (
            <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '600px', textAlign: 'center' }}>
              <h2 className="glow-text-volt" style={{ fontSize: '2.5rem', fontWeight: '900', fontStyle: 'italic', margin: 0, letterSpacing: '4px' }}>
                ★ WALKOUT DE LA IA ★
              </h2>
              <p style={{ color: 'var(--electric-cyan)', fontSize: '0.85rem', letterSpacing: '3px', margin: 0 }}>
                EL JUGADOR DE MAYOR RATING EN EL DRAFT
              </p>

              <div className="card-reveal-anim" style={{ transform: 'scale(1.5)', margin: '2.5rem 0', filter: 'drop-shadow(0 0 35px rgba(204,255,0,0.4))' }}>
                <PlayerCard 
                  name={walkoutPlayer.name}
                  position={walkoutPlayer.role.substring(0,3).toUpperCase()}
                  stats={walkoutPlayer.stats}
                  avatar={walkoutPlayer.avatar}
                  ovr={calcOvr(walkoutPlayer)}
                  stamina={walkoutPlayer.condition?.stamina ?? 100}
                  badges={getPlayerBadges(walkoutPlayer)}
                  isInjured={walkoutPlayer.condition?.isResting}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ color: 'white', fontSize: '2.2rem', margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '1px' }}>
                  {walkoutPlayer.name.toUpperCase()}
                </h3>
                <p style={{ color: 'var(--ultimate-gold)', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '2px', margin: 0 }}>
                  OVR: {calcOvr(walkoutPlayer)} | {walkoutPlayer.role.toUpperCase()}
                </p>
              </div>

              <button 
                onClick={() => {
                  setShowPackOpening(false);
                  setIsDrafting(true);
                  setRevealedCount(0);
                }} 
                className="btn-primary" 
                style={{ width: 'auto', padding: '1rem 3rem', fontSize: '1.2rem', marginTop: '1.5rem', boxShadow: '0 0 20px rgba(204,255,0,0.4)' }}
              >
                REVELAR EQUIPOS COMPLETOS ⚽
              </button>
            </div>
          )}
        </div>
      )}
      <header style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <div className="responsive-header-actions" style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
          {userEmail === 'chris.r.lemos@gmail.com' && (
            <div style={{ background: 'var(--ultimate-gold)', color: 'black', padding: '0.4rem 1rem', borderRadius: '20px', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 0 15px rgba(255,215,0,0.5)' }}>
              ⭐ ADMIN GENERAL
            </div>
          )}
          <div className="nav-tabs-container" style={{ margin: 0, flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Notification Bell */}
            {activeEvent && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button 
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (!showNotifications) markNotificationsAsRead();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '0.3rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  🔔
                  {activeEvent.notifications?.filter(n => !n.read).length > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      background: 'var(--crimson-red)',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '0.1rem 0.4rem',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      boxShadow: '0 0 5px rgba(255,0,85,0.5)'
                    }}>
                      {activeEvent.notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '40px',
                    right: '0',
                    width: '300px',
                    zIndex: 10000,
                    padding: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease-out',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--volt-lime)', fontSize: '0.85rem' }}>Notificaciones</span>
                      <button onClick={clearNotifications} style={{ background: 'transparent', border: 'none', color: 'var(--crimson-red)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Limpiar</button>
                    </div>
                    {(!activeEvent.notifications || activeEvent.notifications.length === 0) ? (
                      <p style={{ color: 'var(--off-white)', fontSize: '0.8rem', textAlign: 'center', margin: '1rem 0' }}>No tienes notificaciones.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {activeEvent.notifications.slice().reverse().map((n, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem', background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(204,255,0,0.05)', borderRadius: '4px', borderLeft: n.read ? 'none' : '3px solid var(--volt-lime)' }}>
                            <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              ⚽ {n.player_name} se unió al partido.
                            </span>
                            <span style={{ color: 'var(--off-white)', fontSize: '0.65rem' }}>
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'none' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', perspective: '1000px' }}>
            <img 
              src="/logo.png" 
              alt="FULBO Logo" 
              style={{ 
                width: '90px', 
                height: '90px', 
                objectFit: 'contain', 
                mixBlendMode: 'screen',
                transform: 'rotateY(20deg) rotateX(15deg) translateZ(20px)', 
                transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
              }} 
              onMouseEnter={(e) => e.target.style.transform = 'rotateY(0deg) rotateX(0deg) translateZ(40px) scale(1.15)'} 
              onMouseLeave={(e) => e.target.style.transform = 'rotateY(20deg) rotateX(15deg) translateZ(20px) scale(1)'} 
            />
            <h1 style={{ fontSize: '4.5rem', margin: 0, fontStyle: 'italic', fontWeight: '900', letterSpacing: '2px', paddingRight: '0.2em', background: 'linear-gradient(135deg, var(--volt-lime) 0%, #ffffff 40%, var(--electric-cyan) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.6))' }}>FULBO</h1>
          </div>
          <span style={{ color: 'var(--electric-cyan)', fontSize: '0.9rem', letterSpacing: '6px', textTransform: 'uppercase', fontWeight: '900', marginTop: '0.8rem', textShadow: '0 0 15px rgba(0, 240, 255, 0.9)' }}>THE ELITE MATCHMAKING ENGINE</span>
          <p style={{ color: 'var(--off-white)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '0.8rem', fontWeight: '600', fontSize: '0.75rem', opacity: 0.8 }}>
            Powered by La FactorIA
          </p>
        </div>
      </header>
      
      {/* EVENT LOBBY UI */}
      <div className="glass-panel" style={{ marginBottom: '2rem', border: '1px solid var(--volt-lime)', background: 'rgba(204,255,0,0.05)' }}>
         <div className="responsive-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeEvent ? '1rem' : '0' }}>
            <h3 style={{ color: 'var(--volt-lime)', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>⚡ MATCH DAY LOBBY</h3>
            {!activeEvent ? (
               <div className="responsive-flex" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="input-field" />
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="input-field" />
                  <div className="segmented-control" style={{ minWidth: '220px' }}>
                    <button 
                      type="button" 
                      onClick={() => setEventFormat(10)} 
                      className={`segment-btn ${eventFormat === 10 ? 'active' : ''}`}
                    >
                      🏃‍♂️ 5v5 (10 J)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setEventFormat(14)} 
                      className={`segment-btn ${eventFormat === 14 ? 'active' : ''}`}
                    >
                      🔥 7v7 (14 J)
                    </button>
                  </div>
                  <button onClick={() => setActiveEvent({ date: eventDate, time: eventTime, format: eventFormat, status: 'lobby', notifications: [] })} className="btn-primary" style={{ padding: '0.5rem 1.5rem', whiteSpace: 'nowrap', width: 'auto', flexShrink: 0, fontSize: '1rem' }}>CREAR EVENTO</button>
               </div>
            ) : (
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--off-white)' }}>{activeEvent.date} {activeEvent.time} | Formato {activeEvent.format} jug.</span>
                  <button onClick={() => { 
                    setActiveEvent(null); 
                    setEventRegistrations([]); 
                    setTeamA([]);
                    setTeamB([]);
                    setPitchCost('');
                    setPaymentsMap({});
                    setMatchScore({ A: 0, B: 0 });
                    setPlayerGoals({});
                    if(isSupabaseConfigured && supabase) supabase.from('event_registrations').delete().eq('host_id', hostId).then(); 
                  }} style={{ ...btnSec, borderColor: 'var(--crimson-red)', color: 'var(--crimson-red)' }}>CANCELAR EVENTO</button>
               </div>
            )}
         </div>

         {activeEvent && (
            <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px' }}>
                  <div>
                     <div style={{ fontSize: '0.9rem', color: 'var(--off-white)' }}>Inscritos actualmente en el Lobby Público:</div>
                     <div className="glow-text-volt" style={{ fontSize: '2rem', fontWeight: 'bold', color: uniqueRegistrations.length >= activeEvent.format ? 'var(--crimson-red)' : 'var(--volt-lime)' }}>{uniqueRegistrations.length} / {activeEvent.format}</div>
                     {uniqueRegistrations.length >= 15 && <span style={{ fontSize: '0.8rem', color: 'var(--crimson-red)', marginLeft: '1rem' }}>(Límite de Invitación de 15 Jug. alcanzado)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                     {uniqueRegistrations.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {uniqueRegistrations.slice(0, 5).map((r, i) => <div key={i} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'black', border: '1px solid var(--electric-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>{r.name.substring(0,2).toUpperCase()}</div>)}
                          {uniqueRegistrations.length > 5 && <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--off-white)' }}>+{uniqueRegistrations.length - 5}</div>}
                        </div>
                     )}
                     <button onClick={() => {
                        const text = `🔥 *MATCH DAY CREADO* 🔥\n\n📅 Fecha: ${activeEvent.date}\n⏰ Hora: ${activeEvent.time}\n⚽ Formato: Fulbo ${activeEvent.format/2} (${activeEvent.format} Jugadores)\n\n👉 *Inscríbete y arma tu Carta aquí:* ${window.location.origin}/?league=${hostId}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                     }} style={{ ...btnSec, borderColor: '#25D366', color: '#25D366', boxShadow: '0 0 10px rgba(37,211,102,0.3)', padding: '0.5rem 1rem' }}>COMPARTIR 📱</button>
                  </div>
               </div>
               <p style={{ color: 'var(--electric-cyan)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'right' }}>*Cupos disponibles: {Math.max(0, activeEvent.format - uniqueRegistrations.length)}</p>
            </div>
         )}
      </div>

      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem', opacity: (activeEvent && activeEvent.status === 'match') ? 0.3 : 1, pointerEvents: (activeEvent && activeEvent.status === 'match') ? 'none' : 'auto' }}>
        <aside className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.2rem', position: 'relative' }}>
          {!activeEvent && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(10, 10, 12, 0.95)',
              backdropFilter: 'blur(5px)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center',
              borderRadius: '8px',
              clipPath: 'polygon(10% 0, 90% 0, 100% 12%, 100% 88%, 90% 100%, 10% 100%, 0 88%, 0 12%)',
            }}>
              <span style={{ fontSize: '3rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}>📅</span>
              <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>SIN PARTIDO ACTIVO</h3>
              <p style={{ color: 'var(--off-white)', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                Para comenzar a convocar jugadores y armar los equipos, crea un nuevo partido.
              </p>
              <button 
                onClick={() => setViewMode('active_matches')} 
                className="btn-primary" 
                style={{ width: 'auto', padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
              >
                📅 CREAR EVENTO
              </button>
            </div>
          )}
          <div>
            <h3 style={{ color: 'var(--electric-cyan)', marginBottom: '1rem', fontSize: '1.1rem' }}>{editingPlayerId ? 'Editar Jugador' : 'Agregar Jugador'}</h3>
            <form onSubmit={savePlayer} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <input className="input-field" type="text" placeholder="Nombre (Ej: Messi)" value={name} onChange={(e) => setName(e.target.value)} required />
              <AvatarSelector onSelectAvatar={setCurrentAvatar} currentAvatar={currentAvatar} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--off-white)', fontWeight: 'bold', letterSpacing: '1px' }}>ROL / POSICIÓN</span>
                <div className="segmented-control">
                  {[
                    { val: 'Arquero', label: 'GK', cls: 'role-arquero' },
                    { val: 'Defensor', label: 'DEF', cls: 'role-defensor' },
                    { val: 'Mediocampo', label: 'MED', cls: 'role-mediocampo' },
                    { val: 'Delantero', label: 'DEL', cls: 'role-delantero' }
                  ].map(r => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => setRole(r.val)}
                      className={`segment-btn ${role === r.val ? 'active' : ''}`}
                      style={role === r.val ? {
                        background: r.val === 'Arquero' ? 'rgb(168, 85, 247)' : (r.val === 'Defensor' ? 'var(--electric-cyan)' : (r.val === 'Mediocampo' ? 'var(--volt-lime)' : 'var(--crimson-red)')),
                        color: 'black',
                        boxShadow: 'none'
                      } : {}}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Pace: Ritmo / Velocidad pura"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>PAC</span><input type="number" name="pac" value={skills.pac} onChange={handleSkillChange} className="input-field" min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Shooting: Capacidad de tiro y definición"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>SHO</span><input type="number" name="sho" value={skills.sho} onChange={handleSkillChange} className="input-field" min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Passing: Precisión de pase y visión"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>PAS</span><input type="number" name="pas" value={skills.pas} onChange={handleSkillChange} className="input-field" min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Dribbling: Regate, agilidad y control"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>DRI</span><input type="number" name="dri" value={skills.dri} onChange={handleSkillChange} className="input-field" min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Defending: Marcaje e intercepciones"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>DEF</span><input type="number" name="def" value={skills.def} onChange={handleSkillChange} className="input-field" min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Physical: Fuerza y resistencia física"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>PHY</span><input type="number" name="phy" value={skills.phy} onChange={handleSkillChange} className="input-field" min="1" max="99" /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.8rem', fontSize: '1rem' }}>{editingPlayerId ? 'Actualizar' : 'Sumar a Plantilla'}</button>
                {editingPlayerId && <button type="button" onClick={resetForm} style={{ ...btnSec, borderColor: 'var(--off-white)', color: 'var(--off-white)' }}>Cancelar</button>}
              </div>
            </form>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {activeEvent && (
              <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--off-white)', fontWeight: 'bold' }}>INVITAR JUGADOR DE LA PLANTILLA</span>
                <select 
                  onChange={(e) => {
                    const pId = e.target.value;
                    if (!pId) return;
                    const player = roster.find(p => p.id === pId);
                    if (player) {
                      addPlayerToEvent(player);
                    }
                    e.target.value = ''; // Reset
                  }}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">-- Seleccionar jugador sano --</option>
                  {roster
                    .filter(p => !p.condition?.isResting)
                    .filter(p => !uniqueRegistrations.some(reg => reg.name.toLowerCase().trim() === p.name.toLowerCase().trim()))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                    ))
                  }
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <h3 style={{ color: 'var(--pure-white)' }}>Convocados</h3>
              <span className="glow-text-volt" style={{ fontWeight: 'bold' }}>{uniqueRegistrations.length} JUG</span>
            </div>
            
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
              {uniqueRegistrations.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', marginTop: '2rem' }}>No hay convocados confirmados aún</p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {uniqueRegistrations.map(reg => {
                    const p = roster.find(player => player.name.toLowerCase().trim() === reg.name.toLowerCase().trim()) || {
                      id: reg.id || Date.now().toString(),
                      name: reg.name,
                      role: reg.role || 'Mediocampo',
                      avatar: reg.avatar || '👤',
                      stats: reg.stats || { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 },
                      condition: { stamina: 100 }
                    };
                    const isRosterPlayer = roster.some(player => player.name.toLowerCase().trim() === reg.name.toLowerCase().trim());
                    const inA = teamA.some(x => x.id === p.id || (x.name && p.name && x.name.toLowerCase().trim() === p.name.toLowerCase().trim()));
                    const inB = teamB.some(x => x.id === p.id || (x.name && p.name && x.name.toLowerCase().trim() === p.name.toLowerCase().trim()));

                    return (
                      <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                        <div onClick={() => setSelectedPlayerDetails(p)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                          {p.avatar && (
                            <div style={{ width: '25px', height: '25px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {p.avatar.startsWith('data:image') ? <img src={p.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span style={{fontSize:'0.8rem'}}>{p.avatar}</span>}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ 
                              fontWeight: 'bold', 
                              fontSize: '0.9rem', 
                              color: p.condition?.isResting ? '#FF3B30' : 'white',
                              textDecoration: p.condition?.isResting ? 'line-through' : 'none'
                            }}>
                              {p.name}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: p.role === 'Ancla' ? 'var(--electric-cyan)' : 'var(--off-white)' }}>{p.role}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                          <span className="glow-text-volt" style={{ fontSize: '0.9rem', fontWeight: 'bold', minWidth: '20px' }}>{calcOvr(p)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '60px' }} title={`Energía: ${p.condition?.stamina ?? 100}%`}>
                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${p.condition?.stamina ?? 100}%`, height: '100%', background: (p.condition?.stamina ?? 100) > 60 ? '#25D366' : ((p.condition?.stamina ?? 100) > 30 ? '#FFA500' : '#FF3B30'), transition: 'width 0.3s' }}></div>
                            </div>
                          </div>
                          {activeEvent && activeEvent.status === 'preview' && (
                              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                {inA && (
                                  <span style={{ background: 'rgba(204,255,0,0.2)', color: 'var(--volt-lime)', border: '1px solid var(--volt-lime)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>EN A</span>
                                )}
                                {inB && (
                                  <span style={{ background: 'rgba(0,240,255,0.2)', color: 'var(--electric-cyan)', border: '1px solid var(--electric-cyan)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>EN B</span>
                                )}
                                <button 
                                  onClick={() => {
                                    const newA = teamA.filter(x => x.id !== p.id && x.name.toLowerCase().trim() !== p.name.toLowerCase().trim());
                                    const newB = teamB.filter(x => x.id !== p.id && x.name.toLowerCase().trim() !== p.name.toLowerCase().trim());
                                    setTeamA(newA);
                                    setTeamB(newB);
                                    setActiveEvent(prev => {
                                      if (!prev) return null;
                                      return {
                                        ...prev,
                                        teamA: newA,
                                        teamB: newB
                                      };
                                    });
                                  }} 
                                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--off-white)', borderRadius: '4px', padding: '0.15rem 0.35rem', cursor: 'pointer', fontSize: '0.65rem' }}
                                  title="Quitar del Equipo"
                                >
                                  Quitar
                                </button>
                              </div>
                          )}
                          <button 
                            onClick={() => healPlayer(p.id)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: p.condition?.isResting ? 1 : 0.4 }} 
                            title={p.condition?.isResting ? "Dar Alta Médica" : "Reportar Lesión (Hospital)"}
                          >
                            {p.condition?.isResting ? '🚑' : '🤕'}
                          </button>
                          <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', color: 'var(--electric-cyan)', cursor: 'pointer', fontSize: '1rem', opacity: 0.8 }} title="Editar jugador">✏️</button>
                          <button 
                            onClick={() => removePlayerFromEvent(p.name, reg.id)} 
                            style={{ background: 'none', border: 'none', color: 'var(--crimson-red)', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} 
                            title="Quitar del Evento"
                          >
                            &times;
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <button onClick={() => balanceTeamsLocally(true)} className="btn-primary" disabled={isLoading || uniqueRegistrations.length < 8}>
            {isLoading ? 'CALCULANDO IA...' : 'ARMAR EQUIPOS POR ROL'}
          </button>
        </aside>

        <main className="glass-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {(teamA.length === 0 && teamB.length === 0) ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ width: '120px', height: '120px', border: '2px dashed rgba(204,255,0,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '3rem', filter: 'grayscale(1)', opacity: 0.3 }}>⚽</span>
              </div>
              <p style={{ color: 'var(--off-white)', fontSize: '1.2rem', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6', margin: 0 }}>
                Agrega jugadores y presiona <strong className="glow-text-volt">Armar Equipos</strong>.
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button 
                  onClick={() => balanceTeamsLocally(true)} 
                  className="btn-primary" 
                  disabled={isLoading || uniqueRegistrations.length < 8}
                  style={{ padding: '0.8rem 2rem', fontSize: '1rem', width: 'auto' }}
                >
                  {isLoading ? 'CALCULANDO IA...' : '🔄 ARMAR EQUIPOS POR ROL'}
                </button>
                <button 
                  onClick={() => balanceTeamsRandomlyByRole(true)} 
                  className="btn-primary" 
                  disabled={isLoading || uniqueRegistrations.length < 8}
                  style={{ padding: '0.8rem 2rem', fontSize: '1rem', width: 'auto', background: 'linear-gradient(135deg, var(--ultimate-gold) 0%, #FFA500 100%)', color: 'black', border: 'none' }}
                >
                  🎲 ARMAR ALEATORIOS
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative' }}>
                <h2 style={{ color: isDrafting ? 'var(--crimson-red)' : 'var(--pure-white)', letterSpacing: '5px', fontSize: '1.5rem', animation: isDrafting ? 'pulse 1s infinite' : 'none' }}>
                  {isDrafting ? '🔴 DRAFT EN PROGRESO...' : 'PREVIEW DEL PARTIDO'}
                </h2>
                <div style={{ width: '60px', height: '2px', background: isDrafting ? 'var(--crimson-red)' : 'var(--volt-lime)', margin: '0.5rem auto', boxShadow: isDrafting ? '0 0 10px var(--crimson-red)' : '0 0 10px var(--volt-lime)' }}></div>
              </div>
              
              <div className="responsive-flex" style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
                <div className="team-column-a">
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h3 className="glow-text-volt" style={{ fontSize: '2rem' }}>EQUIPO A</h3>
                    <div style={{ background: 'rgba(204,255,0,0.05)', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid rgba(204,255,0,0.2)', marginTop: '0.5rem' }}>
                      <span style={{ color: 'var(--off-white)', fontSize: '0.8rem', marginRight: '10px' }}>OVR MEDIO: </span>
                      <strong className="glow-text-volt" style={{ fontSize: '1.2rem' }}>{isDrafting ? '???' : getTeamRating(teamA)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
                    {Array.from({ length: activeEvent.format / 2 }).map((_, index) => {
                      const p = isDrafting ? teamA.slice(0, Math.ceil(revealedCount / 2))[index] : teamA[index];
                      if (p) {
                        return (
                          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <div onClick={() => setSelectedPlayerDetails(p)} style={{ animation: 'fadeIn 0.4s ease-out', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                              <PlayerCard name={p.name} position={p.role.substring(0,3).toUpperCase()} stats={p.stats} avatar={p.avatar} ovr={calcOvr(p)} badges={getPlayerBadges(p)} isInjured={p.condition?.isResting} stamina={p.condition?.stamina ?? 100} />
                            </div>
                            {!isDrafting && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); movePlayerToTeam(p, 'B'); }}
                                className="btn-primary"
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--volt-lime)', cursor: 'pointer' }}
                              >
                                Pasar a B ➡️
                              </button>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div key={`empty-a-${index}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', opacity: isDrafting ? 0 : 1, transition: 'opacity 0.3s' }}>
                            <div style={{ width: '180px', height: '260px', background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                               <span style={{ fontSize: '2.5rem', opacity: 0.2 }}>👤</span>
                               <span style={{ color: 'var(--off-white)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', opacity: 0.5 }}>VACANTE</span>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>

                <div style={{ width: '70px', height: '70px', background: 'var(--pitch-black)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 0 30px rgba(0,0,0,1)', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-primary)', fontWeight: '900', fontSize: '1.5rem', color: 'var(--pure-white)', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>VS</span>
                </div>

                <div className="team-column-b">
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h3 className="glow-text-cyan" style={{ fontSize: '2rem' }}>EQUIPO B</h3>
                    <div style={{ background: 'rgba(0,240,255,0.05)', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid rgba(0,240,255,0.2)', marginTop: '0.5rem' }}>
                      <span style={{ color: 'var(--off-white)', fontSize: '0.8rem', marginRight: '10px' }}>OVR MEDIO: </span>
                      <strong className="glow-text-cyan" style={{ fontSize: '1.2rem' }}>{isDrafting ? '???' : getTeamRating(teamB)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
                    {Array.from({ length: activeEvent.format / 2 }).map((_, index) => {
                      const p = isDrafting ? teamB.slice(0, Math.floor(revealedCount / 2))[index] : teamB[index];
                      if (p) {
                        return (
                          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <div onClick={() => setSelectedPlayerDetails(p)} style={{ animation: 'fadeIn 0.4s ease-out', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                              <PlayerCard name={p.name} position={p.role.substring(0,3).toUpperCase()} stats={p.stats} avatar={p.avatar} ovr={calcOvr(p)} badges={getPlayerBadges(p)} isInjured={p.condition?.isResting} stamina={p.condition?.stamina ?? 100} />
                            </div>
                            {!isDrafting && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); movePlayerToTeam(p, 'A'); }}
                                className="btn-primary"
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--electric-cyan)', cursor: 'pointer' }}
                              >
                                ⬅️ Pasar a A
                              </button>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div key={`empty-b-${index}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', opacity: isDrafting ? 0 : 1, transition: 'opacity 0.3s' }}>
                            <div style={{ width: '180px', height: '260px', background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                               <span style={{ fontSize: '2.5rem', opacity: 0.2 }}>👤</span>
                               <span style={{ color: 'var(--off-white)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', opacity: 0.5 }}>VACANTE</span>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              </div>

              {/* LA VAQUITA PANEL */}
              {!isDrafting && (
              <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', marginTop: '2rem', zIndex: 10, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h3 style={{ color: 'var(--ultimate-gold)', margin: 0 }}>💰 LA VAQUITA</h3>
                    {hostId && (
                      <button 
                        onClick={() => setShowMpConfig(true)} 
                        title="Configurar Mercado Pago" 
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}
                      >
                        ⚙️
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--off-white)', fontSize: '0.9rem' }}>Costo Cancha ($):</span>
                    <input type="number" value={pitchCost} onChange={(e) => setPitchCost(e.target.value)} className="input-field" style={{ width: '100px', padding: '0.3rem' }} placeholder="0" />
                  </div>
                </div>
                
                {pitchCost > 0 && (
                  <div className="responsive-flex" style={{ display: 'flex', gap: '2rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 1rem 0', color: 'var(--electric-cyan)', fontWeight: 'bold' }}>
                        Cuota: ${((teamA.length + teamB.length) > 0 ? (pitchCost / (teamA.length + teamB.length)) : 0).toFixed(2)} por jugador
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {[...teamA, ...teamB].map(p => (
                          <div key={p.id} onClick={() => setPaymentsMap(prev => {
                            const current = prev[p.id];
                            let nextStatus = false;
                            if (!current) nextStatus = 'cash';
                            else if (current === 'cash') nextStatus = 'mp';
                            else nextStatus = false;
                            return { ...prev, [p.id]: nextStatus };
                          })} style={{ cursor: 'pointer', background: paymentsMap[p.id] ? 'rgba(37,211,102,0.2)' : 'rgba(255,0,0,0.2)', border: paymentsMap[p.id] ? '1px solid #25D366' : '1px solid var(--crimson-red)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {paymentsMap[p.id] === 'mp' ? '💳 MP' : paymentsMap[p.id] === 'cash' || paymentsMap[p.id] === true ? '💵 EF' : '❌'} {p.name}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button onClick={broadcastPaymentNotification} className="btn-primary" style={{ background: '#009EE3', borderColor: '#009EE3', fontSize: '0.9rem', padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontWeight: 'bold' }}>
                         📣 NOTIFICAR A JUGADORES
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* ACTION: START MATCH & SHARE */}
              {!isDrafting && (
              <div className="match-action-buttons">
                <button onClick={shareTeamsWA} className="btn-primary" style={{ background: '#25D366', color: 'white', borderColor: '#25D366', boxShadow: '0 0 10px rgba(37,211,102,0.3)' }}>WHATSAPP 📱</button>
                <button 
                  onClick={() => balanceTeamsRandomlyByRole(true)} 
                  className="btn-primary" 
                  style={{ background: 'linear-gradient(135deg, var(--ultimate-gold) 0%, #FFA500 100%)', color: 'black', border: 'none' }}
                >
                  🎲 RE-ARMAR ALEATORIO
                </button>
                <button 
                  onClick={() => balanceTeamsLocally(true)} 
                  className="btn-primary"
                >
                  🔄 RE-ARMAR POR ROL
                </button>
                <button onClick={startMatch} className="btn-primary" style={{ background: 'var(--pitch-black)', color: 'var(--ultimate-gold)', borderColor: 'var(--ultimate-gold)', boxShadow: '0 0 20px rgba(255,215,0,0.2)' }}>INICIAR PARTIDO ⚡</button>
                <button onClick={cancelPreview} style={{ ...btnSec, borderColor: 'var(--crimson-red)', color: 'var(--crimson-red)' }}>CANCELAR</button>
              </div>
              )}
            </>
          )}
          {renderPlayerDetailsModal()}
          {renderMpConfigModal()}
          {toastMessage && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: 'var(--pitch-black)',
              border: '2px solid var(--volt-lime)',
              boxShadow: '0 0 15px rgba(204,255,0,0.4)',
              color: 'white',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              zIndex: 11000,
              fontFamily: 'var(--font-primary)',
              fontWeight: 'bold',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              {toastMessage}
            </div>
          )}
        </main>
      </div>

      {/* Barra de Navegación Inferior Dashboard */}
      <nav style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'rgba(10,10,15,0.95)', 
        backdropFilter: 'blur(10px)', 
        borderTop: '1px solid rgba(255,255,255,0.1)', 
        display: 'flex', 
        justifyContent: 'space-around', 
        padding: '0.6rem 0.2rem', 
        paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))',
        zIndex: 1000,
        overflowX: 'auto'
      }}>
        <button onClick={() => setViewMode('builder')} style={{ background: 'transparent', color: viewMode === 'builder' ? 'var(--volt-lime)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '45px' }}>
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Armado</span>
        </button>
        <button onClick={() => setViewMode('active_matches')} style={{ background: 'transparent', color: viewMode === 'active_matches' ? 'var(--volt-lime)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '45px' }}>
          <span style={{ fontSize: '1.2rem' }}>📅</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Partidos</span>
        </button>
        <button onClick={() => setViewMode('stats')} style={{ background: 'transparent', color: viewMode === 'stats' ? 'var(--volt-lime)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '45px' }}>
          <span style={{ fontSize: '1.2rem' }}>🏅</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Ranking</span>
        </button>
        <button onClick={() => setViewMode('history')} style={{ background: 'transparent', color: viewMode === 'history' ? 'var(--volt-lime)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '45px' }}>
          <span style={{ fontSize: '1.2rem' }}>📚</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Histórico</span>
        </button>
        <button onClick={() => setViewMode('dreamteam')} style={{ background: 'transparent', color: viewMode === 'dreamteam' ? 'var(--ultimate-gold)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '45px' }}>
          <span style={{ fontSize: '1.2rem' }}>🏆</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>DreamTeam</span>
        </button>
        <button onClick={onLogout} style={{ background: 'transparent', color: 'var(--crimson-red)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '45px' }}>
          <span style={{ fontSize: '1.2rem' }}>🚪</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Salir</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;
