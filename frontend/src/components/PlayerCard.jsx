import React from 'react';

const PlayerCard = ({ name = "JUGADOR", position = "MC", stats = { pac: 80, sho: 75, pas: 80, dri: 85, def: 60, phy: 70 }, avatar, ovr, stamina = 100 }) => {
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
