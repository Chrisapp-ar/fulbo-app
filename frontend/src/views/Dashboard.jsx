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
].map(p => ({ ...p, history: { pj: 0, pg: 0, goals: 0 }, glicko: { rating: 1500, rd: 350, vol: 0.06, history: [1500] }, financial: { debt: 0, isBanned: false }, condition: { stamina: 100 } }));

const Dashboard = ({ onLogout }) => {
  const [roster, setRoster] = useState(() => {
    const saved = localStorage.getItem('fulbo_roster');
    return saved ? JSON.parse(saved) : DEFAULT_ROSTER;
  });

  const [matchHistory, setMatchHistory] = useState(() => {
    const saved = localStorage.getItem('fulbo_match_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('fulbo_roster', JSON.stringify(roster));
    if (isSupabaseConfigured && supabase) {
       supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) supabase.from('league_state').upsert({ host_id: user.id, roster, updated_at: new Date().toISOString() }).then();
       });
    }
  }, [roster]);

  useEffect(() => {
    localStorage.setItem('fulbo_match_history', JSON.stringify(matchHistory));
    if (isSupabaseConfigured && supabase) {
       supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) supabase.from('league_state').upsert({ host_id: user.id, match_history: matchHistory, updated_at: new Date().toISOString() }).then();
       });
    }
  }, [matchHistory]);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const loadCloudState = async () => {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) return;
         const { data, error } = await supabase.from('league_state').select('*').eq('host_id', user.id).single();
         if (data) {
            if (data.roster && data.roster.length > 0) setRoster(data.roster);
            if (data.match_history && data.match_history.length > 0) setMatchHistory(data.match_history);
            if (data.active_event) setActiveEvent(data.active_event);
         }
      };
      loadCloudState();
    }
  }, []);

  const [viewMode, setViewMode] = useState('builder'); 
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState(null);
  
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventFormat, setEventFormat] = useState(10);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('20:00');
  const [eventRegistrations, setEventRegistrations] = useState([]);
  
  const [hostId, setHostId] = useState(null);
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
       supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) setHostId(user.id);
       });
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured && supabase && hostId) {
       supabase.from('league_state').upsert({ host_id: hostId, active_event: activeEvent, updated_at: new Date().toISOString() }).then();
    }
  }, [activeEvent, hostId]);

  useEffect(() => {
    if (!activeEvent || !isSupabaseConfigured || !supabase || !hostId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from('event_registrations').select('*').eq('host_id', hostId);
      if (data) setEventRegistrations(data);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeEvent, hostId]);

  const copyLeagueLink = () => {
    if (hostId) {
       navigator.clipboard.writeText(`${window.location.origin}/?league=${hostId}`);
       alert('¡Enlace Mágico copiado al portapapeles! Pégalo en WhatsApp para que los jugadores vean sus cartas.');
    } else {
       alert('El enlace solo está disponible si inicias sesión real en la Nube (Cloud Security Gateway).');
    }
  };
  
  const [name, setName] = useState('');
  const [role, setRole] = useState('Mediocampo');
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const [skills, setSkills] = useState({ pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  
  const [pitchCost, setPitchCost] = useState('');
  const [paymentsMap, setPaymentsMap] = useState({});
  
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  const [matchScore, setMatchScore] = useState({ A: 0, B: 0 });
  const [playerGoals, setPlayerGoals] = useState({}); 
  const [lastMatchResult, setLastMatchResult] = useState(null);

  const handleSkillChange = (e) => setSkills({...skills, [e.target.name]: parseInt(e.target.value) || 0 });

  const resetForm = () => {
    setName('');
    setRole('Mediocampo');
    setCurrentAvatar(null);
    setSkills({ pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });
    setEditingPlayerId(null);
  };

  const savePlayer = (e) => {
    e.preventDefault();
    if (!name) return;
    
    if (editingPlayerId) {
      setRoster(roster.map(p => p.id === editingPlayerId ? { ...p, name, role, avatar: currentAvatar, stats: {...skills} } : p));
    } else {
      setRoster([...roster, { id: Date.now().toString(), name, role, avatar: currentAvatar, stats: {...skills}, history: { pj: 0, pg: 0, goals: 0 }, glicko: { rating: 1500, rd: 350, vol: 0.06 }, financial: { debt: 0, isBanned: false }, condition: { stamina: 100 } }]);
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
    setRoster(roster.map(p => p.id === id ? { ...p, condition: { stamina: 100 } } : p));
  };

  const calcRawOvr = (stats) => Math.round((stats.pac + stats.sho + stats.pas + stats.dri + stats.def + stats.phy) / 6);
  const calcOvr = (p) => {
    const raw = calcRawOvr(p.stats);
    const stam = p.condition?.stamina ?? 100;
    // Opción B: Penalización global multiplicativa. (100% de stamina = 100% OVR, 0% stamina = 50% OVR)
    return Math.round(raw * (0.5 + (0.5 * (stam / 100))));
  };
  const calcHybridScore = (p) => (calcOvr(p) + ((p.glicko?.rating || 1500) / 20)) / 2;

  const balanceTeamsLocally = (useLobby = false) => {
    setIsLoading(true);
    setTimeout(() => {
      let pool = [];
      if (useLobby) {
        // Limpiar duplicados
        const uniqueMap = {};
        eventRegistrations.forEach(r => { uniqueMap[r.name.toLowerCase().trim()] = r; });
        const finalRegs = Object.values(uniqueMap).slice(0, activeEvent?.format || 100);

        pool = finalRegs.map(reg => {
          const existingPlayer = roster.find(p => p.name.toLowerCase().trim() === reg.name.toLowerCase().trim());
          return {
            id: existingPlayer ? existingPlayer.id : reg.id,
            name: reg.name,
            role: reg.role,
            avatar: reg.avatar || (existingPlayer ? existingPlayer.avatar : '👤'),
            stats: reg.stats, 
            history: existingPlayer ? existingPlayer.history : { pj: 0, pg: 0, goals: 0 },
            glicko: existingPlayer ? existingPlayer.glicko : { rating: 1500, rd: 350, vol: 0.06 },
            financial: existingPlayer ? existingPlayer.financial : { debt: 0, isBanned: false },
            condition: existingPlayer ? existingPlayer.condition : { stamina: 100 }
          };
        });
      } else {
        pool = roster;
      }
      
      const mapRole = (r) => {
         if (r === 'Ancla') return 'Defensor';
         if (r === 'Creativo') return 'Mediocampo';
         if (r === 'Finalizador') return 'Delantero';
         if (r === 'Capitán') return 'Mediocampo';
         return r;
      };
      
      const tA = []; const tB = [];
      let sumA = 0; let sumB = 0;
      const roles = ['Arquero', 'Defensor', 'Mediocampo', 'Delantero'];
      
      roles.forEach(r => {
        const activePool = pool.filter(p => !p.financial?.isBanned);
        const playersOfRole = activePool.filter(p => mapRole(p.role) === r).sort((a, b) => calcHybridScore(b) - calcHybridScore(a));
        playersOfRole.forEach(p => {
          if (sumA <= sumB) { tA.push(p); sumA += calcHybridScore(p); } 
          else { tB.push(p); sumB += calcHybridScore(p); }
        });
      });

      setTeamA(tA);
      setTeamB(tB);
      setIsLoading(false);
      setIsDrafting(true);
      setRevealedCount(0);
    }, 600);
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
  };

  const addGoal = (teamId, playerId) => {
    setMatchScore(prev => ({ ...prev, [teamId]: prev[teamId] + 1 }));
    setPlayerGoals(prev => ({ ...prev, [playerId]: (prev[playerId] || 0) + 1 }));
  };

  const removeGoal = (teamId, playerId) => {
    if ((playerGoals[playerId] || 0) > 0) {
      setMatchScore(prev => ({ ...prev, [teamId]: Math.max(0, prev[teamId] - 1) }));
      setPlayerGoals(prev => ({ ...prev, [playerId]: prev[playerId] - 1 }));
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
    
    [...teamA, ...teamB].forEach(matchPlayer => {
       const existingIndex = updatedRoster.findIndex(p => p.id === matchPlayer.id || p.name.toLowerCase() === matchPlayer.name.toLowerCase());
       
       const inA = teamA.some(a => a.id === matchPlayer.id);
       const inB = teamB.some(b => b.id === matchPlayer.id);
       const winnerMatches = (inA && winner === 'A') || (inB && winner === 'B');
       
       let debt = currentQuota > 0 && !paymentsMap[matchPlayer.id] ? currentQuota : 0;
       const staminaLoss = Math.floor(Math.random() * 16 + 15);
       
       const newRating = newGlickoMap[matchPlayer.id]?.rating || (existingIndex >= 0 ? updatedRoster[existingIndex].glicko?.rating : 1500) || 1500;
       
       if (existingIndex >= 0) {
          const ep = updatedRoster[existingIndex];
          const prevHistory = ep.glicko?.history || [1500];
          updatedRoster[existingIndex] = {
             ...ep,
             history: { 
                 pj: (ep.history?.pj || 0) + 1, 
                 pg: (ep.history?.pg || 0) + (winnerMatches ? 1 : 0), 
                 goals: (ep.history?.goals || 0) + (playerGoals[matchPlayer.id] || 0) 
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
             history: { pj: 1, pg: winnerMatches ? 1 : 0, goals: playerGoals[matchPlayer.id] || 0 },
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

  if (viewMode === 'history') {
    return (
      <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.5s' }}>
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
      </div>
    );
  }

  if (viewMode === 'stats') {
    const sortedRoster = [...roster].sort((a, b) => {
      return (b.glicko?.rating || 1500) - (a.glicko?.rating || 1500);
    });

    return (
      <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.5s' }}>
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
            <button onClick={() => { if(window.confirm('¿Borrar historial global?')) { setRoster(roster.map(p => ({...p, history:{pj:0,pg:0,goals:0}}))); } }} style={{...btnSec, borderColor: 'var(--crimson-red)', color: 'var(--crimson-red)'}}>RESETEAR TEMPORADA</button>
          </div>
        </header>

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
                <th style={{ padding: '1.5rem 1rem', color: 'var(--ultimate-gold)', textAlign: 'center' }}>GOLES</th>
                <th style={{ padding: '1.5rem 1rem', color: 'var(--electric-cyan)', textAlign: 'center' }}>WIN %</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map((p, i) => {
                const pj = p.history?.pj || 0;
                const pg = p.history?.pg || 0;
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
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--ultimate-gold)', fontWeight: 'bold' }}>{p.history?.goals || 0}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--electric-cyan)' }}>{winRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (viewMode === 'match') {
    return (
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.5s' }}>
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

        <div className="responsive-flex" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          
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
          <button onClick={() => { if(window.confirm('¿Cancelar partido? No se guardarán los stats.')) setViewMode('builder'); }} style={{ ...btnSec, borderColor: 'var(--off-white)', color: 'var(--off-white)', fontSize: '1.2rem', padding: '1rem 3rem' }}>CANCELAR</button>
          <button onClick={finishMatch} className="btn-primary" style={{ width: 'auto', fontSize: '1.5rem', padding: '1rem 4rem' }}>FINALIZAR PARTIDO</button>
        </div>
      </div>
    );
  }

  // DEFAULT BUILDER MODE
  
  // Limpiar duplicados por nombre
  const uniqueRegistrationsMap = {};
  eventRegistrations.forEach(r => { uniqueRegistrationsMap[r.name.toLowerCase().trim()] = r; });
  const uniqueRegistrations = Object.values(uniqueRegistrationsMap).slice(0, activeEvent?.format || 100);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <div className="responsive-header-actions" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
          <div className="responsive-flex-wrap" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => setViewMode('stats')} style={btnSec}>🏆 LEADERBOARD</button>
            <button onClick={() => setViewMode('history')} style={btnSec}>📚 HISTÓRICO</button>
            <button onClick={copyLeagueLink} style={{ ...btnSec, borderColor: '#00F0FF', color: '#00F0FF', boxShadow: '0 0 10px rgba(0,240,255,0.3)' }}>🔗 COMPARTIR LIGA</button>
          </div>
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--crimson-red)', color: 'var(--crimson-red)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>CERRAR SESIÓN</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="FULBO Logo" style={{ width: '90px', height: '90px', objectFit: 'contain', filter: 'drop-shadow(0 0 15px rgba(204,255,0,0.5))' }} />
            <h1 className="glow-text-volt" style={{ fontSize: '4rem', margin: 0, fontStyle: 'italic', fontWeight: '900', letterSpacing: '2px' }}>FULBO</h1>
          </div>
          <span style={{ color: 'var(--electric-cyan)', fontSize: '0.9rem', letterSpacing: '5px', textTransform: 'uppercase', fontWeight: 'bold', marginTop: '0.5rem' }}>THE ELITE MATCHMAKING ENGINE</span>
          <p style={{ color: 'var(--off-white)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '0.5rem', fontWeight: '500', fontSize: '0.8rem' }}>
            Powered by Glicko-2 & AI
          </p>
        </div>
      </header>
      
      {/* EVENT LOBBY UI */}
      <div className="glass-panel" style={{ marginBottom: '2rem', border: '1px solid var(--volt-lime)', background: 'rgba(204,255,0,0.05)' }}>
         <div className="responsive-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeEvent ? '1rem' : '0' }}>
            <h3 style={{ color: 'var(--volt-lime)', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>⚡ MATCH DAY LOBBY</h3>
            {!activeEvent ? (
               <div className="responsive-flex" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} />
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={inputStyle} />
                  <select value={eventFormat} onChange={e => setEventFormat(parseInt(e.target.value))} style={inputStyle}>
                     <option value={10}>Fulbo 5 (10 Jug)</option>
                     <option value={14}>Fulbo 7 (14 Jug)</option>
                     <option value={18}>Fulbo 9 (18 Jug)</option>
                     <option value={22}>Fulbo 11 (22 Jug)</option>
                  </select>
                  <button onClick={() => setActiveEvent({ date: eventDate, time: eventTime, format: eventFormat })} className="btn-primary" style={{ padding: '0.5rem 1.5rem', whiteSpace: 'nowrap', width: 'auto', flexShrink: 0, fontSize: '1rem' }}>CREAR EVENTO</button>
               </div>
            ) : (
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--off-white)' }}>{activeEvent.date} {activeEvent.time} | Formato {activeEvent.format} jug.</span>
                  <button onClick={() => { setActiveEvent(null); setEventRegistrations([]); if(isSupabaseConfigured && supabase) supabase.from('event_registrations').delete().eq('host_id', hostId).then(); }} style={{ ...btnSec, borderColor: 'var(--crimson-red)', color: 'var(--crimson-red)' }}>CANCELAR EVENTO</button>
               </div>
            )}
         </div>

         {activeEvent && (
            <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px' }}>
                  <div>
                     <div style={{ fontSize: '0.9rem', color: 'var(--off-white)' }}>Inscritos actualmente en el Lobby Público:</div>
                     <div className="glow-text-volt" style={{ fontSize: '2rem', fontWeight: 'bold', color: uniqueRegistrations.length >= activeEvent.format ? 'var(--crimson-red)' : 'var(--volt-lime)' }}>{uniqueRegistrations.length} / {activeEvent.format}</div>
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
                     <button onClick={() => balanceTeamsLocally(true)} className="btn-primary" disabled={isLoading || uniqueRegistrations.length < 2} style={{ padding: '0.5rem 2rem' }}>ADMITIR Y ARMAR EQUIPOS</button>
                  </div>
               </div>
               <p style={{ color: 'var(--electric-cyan)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'right' }}>*Cupos disponibles: {Math.max(0, activeEvent.format - uniqueRegistrations.length)}</p>
            </div>
         )}
      </div>

      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem', opacity: activeEvent ? 0.3 : 1, pointerEvents: activeEvent ? 'none' : 'auto' }}>
        <aside className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.2rem' }}>
          <div>
            <h3 style={{ color: 'var(--electric-cyan)', marginBottom: '1rem', fontSize: '1.1rem' }}>{editingPlayerId ? 'Editar Jugador' : 'Agregar Jugador'}</h3>
            <form onSubmit={savePlayer} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <input style={inputStyle} type="text" placeholder="Nombre (Ej: Messi)" value={name} onChange={(e) => setName(e.target.value)} required />
              <AvatarSelector onSelectAvatar={setCurrentAvatar} currentAvatar={currentAvatar} />
              <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="Arquero">Arquero</option>
                <option value="Defensor">Defensor</option>
                <option value="Mediocampo">Mediocampo</option>
                <option value="Delantero">Delantero</option>
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Pace: Ritmo / Velocidad pura"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>PAC</span><input type="number" name="pac" value={skills.pac} onChange={handleSkillChange} style={inputStyle} min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Shooting: Capacidad de tiro y definición"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>SHO</span><input type="number" name="sho" value={skills.sho} onChange={handleSkillChange} style={inputStyle} min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Passing: Precisión de pase y visión"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>PAS</span><input type="number" name="pas" value={skills.pas} onChange={handleSkillChange} style={inputStyle} min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Dribbling: Regate, agilidad y control"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>DRI</span><input type="number" name="dri" value={skills.dri} onChange={handleSkillChange} style={inputStyle} min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Defending: Marcaje e intercepciones"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>DEF</span><input type="number" name="def" value={skills.def} onChange={handleSkillChange} style={inputStyle} min="1" max="99" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="Physical: Fuerza y resistencia física"><span style={{width:'30px', fontSize:'0.8rem', color:'var(--off-white)', cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.3)'}}>PHY</span><input type="number" name="phy" value={skills.phy} onChange={handleSkillChange} style={inputStyle} min="1" max="99" /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.8rem', fontSize: '1rem' }}>{editingPlayerId ? 'Actualizar' : 'Sumar a Plantilla'}</button>
                {editingPlayerId && <button type="button" onClick={resetForm} style={{ ...btnSec, borderColor: 'var(--off-white)', color: 'var(--off-white)' }}>Cancelar</button>}
              </div>
            </form>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <h3 style={{ color: 'var(--pure-white)' }}>Convocados</h3>
              <span className="glow-text-volt" style={{ fontWeight: 'bold' }}>{roster.length} JUG</span>
            </div>
            
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
              {roster.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', marginTop: '2rem' }}>Plantilla vacía</p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {roster.map(p => (
                    <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                      <div onClick={() => setSelectedPlayerDetails(p)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                        {p.avatar && (
                          <div style={{ width: '25px', height: '25px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {p.avatar.startsWith('data:image') ? <img src={p.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span style={{fontSize:'0.8rem'}}>{p.avatar}</span>}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', textDecoration: p.financial?.isBanned ? 'line-through' : 'none', color: p.financial?.isBanned ? 'var(--crimson-red)' : 'white' }}>
                            {p.name} {p.financial?.isBanned && '🟥'}
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
                        <button onClick={() => healPlayer(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: (p.condition?.stamina ?? 100) < 100 ? 1 : 0.2 }} title="Curar / Descansar">🏥</button>
                        <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', color: 'var(--electric-cyan)', cursor: 'pointer', fontSize: '1rem', opacity: 0.8 }} title="Editar jugador">✏️</button>
                        <button onClick={() => removePlayer(p.id)} style={{ background: 'none', border: 'none', color: 'var(--crimson-red)', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} title="Eliminar jugador">&times;</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <button onClick={() => balanceTeamsLocally(false)} className="btn-primary" disabled={isLoading || roster.length < 2}>
            {isLoading ? 'CALCULANDO IA...' : 'ARMAR EQUIPOS POR ROL'}
          </button>
        </aside>

        <main className="glass-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {(teamA.length === 0 && teamB.length === 0) ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ width: '120px', height: '120px', border: '2px dashed rgba(204,255,0,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '3rem', filter: 'grayscale(1)', opacity: 0.3 }}>⚽</span>
              </div>
              <p style={{ color: 'var(--off-white)', fontSize: '1.2rem', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }}>
                Agrega jugadores y presiona <strong className="glow-text-volt">Armar Equipos</strong>.
              </p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative' }}>
                <h2 style={{ color: isDrafting ? 'var(--crimson-red)' : 'var(--pure-white)', letterSpacing: '5px', fontSize: '1.5rem', animation: isDrafting ? 'pulse 1s infinite' : 'none' }}>
                  {isDrafting ? '🔴 DRAFT EN PROGRESO...' : 'PREVIEW DEL PARTIDO'}
                </h2>
                <div style={{ width: '60px', height: '2px', background: isDrafting ? 'var(--crimson-red)' : 'var(--volt-lime)', margin: '0.5rem auto', boxShadow: isDrafting ? '0 0 10px var(--crimson-red)' : '0 0 10px var(--volt-lime)' }}></div>
              </div>
              
              <div className="responsive-flex" style={{ display: 'flex', flex: 1, position: 'relative' }}>
                <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '1rem', paddingBottom: '5rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h3 className="glow-text-volt" style={{ fontSize: '2rem' }}>EQUIPO A</h3>
                    <div style={{ background: 'rgba(204,255,0,0.05)', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid rgba(204,255,0,0.2)', marginTop: '0.5rem' }}>
                      <span style={{ color: 'var(--off-white)', fontSize: '0.8rem', marginRight: '10px' }}>OVR MEDIO: </span>
                      <strong className="glow-text-volt" style={{ fontSize: '1.2rem' }}>{isDrafting ? '???' : getTeamRating(teamA)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
                    {teamA.slice(0, Math.ceil(revealedCount / 2)).map(p => (
                      <div key={p.id} onClick={() => setSelectedPlayerDetails(p)} style={{ animation: 'fadeIn 0.4s ease-out', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                        <PlayerCard name={p.name} position={p.role.substring(0,3).toUpperCase()} stats={p.stats} avatar={p.avatar} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: '70px', height: '70px', background: 'var(--pitch-black)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 0 30px rgba(0,0,0,1)' }}>
                  <span style={{ fontFamily: 'var(--font-primary)', fontWeight: '900', fontSize: '1.5rem', color: 'var(--pure-white)', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>VS</span>
                </div>

                <div style={{ flex: 1, paddingLeft: '1rem', paddingBottom: '5rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h3 className="glow-text-cyan" style={{ fontSize: '2rem' }}>EQUIPO B</h3>
                    <div style={{ background: 'rgba(0,240,255,0.05)', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid rgba(0,240,255,0.2)', marginTop: '0.5rem' }}>
                      <span style={{ color: 'var(--off-white)', fontSize: '0.8rem', marginRight: '10px' }}>OVR MEDIO: </span>
                      <strong className="glow-text-cyan" style={{ fontSize: '1.2rem' }}>{isDrafting ? '???' : getTeamRating(teamB)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
                    {teamB.slice(0, Math.floor(revealedCount / 2)).map(p => (
                      <div key={p.id} onClick={() => setSelectedPlayerDetails(p)} style={{ animation: 'fadeIn 0.4s ease-out', cursor: 'pointer' }} title="Ver Ficha y Gráfico Elo">
                        <PlayerCard name={p.name} position={p.role.substring(0,3).toUpperCase()} stats={p.stats} avatar={p.avatar} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* LA VAQUITA PANEL */}
              {!isDrafting && (
              <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', marginTop: '2rem', marginBottom: '8rem', zIndex: 10, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: 'var(--ultimate-gold)', margin: 0 }}>💰 LA VAQUITA</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--off-white)', fontSize: '0.9rem' }}>Costo Cancha ($):</span>
                    <input type="number" value={pitchCost} onChange={(e) => setPitchCost(e.target.value)} style={{ ...inputStyle, width: '100px', padding: '0.3rem' }} placeholder="0" />
                  </div>
                </div>
                
                {pitchCost > 0 && (
                  <div className="responsive-flex" style={{ display: 'flex', gap: '2rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 1rem 0', color: 'var(--electric-cyan)', fontWeight: 'bold' }}>
                        Cuota: ${(pitchCost / (teamA.length + teamB.length)).toFixed(2)} por jugador
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {[...teamA, ...teamB].map(p => (
                          <div key={p.id} onClick={() => setPaymentsMap(prev => ({ ...prev, [p.id]: !prev[p.id] }))} style={{ cursor: 'pointer', background: paymentsMap[p.id] ? 'rgba(37,211,102,0.2)' : 'rgba(255,0,0,0.2)', border: paymentsMap[p.id] ? '1px solid #25D366' : '1px solid var(--crimson-red)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {paymentsMap[p.id] ? '✅' : '❌'} {p.name}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`💸 *LA VAQUITA - FULBO*\nLa cancha cuesta $${pitchCost}. Nos toca $${(pitchCost / (teamA.length + teamB.length)).toFixed(2)} a cada uno.\n\n👉 *PAGAR AQUI:* https://link.mercadopago.com.ar/vaquita`)}`, '_blank')} className="btn-primary" style={{ background: '#009EE3', borderColor: '#009EE3', fontSize: '0.9rem', padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontWeight: 'bold' }}>
                         🤝 Cobrar por MercadoPago
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* ACTION: START MATCH & SHARE */}
              {!isDrafting && (
              <div className="responsive-flex" style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', width: '100%', display: 'flex', justifyContent: 'center', gap: '1rem', zIndex: 20 }}>
                <button onClick={shareTeamsWA} className="btn-primary" style={{ background: '#25D366', color: 'white', borderColor: '#25D366', boxShadow: '0 0 10px rgba(37,211,102,0.3)', flex: 1, maxWidth: '250px' }}>WHATSAPP 📱</button>
                <button onClick={startMatch} className="btn-primary" style={{ background: 'var(--pitch-black)', color: 'var(--ultimate-gold)', borderColor: 'var(--ultimate-gold)', boxShadow: '0 0 20px rgba(255,215,0,0.2)', flex: 1, maxWidth: '250px' }}>INICIAR PARTIDO ⚡</button>
                <button onClick={() => { setTeamA([]); setTeamB([]); setPitchCost(''); setPaymentsMap({}); setIsDrafting(false); }} style={{ ...btnSec, borderColor: 'var(--crimson-red)', color: 'var(--crimson-red)', flex: 1, maxWidth: '200px' }}>CANCELAR</button>
              </div>
              )}
            </>
          )}
          {/* Player Details Modal (MMR Graph & Card) */}
          {selectedPlayerDetails && (
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
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
