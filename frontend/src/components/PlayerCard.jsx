import React from 'react';

const BADGE_ICONS = {
  mvp: { icon: '👑', label: 'MVP', color: 'var(--ultimate-gold)', glow: 'rgba(255,215,0,0.5)', desc: 'MVP del último partido' },
  goleador: { icon: '🎯', label: 'Goleador', color: 'var(--volt-lime)', glow: 'rgba(204,255,0,0.5)', desc: 'Goleador Histórico (5+ goles)' },
  guardian: { icon: '🛡️', label: 'Guardián', color: 'var(--electric-cyan)', glow: 'rgba(0,240,255,0.5)', desc: 'Muralla Defensiva (3+ victorias)' },
  ironman: { icon: '⚡', label: 'Ironman', color: 'var(--volt-lime)', glow: 'rgba(204,255,0,0.5)', desc: 'Físico Imparable (Stamina > 60%)' },
  fairplay: { icon: '🪙', label: 'Fair Play', color: 'var(--ultimate-gold)', glow: 'rgba(255,215,0,0.5)', desc: 'Finanzas Impecables (Sin deudas)' }
};

const PlayerCard = ({ name = "JUGADOR", position = "MC", stats = { pac: 80, sho: 75, pas: 80, dri: 85, def: 60, phy: 70 }, avatar, ovr, stamina = 100, badges = [], isInjured = false }) => {
  const displayOvr = ovr !== undefined ? ovr : Math.round((stats.pac + stats.sho + stats.pas + stats.dri + stats.def + stats.phy) / 6);

  return (
    <div style={{
      position: 'relative',
      width: '140px',
      height: '210px',
      background: 'linear-gradient(135deg, rgba(30,30,35,0.95), rgba(10,10,15,0.95))',
      border: '1px solid rgba(255,215,0,0.5)',
      clipPath: 'polygon(10% 0, 90% 0, 100% 12%, 100% 88%, 90% 100%, 10% 100%, 0 88%, 0 12%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '10px',
      boxShadow: 'inset 0 0 25px rgba(255,215,0,0.15)',
      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      cursor: 'pointer',
      userSelect: 'none'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'scale(1.08) translateY(-5px)';
      e.currentTarget.style.boxShadow = 'inset 0 0 30px rgba(255,215,0,0.3)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'scale(1) translateY(0)';
      e.currentTarget.style.boxShadow = 'inset 0 0 25px rgba(255,215,0,0.15)';
    }}
    >
      {isInjured && (
        <div style={{
          position: 'absolute',
          right: '8px',
          top: '30px',
          background: 'rgba(255, 0, 85, 0.95)',
          border: '1px solid var(--crimson-red)',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          boxShadow: '0 0 8px rgba(255, 0, 85, 0.8)',
          zIndex: 6
        }} title="LESIONADO / EN HOSPITAL">
          🤕
        </div>
      )}

      {/* PlayStyles / Badges column */}
      {Array.isArray(badges) && badges.length > 0 && (
        <div style={{
          position: 'absolute',
          left: '8px',
          top: '55px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          zIndex: 5
        }}>
          {badges.map(b => {
            const badge = BADGE_ICONS[b];
            if (!badge) return null;
            return (
              <div key={b} title={`${badge.label}: ${badge.desc}`} style={{
                width: '16px',
                height: '16px',
                background: 'rgba(5,5,7,0.85)',
                border: `1px solid ${badge.color}`,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                filter: `drop-shadow(0 0 4px ${badge.glow})`,
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {badge.icon}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--pure-white)', fontFamily: 'var(--font-primary)', lineHeight: '1' }}>{displayOvr}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--ultimate-gold)', fontWeight: 'bold' }}>{position}</span>
        </div>
        {stamina < 100 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
            <span style={{ fontSize: '0.6rem', color: stamina > 60 ? '#25D366' : (stamina > 30 ? '#FFA500' : '#FF3B30'), fontWeight: 'bold' }}>🔋 {stamina}%</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '-5px' }}>
        <div style={{ width: '55px', height: '55px', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {avatar ? (
            avatar.startsWith('data:image') ? (
              <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '2rem' }}>{avatar}</span>
            )
          ) : (
            <span style={{ fontSize: '1.8rem', opacity: 0.8 }}>👤</span>
          )}
        </div>
      </div>

      <div style={{ width: '100%', textAlign: 'center', margin: '4px 0', borderTop: '1px solid rgba(255,215,0,0.2)', paddingTop: '4px' }}>
        <span style={{ fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--pure-white)', letterSpacing: '1px' }}>{name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', width: '100%', padding: '0 5px' }}>
        {[
          ['PAC', stats.pac, 'Pace: Ritmo / Velocidad pura'], 
          ['SHO', stats.sho, 'Shooting: Capacidad de tiro y definición'], 
          ['PAS', stats.pas, 'Passing: Precisión de pase y visión'], 
          ['DRI', stats.dri, 'Dribbling: Regate, agilidad y control'], 
          ['DEF', stats.def, 'Defending: Marcaje e intercepciones'], 
          ['PHY', stats.phy, 'Physical: Fuerza y resistencia física']
        ].map(([label, val, desc]) => (
          <div key={label} title={desc} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', cursor: 'help' }}>
            <span style={{ color: 'var(--pure-white)', fontWeight: 'bold' }}>{val}</span>
            <span style={{ color: 'var(--off-white)', borderBottom: '1px dotted rgba(255,255,255,0.3)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerCard;
