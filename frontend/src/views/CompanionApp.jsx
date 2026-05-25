import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import PlayerCard from '../components/PlayerCard';
import EloChart from '../components/EloChart';

const CompanionApp = ({ leagueId }) => {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  const [activeEvent, setActiveEvent] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('Mediocampo');
  const [regStats, setRegStats] = useState({ pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 });
  const [regSuccess, setRegSuccess] = useState(false);
  
  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim()) return;
    
    if (isSupabaseConfigured && supabase) {
      await supabase.from('event_registrations').insert({
        host_id: leagueId,
        name: regName,
        role: regRole,
        stats: regStats
      });
      setRegSuccess(true);
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const fetchLeague = async () => {
        const { data, error } = await supabase.from('league_state').select('*').eq('host_id', leagueId).single();
        if (data) {
          if (data.roster) {
            const sorted = [...data.roster].sort((a, b) => (b.glicko?.rating || 1500) - (a.glicko?.rating || 1500));
            setRoster(sorted);
          }
          if (data.active_event) setActiveEvent(data.active_event);
        }
        setLoading(false);
      };
      fetchLeague();
    } else {
      setLoading(false);
    }
  }, [leagueId]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--volt-lime)', fontSize: '1.5rem', background: 'var(--pitch-black)' }}>Cargando Liga...</div>;
  }

  if (roster.length === 0) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'var(--pitch-black)', padding: '2rem', textAlign: 'center' }}>No se pudo cargar la liga. Verifica que el enlace sea correcto.</div>;
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
            />
          </div>

          <div style={{ width: '100%' }}>
            <EloChart history={selectedPlayer.glicko?.history || [1500, selectedPlayer.glicko?.rating || 1500]} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--off-white)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Partidos</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '900', marginTop: '0.2rem', color: 'white' }}>{selectedPlayer.history?.pj || 0}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--off-white)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Rango Competitivo</div>
              <div className="glow-text-volt" style={{ fontSize: '1.2rem', fontWeight: '900', marginTop: '0.2rem' }}>{Math.round(selectedPlayer.glicko?.rating || 1500)} MMR</div>
            </div>
          </div>

          <p style={{ color: 'var(--off-white)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>Comparte tu Ficha Táctica 📸</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pitch-black)', padding: '2rem 1rem', fontFamily: 'var(--font-secondary)' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <img src="/logo.png" alt="FULBO Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(204,255,0,0.8))' }} />
            <h1 className="glow-text-volt" style={{ fontSize: '2.5rem', margin: 0, fontStyle: 'italic', fontWeight: '900', letterSpacing: '1px' }}>FULBO</h1>
          </div>
          <span style={{ color: 'var(--electric-cyan)', fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 'bold' }}>THE ELITE MATCHMAKING ENGINE</span>
        </div>
        <h2 style={{ color: 'var(--ultimate-gold)', fontSize: '1.2rem', margin: 0, letterSpacing: '2px', marginTop: '1rem' }}>LEADERBOARD</h2>
        <p style={{ color: 'var(--off-white)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Toca tu nombre para ver tu Player Card</p>
      </header>

      {activeEvent && !isRegistering && !regSuccess && (
        <div style={{ background: 'var(--volt-lime)', color: 'black', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center', boxShadow: '0 0 20px rgba(204,255,0,0.4)', animation: 'pulse 2s infinite' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '900', fontSize: '1.5rem', fontStyle: 'italic' }}>⚡ MATCH DAY ⚡</h3>
          <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{activeEvent.date} a las {activeEvent.time} | Formato: {activeEvent.format} Jugadores</p>
          <button onClick={() => setIsRegistering(true)} style={{ background: 'black', color: 'var(--volt-lime)', border: 'none', padding: '1rem 2rem', fontSize: '1.2rem', fontWeight: '900', borderRadius: '30px', cursor: 'pointer', width: '100%', fontFamily: 'var(--font-primary)' }}>INSCRIBIRSE AHORA</button>
        </div>
      )}

      {activeEvent && regSuccess && (
        <div style={{ background: 'rgba(37,211,102,0.1)', border: '2px solid #25D366', color: '#25D366', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>¡INSCRITO! ✅</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Tus stats temporales han sido enviadas. Espera a que el Organizador inicie el Draft En Vivo.</p>
        </div>
      )}

      {isRegistering && (
        <div style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid var(--electric-cyan)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '600px', margin: '0 auto' }}>
        {roster.map((p, i) => {
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
                  <div style={{ color: 'var(--off-white)', fontSize: '0.75rem' }}>{p.role} | {pj} Partidos</div>
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div className="glow-text-volt" style={{ fontSize: '1.3rem', fontWeight: '900' }}>{mmr}</div>
                <div style={{ color: 'var(--electric-cyan)', fontSize: '0.75rem', fontWeight: 'bold' }}>{winRate}% WR</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompanionApp;
