import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import PlayerCard from '../components/PlayerCard';
import EloChart from '../components/EloChart';
import AvatarSelector from '../components/AvatarSelector';

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
  const [activeTab, setActiveTab] = useState('active_matches'); // 'leaderboard' | 'history' | 'active_matches' | 'hospital'
  const [leaderboardFilter, setLeaderboardFilter] = useState('active');
  
  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState('');
  const [subscriptionChecking, setSubscriptionChecking] = useState(true);
  
  const [activeEvent, setActiveEvent] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState(currentUser?.user_metadata?.full_name || localStorage.getItem('guestName') || '');
  const [regRole, setRegRole] = useState(localStorage.getItem('guestRole') || 'Mediocampo');
  const [regStats, setRegStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('guestStats')) || { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 }; }
    catch(e) { return { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 }; }
  });
  const [regSuccess, setRegSuccess] = useState(false);
  const [leagueExists, setLeagueExists] = useState(false);
  const [regAvatar, setRegAvatar] = useState(localStorage.getItem('guestAvatar') || '⚽');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState(false);
  const [eventRegistrations, setEventRegistrations] = useState([]);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // States for guest player self-editing
  const [isEditingSelf, setIsEditingSelf] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('Mediocampo');
  const [editAvatar, setEditAvatar] = useState('👤');
  const [editStats, setEditStats] = useState({ pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });

  // States for reveal animation
  const [teamsRevealed, setTeamsRevealed] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showPackOpening, setShowPackOpening] = useState(false);
  const [walkoutRevealStage, setWalkoutRevealStage] = useState(0);
  const [walkoutPlayers, setWalkoutPlayers] = useState([]);
  const [isDrafting, setIsDrafting] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  // Derived computed values
  const myPlayerCard = roster.find(p => p && (p.id === currentUser?.id || p.player_id === currentUser?.id)) 
    || (() => {
      const gName = localStorage.getItem('guestName');
      if (!gName) return null;
      try {
        const gStats = JSON.parse(localStorage.getItem('guestStats')) || { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 };
        return {
          id: 'guest_local',
          name: gName,
          role: localStorage.getItem('guestRole') || 'Mediocampo',
          stats: gStats,
          avatar: localStorage.getItem('guestAvatar') || '⚽',
          glicko: { rating: 1500 }
        };
      } catch(e) { return null; }
    })();

  const uniqueRegistrationsMap = {};
  eventRegistrations.forEach(r => {
    if (r && r.name) {
      uniqueRegistrationsMap[r.name.toLowerCase().trim()] = r;
    }
  });
  const maxPlayers = activeEvent?.format ? activeEvent.format * 2 : 100;
  const uniqueRegistrations = Object.values(uniqueRegistrationsMap).slice(0, maxPlayers);

  const isUserRegistered = uniqueRegistrations.some(r => r.player_id === currentUser?.id || (r.name && currentUser?.user_metadata?.full_name && r.name.toLowerCase().trim() === currentUser.user_metadata.full_name.toLowerCase().trim()));

  useEffect(() => {
    if (currentUser?.user_metadata?.full_name && !regName) {
      setRegName(currentUser.user_metadata.full_name);
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedPlayer && isEditingSelf) {
      setEditName(selectedPlayer.name);
      setEditRole(selectedPlayer.role || 'Mediocampo');
      setEditAvatar(selectedPlayer.avatar || '👤');
      setEditStats(selectedPlayer.stats || { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });
    }
  }, [selectedPlayer, isEditingSelf]);

  const calcRawOvr = (stats) => {
    if (!stats) return 75;
    return Math.round(((stats.pac || 75) + (stats.sho || 75) + (stats.pas || 75) + (stats.dri || 75) + (stats.def || 75) + (stats.phy || 75)) / 6);
  };
  const calcOvr = (p) => {
    if (!p) return 75;
    const raw = calcRawOvr(p.stats);
    const stam = p.condition?.stamina ?? 100;
    return Math.round(raw * (0.5 + (0.5 * (stam / 100))));
  };
  const calcHybridScore = (p) => {
    if (!p) return 75;
    return (calcOvr(p) + ((p.glicko?.rating || 1500) / 20)) / 2;
  };

  // Auto-open registration form in active lobby for unregistered guests
  useEffect(() => {
    if (!loading && activeEvent?.status === 'lobby' && !isUserRegistered && !hasAutoOpened && uniqueRegistrations.length < (activeEvent.format || 100)) {
      setIsRegistering(true);
      setHasAutoOpened(true);
    }
  }, [loading, activeEvent, isUserRegistered, hasAutoOpened, uniqueRegistrations.length]);
  
  useEffect(() => {
    if (activeEvent?.status === 'lobby') {
      setTeamsRevealed(false);
      setIsRevealing(false);
    }
  }, [activeEvent?.status]);

  const handleRevealTeams = () => {
    const tA = activeEvent?.teamA || [];
    const tB = activeEvent?.teamB || [];
    const topA = [...tA].sort((a,b) => calcHybridScore(b) - calcHybridScore(a)).slice(0, 2);
    const topB = [...tB].sort((a,b) => calcHybridScore(b) - calcHybridScore(a)).slice(0, 2);
    
    setWalkoutPlayers([...topA, ...topB]);
    setShowPackOpening(true);
    setWalkoutRevealStage(0);
  };

  useEffect(() => {
    if (isDrafting && activeEvent?.teamA && activeEvent?.teamB) {
      const totalPlayers = activeEvent.teamA.length + activeEvent.teamB.length;
      if (revealedCount < totalPlayers) {
        const timer = setTimeout(() => {
          setRevealedCount(prev => prev + 1);
        }, 400);
        return () => clearTimeout(timer);
      } else {
        setIsDrafting(false);
      }
    }
  }, [isDrafting, revealedCount, activeEvent]);
  
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
      
      // Check if player is injured (in Hospital)
      const matchingPlayer = roster.find(p => p.name && p.name.toLowerCase().trim() === currentNameClean);
      if (matchingPlayer && matchingPlayer.condition?.isResting) {
        alert("🤕 No puedes inscribirte en este partido porque estás en la lista de lesionados (Hospital).");
        return;
      }

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
          // Save locally so the guest can see their card in 'Mi Ficha'
          localStorage.setItem('guestName', regName.trim());
          localStorage.setItem('guestRole', regRole);
          localStorage.setItem('guestStats', JSON.stringify(regStats));
          localStorage.setItem('guestAvatar', regAvatar);
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

  const handleCashPayment = async (playerId) => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('league_state').select('active_event').eq('host_id', leagueId).single();
        if (error) throw error;
        
        if (data && data.active_event) {
          const currentEvent = data.active_event;
          if (!currentEvent.paymentsMap) currentEvent.paymentsMap = {};
          currentEvent.paymentsMap[playerId] = 'cash';
          
          const { error: updateError } = await supabase.from('league_state').update({ active_event: currentEvent }).eq('host_id', leagueId);
          if (updateError) throw updateError;
        }
      }
      setPaymentSuccessMsg(true);
    } catch (e) {
      console.error(e);
      alert("Error al registrar el pago en efectivo.");
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

          let lastMatchDate = p.lastMatchDate;
          if ((p.history.pj || 0) > 0 && !lastMatchDate) {
            const matchesWithPlayer = matches.filter(match => {
              const inA = match.teamA?.some(m => m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase()));
              const inB = match.teamB?.some(m => m.id === p.id || (m.name && p.name && m.name.toLowerCase() === p.name.toLowerCase()));
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
            lastMatchDate,
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
      if (!leagueId) {
        setSubscriptionChecking(false);
        setLoading(false);
        return;
      }
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

          // Obtener registros de eventos
          const { data: regsData } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('host_id', leagueId);
          if (regsData) setEventRegistrations(regsData);
        } catch (err) {
          console.error("Exception fetching league state:", err);
          processLeagueData(null);
          setSubscriptionChecking(false);
        }
        setLoading(false);
      };
      fetchLeague();

      if (!leagueId) return;

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

      // Suscribirse a cambios en tiempo real en event_registrations
      const regsChannel = supabase
        .channel(`regs_${leagueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_registrations'
          },
          (payload) => {
            // Recargar registros
            supabase
              .from('event_registrations')
              .select('*')
              .eq('host_id', leagueId)
              .then(({ data }) => {
                if (data) setEventRegistrations(data);
              });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(regsChannel);
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

  const saveSelfStats = async () => {
    if (!editName.trim()) return;
    
    const previousRoster = [...roster];
    const previousRegs = [...eventRegistrations];
    const previousSelected = { ...selectedPlayer };

    const updatedSelected = {
      ...selectedPlayer,
      name: editName.trim(),
      role: editRole,
      avatar: editAvatar,
      stats: editStats
    };
    setSelectedPlayer(updatedSelected);

    const updatedRoster = roster.map(p => 
      (p.id === currentUser?.id || p.player_id === currentUser?.id || p.name.toLowerCase().trim() === selectedPlayer.name.toLowerCase().trim())
        ? { ...p, name: editName.trim(), role: editRole, avatar: editAvatar, stats: editStats }
        : p
    );
    setRoster(updatedRoster);

    const updatedRegs = eventRegistrations.map(r => 
      (r.player_id === currentUser?.id || r.name.toLowerCase().trim() === selectedPlayer.name.toLowerCase().trim())
        ? { ...r, name: editName.trim(), role: editRole, stats: editStats, avatar: editAvatar }
        : r
    );
    setEventRegistrations(updatedRegs);

    if (isSupabaseConfigured && supabase) {
      try {
        let rpcSuccess = false;
        try {
          const { error: rpcError } = await supabase.rpc('update_player_in_roster', {
            p_league_id: leagueId,
            p_player_id: currentUser.id,
            p_name: editName.trim(),
            p_role: editRole,
            p_avatar: editAvatar,
            p_stats: editStats
          });
          if (!rpcError) rpcSuccess = true;
        } catch (err) {
          console.warn("RPC update failed, trying fallback:", err);
        }

        if (!rpcSuccess) {
          const { error: stateError } = await supabase
            .from('league_state')
            .update({ roster: updatedRoster, updated_at: new Date().toISOString() })
            .eq('host_id', leagueId);
          if (stateError) {
            console.error("Error updating league state directly:", stateError);
          }
        }

        const isUuid = (str) => {
          if (!str) return false;
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        };
        const hasReg = eventRegistrations.find(r => r.player_id === currentUser?.id || r.name.toLowerCase().trim() === selectedPlayer.name.toLowerCase().trim());
        if (hasReg) {
          const updateQuery = (hasReg.id && isUuid(hasReg.id))
            ? supabase.from('event_registrations').update({ name: editName.trim(), role: editRole, stats: editStats, avatar: editAvatar }).eq('id', hasReg.id)
            : supabase.from('event_registrations').update({ name: editName.trim(), role: editRole, stats: editStats, avatar: editAvatar }).eq('host_id', leagueId).eq('name', selectedPlayer.name);
          await updateQuery;
        }
      } catch (err) {
        console.error("Error saving stats:", err);
        alert("Error al guardar cambios: " + err.message);
        setRoster(previousRoster);
        setEventRegistrations(previousRegs);
        setSelectedPlayer(previousSelected);
      }
    }
    setIsEditingSelf(false);
  };

  const handleToggleInjury = async (playerId) => {
    if (!isSupabaseConfigured || !supabase) {
      alert("La base de datos no está configurada.");
      return;
    }
    const previousRoster = [...roster];
    const updatedRoster = roster.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          condition: {
            ...p.condition,
            isResting: !(p.condition?.isResting || false)
          }
        };
      }
      return p;
    });
    setRoster(updatedRoster);
    setSelectedPlayer(updatedRoster.find(p => p.id === playerId));
    try {
      const { error } = await supabase
        .from('league_state')
        .update({ roster: updatedRoster, updated_at: new Date().toISOString() })
        .eq('host_id', leagueId);
      if (error) throw error;
    } catch (err) {
      console.error("Error toggling injury:", err);
      alert("Error al actualizar estado: " + err.message);
      setRoster(previousRoster);
      setSelectedPlayer(previousRoster.find(p => p.id === playerId));
    }
  };


  if (!leagueExists) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'var(--pitch-black)', padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-secondary)' }}>No se pudo encontrar la liga. Verifica que el enlace sea correcto.</div>;
  }

  if (selectedPlayer) {
    const isMyCard = selectedPlayer.id === currentUser?.id || selectedPlayer.player_id === currentUser?.id;
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
          onClick={() => {
            setSelectedPlayer(null);
            setIsEditingSelf(false);
          }} 
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
          {isEditingSelf ? (
            <div className="glass-panel" style={{ width: '100%', padding: '2rem 1.5rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h2 className="glow-text-volt" style={{ fontSize: '1.8rem', textAlign: 'center', margin: 0 }}>EDITAR HABILIDADES</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--off-white)', fontWeight: 'bold' }}>Nombre / Apodo</span>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field" placeholder="Messi" required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--off-white)', fontWeight: 'bold' }}>Posición</span>
                <div className="segmented-control" style={{ display: 'flex', gap: '0.3rem', width: '100%' }}>
                  {[
                    { val: 'Arquero', label: 'GK' },
                    { val: 'Defensor', label: 'DEF' },
                    { val: 'Mediocampo', label: 'MED' },
                    { val: 'Delantero', label: 'DEL' }
                  ].map(r => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => setEditRole(r.val)}
                      className={`segment-btn ${editRole === r.val ? 'active' : ''}`}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.2rem',
                        fontSize: '0.8rem',
                        background: editRole === r.val ? (r.val === 'Arquero' ? 'rgb(168, 85, 247)' : (r.val === 'Defensor' ? 'var(--electric-cyan)' : (r.val === 'Mediocampo' ? 'var(--volt-lime)' : 'var(--crimson-red)'))) : 'rgba(255,255,255,0.05)',
                        color: editRole === r.val ? 'black' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--off-white)', fontWeight: 'bold' }}>Avatar</span>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem 0', scrollbarWidth: 'thin' }}>
                  {['👤', '⚽', '🦁', '🐯', '🦅', '🦊', '🐻', '🐼', '🐨', '🐺', '👑', '⚡', '💎', '🔥', '🎨', '🚀'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditAvatar(emoji)}
                      style={{
                        fontSize: '1.5rem',
                        padding: '0.4rem',
                        background: editAvatar === emoji ? 'rgba(204,255,0,0.15)' : 'transparent',
                        border: editAvatar === emoji ? '1px solid var(--volt-lime)' : '1px solid transparent',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minWidth: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {Object.keys(editStats).map(attr => (
                  <div key={attr} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--off-white)' }}>
                      <span style={{ fontWeight: 'bold' }}>{attr.toUpperCase()}</span>
                      <span className="glow-text-volt">{editStats[attr]}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="99"
                      value={editStats[attr]}
                      onChange={(e) => setEditStats({ ...editStats, [attr]: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--volt-lime)' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
                <button
                  onClick={saveSelfStats}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.8rem', fontSize: '0.95rem', fontWeight: 'bold' }}
                >
                  💾 GUARDAR
                </button>
                <button
                  onClick={() => setIsEditingSelf(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'var(--off-white)',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontFamily: 'var(--font-primary)',
                    fontWeight: 'bold'
                  }}
                >
                  ❌ CANCELAR
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '-40px' }}>
                <PlayerCard 
                   name={selectedPlayer.name} 
                   position={selectedPlayer.role.substring(0,3).toUpperCase()} 
                   stats={selectedPlayer.stats} 
                   avatar={selectedPlayer.avatar} 
                   ovr={Math.round(Math.round((selectedPlayer.stats.pac + selectedPlayer.stats.sho + selectedPlayer.stats.pas + selectedPlayer.stats.dri + selectedPlayer.stats.def + selectedPlayer.stats.phy) / 6) * (0.5 + 0.5 * ((selectedPlayer.condition?.stamina ?? 100) / 100)))} 
                   stamina={selectedPlayer.condition?.stamina ?? 100} 
                   badges={getPlayerBadges(selectedPlayer)}
                   isInjured={selectedPlayer.condition?.isResting}
                   onClick={isMyCard ? () => setIsEditingSelf(true) : undefined}
                />
                {isMyCard && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                    <button 
                      onClick={() => handleToggleInjury(selectedPlayer.id)} 
                      className="btn-primary" 
                      style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.9rem', background: selectedPlayer.condition?.isResting ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' : 'rgba(255,59,48,0.1)', borderColor: selectedPlayer.condition?.isResting ? '#25D366' : '#FF3B30', color: selectedPlayer.condition?.isResting ? 'white' : '#FF3B30', fontWeight: 'bold' }}
                    >
                      {selectedPlayer.condition?.isResting ? '✅ DAR ALTA' : '🚑 HOSPITAL'}
                    </button>
                    <button 
                      onClick={() => setIsEditingSelf(true)} 
                      className="btn-primary" 
                      style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.9rem', background: 'var(--electric-cyan)', borderColor: 'var(--electric-cyan)', color: 'black', fontWeight: 'bold' }}
                    >
                      ✏️ EDITAR SKILLS
                    </button>
                  </div>
                )}
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
                  
                  <button 
                    onClick={() => handleCashPayment(currentUser?.id)}
                    style={{ 
                      background: 'transparent',
                      border: '1px solid #00b347',
                      color: '#00b347',
                      padding: '0.8rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      marginTop: '0.5rem',
                      boxShadow: '0 0 10px rgba(0,179,71,0.1)'
                    }}
                  >
                    💵 Pago en Efectivo (Avisar al Host)
                  </button>
                </div>
              )}

              <p style={{ color: 'var(--off-white)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>Comparte tu Ficha Táctica 📸</p>
            </>
          )}
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pitch-black)', padding: '1rem 0.5rem 80px 0.5rem', fontFamily: 'var(--font-secondary)' }}>
      <div style={{ display: 'none' }} />

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
          {walkoutRevealStage === 0 && (
            <div style={{ zIndex: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
              <h2 className="glow-text-volt" style={{ fontSize: '2.2rem', letterSpacing: '4px', fontStyle: 'italic', fontWeight: '900' }}>
                DRAFT PACK OPENING
              </h2>
              <p style={{ color: 'var(--electric-cyan)', letterSpacing: '2px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                LA IA HA GENERADO EL BALANCEO
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
                  width: '160px',
                  height: '240px',
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
                  transform: 'perspective(1000px) rotateY(-10deg) rotateX(10deg)',
                  transition: 'transform 0.3s',
                }}
              >
                <div style={{ border: '1px solid rgba(255,255,255,0.4)', width: '100%', height: '100%', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0.5rem' }}>
                  <div style={{ color: 'white', fontWeight: '900', fontSize: '1.4rem', fontStyle: 'italic', letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>DRAFT</div>
                  <div style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.6))' }}>✨</div>
                  <div style={{ color: 'white', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '3px' }}>OPEN</div>
                </div>
              </div>
              
              <p style={{ color: 'var(--off-white)', letterSpacing: '1px', fontSize: '0.7rem', marginTop: '1rem', animation: 'pulse 1.5s infinite' }}>
                TOCA PARA REVELAR
              </p>
            </div>
          )}

          {walkoutRevealStage === 1 && (
            <div style={{ zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#FFF', animation: 'pulse 0.1s infinite' }}>
              <div className="pack-glitch" style={{ fontSize: '3rem', fontWeight: '900', color: 'black', fontStyle: 'italic', letterSpacing: '4px', textAlign: 'center' }}>
                ABRIENDO SOBRE...
              </div>
            </div>
          )}

          {walkoutRevealStage === 2 && walkoutPlayers && walkoutPlayers.length > 0 && (
            <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '100vw', textAlign: 'center' }}>
              <h2 className="glow-text-volt" style={{ fontSize: '1.8rem', fontWeight: '900', fontStyle: 'italic', margin: 0, letterSpacing: '2px' }}>
                ⭐ TOP JUGADORES IA ⭐
              </h2>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', padding: '0 10px' }}>
                {walkoutPlayers.map((wp, i) => (
                  <div key={i} className="card-reveal-anim" style={{ transform: 'scale(0.75)', margin: '-20px', filter: i < 2 ? 'drop-shadow(0 0 20px rgba(204,255,0,0.3))' : 'drop-shadow(0 0 20px rgba(0,240,255,0.3))' }}>
                    <PlayerCard 
                      name={wp.name}
                      position={wp.role.substring(0,3).toUpperCase()}
                      stats={wp.stats}
                      avatar={wp.avatar}
                      ovr={calcOvr(wp)}
                      stamina={wp.condition?.stamina ?? 100}
                      badges={getPlayerBadges(wp)}
                      isInjured={wp.condition?.isResting}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button 
                  onClick={() => {
                    setShowPackOpening(false);
                    setIsDrafting(true);
                    setRevealedCount(0);
                  }} 
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '1rem 2rem', fontSize: '1rem', boxShadow: '0 0 20px rgba(204,255,0,0.4)' }}
                >
                  VER EQUIPOS COMPLETOS ⏭️
                </button>
              </div>
            </div>
          )}
        </div>
      )}      {paymentSuccessMsg && (
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

      <header style={{ marginBottom: '1.5rem', textAlign: 'center', perspective: '800px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <img 
              src="/logo.png" 
              alt="FULBO Logo" 
              style={{ 
                width: '50px', 
                height: '50px', 
                objectFit: 'contain', 
                mixBlendMode: 'screen', 
                transform: 'rotateY(20deg) rotateX(15deg) translateZ(10px)' 
              }} 
            />
            <h1 style={{ fontSize: '2.2rem', margin: 0, fontStyle: 'italic', fontWeight: '900', letterSpacing: '1.5px', paddingRight: '0.2em', background: 'linear-gradient(135deg, var(--volt-lime) 0%, #ffffff 40%, var(--electric-cyan) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.6))' }}>FULBO</h1>
          </div>
          <span style={{ color: 'var(--electric-cyan)', fontSize: '0.6rem', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '900', marginTop: '0.4rem', textShadow: '0 0 10px rgba(0, 240, 255, 0.8)' }}>THE ELITE MATCHMAKING ENGINE</span>
          <p style={{ color: 'var(--off-white)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '0.4rem', fontWeight: '600', fontSize: '0.65rem', opacity: 0.8 }}>
            Powered by La FactorIA
          </p>
        </div>
      </header>
      {/* Barra de Navegación Inferior */}
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
        <button onClick={() => setActiveTab('active_matches')} style={{ background: 'transparent', color: activeTab === 'active_matches' ? 'var(--volt-lime)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '50px' }}>
          <span style={{ fontSize: '1.4rem' }}>⚽</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Partidos</span>
        </button>

        <button onClick={() => setActiveTab('mificha')} style={{ background: 'transparent', color: activeTab === 'mificha' ? 'var(--ultimate-gold)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '50px' }}>
          <span style={{ fontSize: '1.4rem' }}>🛡️</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Mi Ficha</span>
        </button>

        <button onClick={() => setActiveTab('leaderboard')} style={{ background: 'transparent', color: activeTab === 'leaderboard' ? 'var(--volt-lime)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '50px' }}>
          <span style={{ fontSize: '1.4rem' }}>🏆</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Ranking</span>
        </button>

        <button onClick={() => setActiveTab('history')} style={{ background: 'transparent', color: activeTab === 'history' ? 'var(--volt-lime)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '50px' }}>
          <span style={{ fontSize: '1.4rem' }}>📚</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Historial</span>
        </button>


        
        <button onClick={onLogout} style={{ background: 'transparent', color: 'var(--crimson-red)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '50px' }}>
          <span style={{ fontSize: '1.4rem' }}>🚪</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>Salir</span>
        </button>
      </nav>

      {activeTab === 'active_matches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '600px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
          {!leagueId ? (
            <div className="glass-panel" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--off-white)' }}>
              <span style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}>🔗</span>
              <h3>Bienvenido a Fulbo</h3>
              <p>No tienes un enlace de liga activo. Para unirte a un partido, pídele a tu Organizador que te envíe el link de invitación.</p>
            </div>
          ) : activeEvent && !isEventExpired(activeEvent) ? (
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
                <div>
                  <span style={{
                    background: activeEvent.status === 'lobby' ? 'var(--volt-lime)' : (activeEvent.status === 'preview' ? 'var(--ultimate-gold)' : 'var(--crimson-red)'),
                    color: 'black',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase'
                  }}>
                    {activeEvent.status === 'lobby' ? 'Convocatoria Abierta' : (activeEvent.status === 'preview' ? 'Equipos Listos' : 'Partido en Curso ⚽')}
                  </span>
                  <h3 style={{ color: 'white', margin: '0.4rem 0 0 0', fontSize: '1.1rem' }}>
                    Partido: {activeEvent.date} @ {activeEvent.time}
                  </h3>
                </div>
                <span style={{ color: 'var(--electric-cyan)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  {activeEvent.format} Jugadores
                </span>
              </div>

              {/* Lobby State */}
              {activeEvent.status === 'lobby' && (
                <div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--off-white)' }}>Inscritos:</span>
                      <strong style={{ color: 'white' }}>{uniqueRegistrations.length} / {activeEvent.format}</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                      <div style={{
                        width: `${Math.min(100, (uniqueRegistrations.length / activeEvent.format) * 100)}%`,
                        height: '100%',
                        background: uniqueRegistrations.length >= activeEvent.format ? 'var(--crimson-red)' : 'var(--volt-lime)',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--off-white)' }}>Vacantes disponibles:</span>
                      <strong style={{ color: uniqueRegistrations.length >= activeEvent.format ? 'var(--crimson-red)' : 'var(--volt-lime)' }}>
                        {Math.max(0, activeEvent.format - uniqueRegistrations.length)}
                      </strong>
                    </div>
                  </div>

                  {/* Confirmed list */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: 'var(--electric-cyan)', fontSize: '0.85rem', margin: '0 0 0.6rem 0', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>CONVOCADOS ({uniqueRegistrations.length})</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {uniqueRegistrations.length === 0 ? (
                        <span style={{ color: 'var(--off-white)', fontSize: '0.8rem' }}>Nadie registrado aún. ¡Sé el primero!</span>
                      ) : (
                        uniqueRegistrations.map((r, i) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', color: 'white', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>{r.avatar || '👤'}</span>
                            <span style={{ fontWeight: 'bold' }}>{r.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {isUserRegistered ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid #25D366', color: '#25D366', padding: '1.2rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        ¡Estás inscrito en este partido! ✅<br />
                        <span style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.8 }}>Espera a que el organizador arme los equipos.</span>
                      </div>
                      {activeEvent.pitchCost > 0 && (
                        <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--electric-cyan)', padding: '1.2rem', borderRadius: '8px', animation: 'fadeIn 0.3s' }}>
                          <h4 style={{ color: 'var(--ultimate-gold)', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>💰 LA VAQUITA</h4>
                          <p style={{ color: 'var(--off-white)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Cuota a pagar: <strong className="glow-text-volt" style={{ color: 'var(--volt-lime)', fontSize: '1.1rem' }}>${(activeEvent.pitchCost / (activeEvent.format * 2)).toFixed(2)}</strong>
                          </p>
                          {activeEvent.payments && (activeEvent.payments[myPlayerCard?.id] || activeEvent.payments[regName]) ? (
                            <div style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', padding: '0.8rem', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                              ✅ Pago Confirmado (Avisado)
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              <button 
                                onClick={() => window.open('https://link.mercadopago.com.ar/fulboapp', '_blank')}
                                className="btn-primary" 
                                style={{ background: '#009EE3', borderColor: '#009EE3', color: 'white', padding: '0.8rem', fontSize: '0.9rem' }}
                              >
                                🤝 Pagar con Mercado Pago
                              </button>
                              <button 
                                onClick={async () => {
                                  try {
                                    if (isSupabaseConfigured && supabase) {
                                      const { data } = await supabase.from('league_state').select('active_event').eq('host_id', activeEvent.host_id).single();
                                      if (data && data.active_event) {
                                        const ev = data.active_event;
                                        if (!ev.payments) ev.payments = {};
                                        const pid = myPlayerCard?.id || regName;
                                        ev.payments[pid] = true;
                                        await supabase.from('league_state').update({ active_event: ev }).eq('host_id', activeEvent.host_id);
                                        alert("¡Avisaste que pagas en efectivo!");
                                      }
                                    }
                                  } catch(e) { console.error(e); }
                                }}
                                style={{ background: 'transparent', border: '1px solid var(--volt-lime)', color: 'var(--volt-lime)', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                💵 Pagar en Efectivo (Al llegar)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {uniqueRegistrations.length >= activeEvent.format ? (
                        <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid var(--crimson-red)', color: 'var(--crimson-red)', padding: '1.2rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          Cupo completo. No hay más vacantes.
                        </div>
                      ) : (
                        <div>
                          {!isRegistering ? (
                            <button onClick={() => setIsRegistering(true)} className="btn-primary" style={{ padding: '0.8rem' }}>
                              INSCRIBIRSE AHORA
                            </button>
                          ) : (
                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '1.2rem', borderRadius: '8px', animation: 'fadeIn 0.2s' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 style={{ color: 'var(--electric-cyan)', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>FICHA TÉCNICA</h4>
                                <button onClick={() => setIsRegistering(false)} style={{ background: 'none', border: 'none', color: 'var(--off-white)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                              </div>
                              
                              <form onSubmit={handleRegSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <input type="text" placeholder="Tu Nombre (Ej: Messi)" value={regName} onChange={(e) => setRegName(e.target.value)} required className="input-field" />
                                {roster.some(p => p.name && p.name.toLowerCase().trim() === regName.toLowerCase().trim() && p.condition?.isResting) && (
                                  <div style={{ color: 'var(--crimson-red)', fontSize: '0.8rem', fontWeight: 'bold', animation: 'pulse 1s infinite', marginTop: '-0.3rem' }}>
                                    ⚠️ Jugador lesionado. No puedes inscribirte.
                                  </div>
                                )}
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--off-white)', fontWeight: 'bold' }}>POSICIÓN EN LA CANCHA</span>
                                  <div className="segmented-control">
                                    {[
                                      { val: 'Arquero', label: 'GK' },
                                      { val: 'Defensor', label: 'DEF' },
                                      { val: 'Mediocampo', label: 'MED' },
                                      { val: 'Delantero', label: 'DEL' }
                                    ].map(r => (
                                      <button
                                        key={r.val}
                                        type="button"
                                        onClick={() => setRegRole(r.val)}
                                        className={`segment-btn ${regRole === r.val ? 'active' : ''}`}
                                        style={regRole === r.val ? {
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

                                <AvatarSelector onSelectAvatar={setRegAvatar} currentAvatar={regAvatar} />
                                
                                {(() => {
                                  const isExistingPlayer = regName.trim().length > 0 && roster.some(p => p.name && p.name.toLowerCase().trim() === regName.toLowerCase().trim());
                                  return !isExistingPlayer ? (
                                    <>
                                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px' }}>
                                  <h5 style={{ color: 'var(--pure-white)', margin: '0 0 0.6rem 0', fontSize: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}>ATRIBUTOS TÁCTICOS</h5>
                                  {['pac', 'sho', 'pas', 'dri', 'def', 'phy'].map(attr => (
                                    <div key={attr} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
                                      <span style={{ color: 'var(--off-white)', textTransform: 'uppercase', width: '25px', fontWeight: 'bold', fontSize: '0.7rem' }}>{attr}</span>
                                      <input type="range" min="1" max="99" value={regStats[attr]} onChange={(e) => setRegStats({...regStats, [attr]: parseInt(e.target.value)})} style={{ flex: 1, accentColor: 'var(--volt-lime)' }} />
                                      <span className="glow-text-volt" style={{ width: '20px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.75rem' }}>{regStats[attr]}</span>
                                    </div>
                                  ))}
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', background: 'rgba(204,255,0,0.1)', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--volt-lime)' }}>
                                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>OVR PROYECTADO:</span>
                                  <span className="glow-text-volt" style={{ fontSize: '1.5rem', fontWeight: '900' }}>{Math.round((regStats.pac + regStats.sho + regStats.pas + regStats.dri + regStats.def + regStats.phy)/6)}</span>
                                </div>
                                    </>
                                  ) : (
                                    <div style={{ background: 'rgba(0,240,255,0.1)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--electric-cyan)', textAlign: 'center' }}>
                                      <span style={{ color: 'var(--electric-cyan)', fontSize: '0.8rem', fontWeight: 'bold' }}>✓ Ya tienes tu Ficha Táctica en el servidor</span>
                                    </div>
                                  );
                                })()}
                                
                                <button type="submit" className="btn-primary" style={{ padding: '0.7rem', fontSize: '0.9rem' }}>ENVIAR FICHA AL DRAFT</button>
                              </form>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Preview or Live Match State */}
              {(activeEvent.status === 'preview' || activeEvent.status === 'match') && (
                <div>
                  {activeEvent.status === 'match' && activeEvent.matchScore && (
                    <div style={{
                      background: 'rgba(255,59,48,0.1)',
                      border: '2px solid var(--crimson-red)',
                      borderRadius: '8px',
                      padding: '1rem',
                      textAlign: 'center',
                      marginBottom: '1.5rem',
                      animation: 'pulse 1.5s infinite'
                    }}>
                      <div style={{ color: 'var(--crimson-red)', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.3rem' }}>● Partido En Vivo</div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
                        <span style={{ color: 'var(--volt-lime)', fontWeight: '900', fontSize: '2.5rem', fontFamily: 'var(--font-primary)' }}>{activeEvent.matchScore.A}</span>
                        <span style={{ color: 'var(--off-white)', fontSize: '1.2rem', fontWeight: 'bold' }}>-</span>
                        <span style={{ color: 'var(--electric-cyan)', fontWeight: '900', fontSize: '2.5rem', fontFamily: 'var(--font-primary)' }}>{activeEvent.matchScore.B}</span>
                      </div>
                    </div>
                  )}

                  {/* Balanced Teams Grid */}
                  {activeEvent.status === 'preview' && !teamsRevealed ? (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', background: 'rgba(0,0,0,0.4)' }}>
                      {isRevealing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '50px', height: '50px', border: '4px solid rgba(204,255,0,0.1)', borderTop: '4px solid var(--volt-lime)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          <h3 className="glow-text-volt" style={{ animation: 'pulse 1.5s infinite', margin: 0, fontFamily: 'var(--font-primary)' }}>CALCULANDO TÁCTICAS IA...</h3>
                          <p style={{ color: 'var(--off-white)', fontSize: '0.85rem', margin: 0 }}>Barajando posiciones y equilibrando MMR</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', animation: 'fadeIn 0.4s' }}>
                          <span style={{ fontSize: '3.5rem', filter: 'grayscale(1)', opacity: 0.6 }}>🕵️‍♂️</span>
                          <div>
                            <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>¡Los equipos están listos!</h3>
                            <p style={{ color: 'var(--off-white)', fontSize: '0.9rem', margin: 0 }}>El administrador ha finalizado el armado.</p>
                          </div>
                          <button onClick={handleRevealTeams} className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem', width: '100%', boxShadow: '0 0 15px rgba(204,255,0,0.3)' }}>
                            DESCUBRIR EQUIPOS
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeIn 0.5s ease-out' }}>
                      {isDrafting && (
                        <h2 style={{ color: 'var(--crimson-red)', letterSpacing: '2px', fontSize: '1rem', animation: 'pulse 1s infinite', textAlign: 'center', margin: 0 }}>
                          🔴 REVELANDO EQUIPOS...
                        </h2>
                      )}
                    {/* Team A */}
                    {activeEvent.teamA && (
                      <div style={{ background: 'rgba(204,255,0,0.02)', border: '1px solid rgba(204,255,0,0.1)', padding: '1rem', borderRadius: '8px' }}>
                        <h4 className="glow-text-volt" style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>EQUIPO A</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {activeEvent.teamA.slice(0, Math.ceil(revealedCount / 2)).map(p => (
                            <div key={p.id} onClick={() => setSelectedPlayer(p)} style={{ background: 'rgba(0,0,0,0.4)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'white' }}>
                              <span>{p.avatar || '👤'}</span>
                              <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                              <span style={{ color: 'var(--volt-lime)', fontSize: '0.7rem' }}>({p.role.substring(0,3).toUpperCase()})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team B */}
                    {activeEvent.teamB && (
                      <div style={{ background: 'rgba(0,240,255,0.02)', border: '1px solid rgba(0,240,255,0.1)', padding: '1rem', borderRadius: '8px' }}>
                        <h4 className="glow-text-cyan" style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>EQUIPO B</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {activeEvent.teamB.slice(0, Math.floor(revealedCount / 2)).map(p => (
                            <div key={p.id} onClick={() => setSelectedPlayer(p)} style={{ background: 'rgba(0,0,0,0.4)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'white' }}>
                              <span>{p.avatar || '👤'}</span>
                              <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                              <span style={{ color: 'var(--electric-cyan)', fontSize: '0.7rem' }}>({p.role.substring(0,3).toUpperCase()})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '2rem' }}>📅</span>
              <h3 style={{ color: 'white', marginTop: '1rem' }}>No hay partidos programados</h3>
              <p style={{ color: 'var(--off-white)', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
                Ponte en contacto con el administrador del club para que programe la próxima fecha.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
          {!leagueId ? (
            <div className="glass-panel" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--off-white)' }}>
              <h3>Leaderboard No Disponible</h3>
              <p>Ingresa a una liga específica usando su enlace de invitación para ver el ranking.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button 
                    onClick={() => setLeaderboardFilter('active')} 
                    style={{ 
                      background: leaderboardFilter === 'active' ? 'linear-gradient(135deg, var(--volt-lime) 0%, #128C7E 100%)' : 'transparent', 
                      color: leaderboardFilter === 'active' ? 'black' : 'var(--off-white)',
                      border: 'none',
                      borderRadius: '25px',
                      padding: '0.5rem 1.2rem',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    🏃 ACTIVOS
                  </button>
                  <button 
                    onClick={() => setLeaderboardFilter('inactive')} 
                    style={{ 
                      background: leaderboardFilter === 'inactive' ? 'linear-gradient(135deg, var(--crimson-red) 0%, #8b0000 100%)' : 'transparent', 
                      color: leaderboardFilter === 'inactive' ? 'white' : 'var(--off-white)',
                      border: 'none',
                      borderRadius: '25px',
                      padding: '0.5rem 1.2rem',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    💤 INACTIVOS
                  </button>
                  <button 
                    onClick={() => setLeaderboardFilter('hospital')} 
                    style={{ 
                      background: leaderboardFilter === 'hospital' ? 'linear-gradient(135deg, #FF3B30 0%, #8b0000 100%)' : 'transparent', 
                      color: leaderboardFilter === 'hospital' ? 'white' : 'var(--off-white)',
                      border: 'none',
                      borderRadius: '25px',
                      padding: '0.5rem 1.2rem',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    🚑 HOSPITAL
                  </button>
                </div>
              </div>

              {(() => {
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
                const sortedRoster = [...filteredRoster].sort((a, b) => (b.glicko?.rating || 1500) - (a.glicko?.rating || 1500));

                if (sortedRoster.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--off-white)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚽</div>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>No hay jugadores en esta categoría.</p>
                    </div>
                  );
                }

                return sortedRoster.map((p, idx) => {
                  const pj = p.history?.pj || 0;
                  const pg = p.history?.pg || 0;
                  const pe = p.history?.pe || 0;
                  const pp = p.history?.pp || 0;
                  const goals = p.history?.goals || 0;
                  const winRate = pj > 0 ? Math.round((pg/pj)*100) : 0;
                  const mmr = Math.round(p.glicko?.rating || 1500);
                  
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedPlayer(p)} 
                      className="glass-panel"
                      style={{ 
                        borderRadius: '16px', 
                        padding: '1.2rem', 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '0.8rem', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        background: 'rgba(255,255,255,0.03)',
                        backdropFilter: 'blur(10px)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(204,255,0,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(204,255,0,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }}
                    >
                      {/* Top Header Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          {/* Rank Indicator */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '50%',
                            background: idx === 0 ? 'rgba(255, 215, 0, 0.2)' : idx === 1 ? 'rgba(192, 192, 192, 0.2)' : idx === 2 ? 'rgba(205, 127, 50, 0.2)' : 'rgba(255,255,255,0.05)',
                            border: idx === 0 ? '1px solid var(--ultimate-gold)' : idx === 1 ? '1px solid #c0c0c0' : idx === 2 ? '1px solid #cd7f32' : '1px solid rgba(255,255,255,0.1)',
                            color: idx === 0 ? 'var(--ultimate-gold)' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--off-white)',
                            fontWeight: 'bold', 
                            fontSize: '0.9rem' 
                          }}>
                            {idx + 1}
                          </div>

                          {/* Avatar */}
                          <div style={{ 
                            width: '45px', 
                            height: '45px', 
                            borderRadius: '50%', 
                            background: 'black', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            {p.avatar?.startsWith('data:image') ? (
                              <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>{p.avatar || '👤'}</span>
                            )}
                          </div>

                          {/* Name and Role */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {p.name}
                              {idx === 0 && <span style={{ fontSize: '1rem' }}>👑</span>}
                            </div>
                            <div style={{ color: 'var(--off-white)', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {p.role}
                            </div>
                          </div>
                        </div>

                        {/* MMR and Win Rate */}
                        <div style={{ textAlign: 'right' }}>
                          <div className="glow-text-volt" style={{ fontSize: '1.3rem', fontWeight: '900', fontFamily: 'var(--font-primary)' }}>
                            {mmr} <span style={{ fontSize: '0.7rem', color: 'var(--off-white)', fontWeight: 'normal' }}>MMR</span>
                          </div>
                          <div style={{ color: 'var(--electric-cyan)', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            {winRate}% WR
                          </div>
                        </div>
                      </div>

                      {/* Divider line */}
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.2rem 0' }} />

                      {/* Stats Grid Footer */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ color: 'var(--off-white)', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>PJ</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '0.1rem', color: 'white' }}>{pj}</div>
                        </div>
                        <div style={{ background: 'rgba(204,255,0,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(204,255,0,0.05)' }}>
                          <div style={{ color: 'var(--volt-lime)', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>PG</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '0.1rem', color: 'var(--volt-lime)' }}>{pg}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ color: 'var(--off-white)', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>PE</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '0.1rem', color: 'white' }}>{pe}</div>
                        </div>
                        <div style={{ background: 'rgba(255,59,48,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(255,59,48,0.05)' }}>
                          <div style={{ color: 'var(--crimson-red)', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>PP</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '0.1rem', color: 'var(--crimson-red)' }}>{pp}</div>
                        </div>
                        <div style={{ background: 'rgba(0,240,255,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(0,240,255,0.05)' }}>
                          <div style={{ color: 'var(--electric-cyan)', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>GOLES</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '0.1rem', color: 'var(--electric-cyan)' }}>{goals}</div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === 'mificha' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '600px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
          {!leagueId ? (
            <div className="glass-panel" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--off-white)' }}>
              <h3>Ficha Táctica No Disponible</h3>
              <p>Ingresa a una liga específica usando su enlace de invitación para ver tu ficha.</p>
            </div>
          ) : myPlayerCard ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--ultimate-gold)' }}>
              <h2 className="glow-text-volt" style={{ color: 'var(--ultimate-gold)' }}>MI FICHA TÁCTICA</h2>
              
              <div style={{ margin: '2rem 0', display: 'flex', justifyContent: 'center' }}>
                <PlayerCard 
                  name={myPlayerCard.name}
                  position={myPlayerCard.role.substring(0,3).toUpperCase()}
                  stats={myPlayerCard.stats}
                  avatar={myPlayerCard.avatar}
                  ovr={calcOvr(myPlayerCard)}
                  stamina={myPlayerCard.condition?.stamina ?? 100}
                  badges={getPlayerBadges(myPlayerCard)}
                  isInjured={myPlayerCard.condition?.isResting}
                />
              </div>


              <div style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '10px', textAlign: 'left', borderLeft: '4px solid var(--volt-lime)' }}>
                <h4 style={{ color: 'var(--volt-lime)', margin: '0 0 0.5rem 0' }}>📈 EVOLUCIÓN AUTOMÁTICA (IA)</h4>
                <p style={{ color: 'var(--off-white)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                  Tu ficha táctica evoluciona de a poco con cada partido:
                  <br/><br/>
                  • <b>Victorias:</b> Todo tu equipo suma +1 a todos los skills.
                  <br/>
                  • <b>Goles Anotados:</b> Sumas +1 en Tiro (SHO) por cada gol a favor.
                  <br/><br/>
                  <i>La IA actualizará tu carta automáticamente al finalizar cada evento.</i>
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--off-white)' }}>
              <h3 style={{ color: 'var(--electric-cyan)', marginBottom: '1rem' }}>CREAR MI FICHA DE JUGADOR</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '2rem' }}>Configura tu tarjeta táctica. Esta configuración se usará cuando te inscribas a los partidos.</p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!regName.trim()) return;
                localStorage.setItem('guestName', regName.trim());
                localStorage.setItem('guestRole', regRole);
                localStorage.setItem('guestStats', JSON.stringify(regStats));
                localStorage.setItem('guestAvatar', regAvatar);
                window.location.reload(); 
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                 <input type="text" placeholder="Tu Nombre (Ej: Messi)" value={regName} onChange={(e) => setRegName(e.target.value)} required className="input-field" />
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--off-white)', fontWeight: 'bold' }}>POSICIÓN EN LA CANCHA</span>
                    <div className="segmented-control">
                      {[
                        { val: 'Arquero', label: 'GK' },
                        { val: 'Defensor', label: 'DEF' },
                        { val: 'Mediocampo', label: 'MED' },
                        { val: 'Delantero', label: 'DEL' }
                      ].map(r => (
                        <button type="button" key={r.val} onClick={() => setRegRole(r.val)} className={`segment-btn ${regRole === r.val ? 'active' : ''}`}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AvatarSelector onSelectAvatar={setRegAvatar} currentAvatar={regAvatar} />
                  
                  <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h5 style={{ color: 'var(--volt-lime)', margin: '0 0 1rem 0' }}>REPARTE TUS PUNTOS (MAX 500)</h5>
                    {Object.keys(regStats).map(s => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                        <span style={{ width: '40px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--electric-cyan)', fontSize: '0.8rem' }}>{s}</span>
                        <input type="range" min="1" max="99" value={regStats[s]} onChange={(e) => setRegStats({...regStats, [s]: parseInt(e.target.value)})} style={{ flex: 1, accentColor: 'var(--volt-lime)' }} />
                        <span style={{ width: '30px', textAlign: 'right', fontWeight: 'bold' }}>{regStats[s]}</span>
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: Object.values(regStats).reduce((a,b)=>a+b,0) > 500 ? 'var(--crimson-red)' : 'var(--off-white)' }}>
                      Total: {Object.values(regStats).reduce((a,b)=>a+b,0)} / 500
                    </div>
                  </div>

                  <button type="submit" disabled={Object.values(regStats).reduce((a,b)=>a+b,0) > 500} className="btn-primary" style={{ marginTop: '1rem' }}>
                    GUARDAR FICHA
                  </button>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
          {matchHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--off-white)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
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
