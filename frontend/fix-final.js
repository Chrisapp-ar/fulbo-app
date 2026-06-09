import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

// 1. Inject myMatches and connectedPlayers
const mainReturnRegex = /return \(\s*<div className="page-container" style=\{\{\s*minHeight:\s*'100dvh',/;
const logicToAdd = `
  const myMatches = matchHistory.filter(match => {
    if (!regName) return false;
    const inA = match.teamA?.some(m => m.name && m.name.toLowerCase().trim() === regName.toLowerCase().trim());
    const inB = match.teamB?.some(m => m.name && m.name.toLowerCase().trim() === regName.toLowerCase().trim());
    return inA || inB;
  });

  const connectedPlayers = new Set();
  if (regName) {
    connectedPlayers.add(regName.toLowerCase().trim());
    myMatches.forEach(match => {
      (match.teamA || []).forEach(m => { if (m.name) connectedPlayers.add(m.name.toLowerCase().trim()); });
      (match.teamB || []).forEach(m => { if (m.name) connectedPlayers.add(m.name.toLowerCase().trim()); });
    });
  }

  return (
    <div className="page-container" style={{ minHeight: '100dvh',`;

if (mainReturnRegex.test(content)) {
  content = content.replace(mainReturnRegex, logicToAdd);
  console.log("1. Injected myMatches logic");
} else {
  console.log("1. FAILED to inject myMatches logic");
}

// 2. Map myMatches instead of matchHistory
content = content.replace(/\{matchHistory\.length === 0 \?/g, "{myMatches.length === 0 ?");
content = content.replace(/matchHistory\.map\(\(match, idx\) => \{/g, "myMatches.map((match, idx) => {");
content = content.replace(/Partido #\{matchHistory\.length - idx\}/g, "Partido #{myMatches.length - idx}");
console.log("2. Replaced matchHistory mappings");

// 3. Filter ranking by connectedPlayers
const filterRegex = /if \(\(p\.history\?\.pj \|\| 0\) === 0\) return false;/;
const newFilter = `if ((p.history?.pj || 0) === 0) return false;\n                    if (regName && !connectedPlayers.has(p.name.toLowerCase().trim())) return false;`;
if (filterRegex.test(content)) {
  content = content.replace(filterRegex, newFilter);
  console.log("3. Injected connectedPlayers filter");
} else {
  console.log("3. FAILED to inject connectedPlayers filter");
}

// 4. Navigation bar DreamTeam
const navRegex = /<button onClick=\{\(\) => setActiveTab\('profile'\)\} style=\{\{ background: 'transparent', color: activeTab === 'profile'/;
const navReplacement = `<button onClick={() => setActiveTab('dreamteam')} style={{ background: 'transparent', color: activeTab === 'dreamteam' ? 'var(--ultimate-gold)' : 'var(--off-white)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', minWidth: '45px' }}>
          <span style={{ fontSize: '1.2rem' }}>⭐</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>DreamTeam</span>
        </button>
        <button onClick={() => setActiveTab('profile')} style={{ background: 'transparent', color: activeTab === 'profile'`;
if (navRegex.test(content)) {
  content = content.replace(navRegex, navReplacement);
  console.log("4. Injected DreamTeam nav button");
} else {
  console.log("4. FAILED to inject DreamTeam nav button");
}

// 5. DreamTeam Tab content
const historyTabEndRegex = /\{activeTab === 'profile' && \(/;
const dreamTeamContent = `{activeTab === 'dreamteam' && (() => {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const activeThisMonth = roster.filter(p => {
            if (!p.lastMatchDate) return false;
            const d = new Date(p.lastMatchDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          });
          const playersToRank = activeThisMonth.length >= 5 ? activeThisMonth : roster;
          const topPlayers = [...playersToRank].sort((a,b) => calcHybridScore(b) - calcHybridScore(a)).slice(0, 5);
      
          return (
            <div style={{ position: 'relative', height: '600px', background: 'radial-gradient(circle, rgba(204,255,0,0.1) 0%, rgba(0,0,0,0.8) 70%)', border: '2px solid var(--volt-lime)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', boxShadow: '0 0 50px rgba(204,255,0,0.2)', marginBottom: '4rem', marginTop: '1rem' }}>
              <div style={{ position: 'absolute', top: '5%', transform: 'scale(1.2)', zIndex: 5, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.6))' }}>
                {topPlayers[0] && <PlayerCard name={topPlayers[0].name} position={topPlayers[0].role.substring(0,3).toUpperCase()} stats={topPlayers[0].stats} avatar={topPlayers[0].avatar} ovr={calcOvr(topPlayers[0])} badges={getPlayerBadges(topPlayers[0])} />}
              </div>
              <div style={{ position: 'absolute', top: '35%', left: '5%', zIndex: 4, transform: 'scale(0.9)' }}>
                {topPlayers[1] && <PlayerCard name={topPlayers[1].name} position={topPlayers[1].role.substring(0,3).toUpperCase()} stats={topPlayers[1].stats} avatar={topPlayers[1].avatar} ovr={calcOvr(topPlayers[1])} badges={getPlayerBadges(topPlayers[1])} />}
              </div>
              <div style={{ position: 'absolute', top: '35%', right: '5%', zIndex: 4, transform: 'scale(0.9)' }}>
                {topPlayers[2] && <PlayerCard name={topPlayers[2].name} position={topPlayers[2].role.substring(0,3).toUpperCase()} stats={topPlayers[2].stats} avatar={topPlayers[2].avatar} ovr={calcOvr(topPlayers[2])} badges={getPlayerBadges(topPlayers[2])} />}
              </div>
              <div style={{ position: 'absolute', bottom: '5%', left: '15%', zIndex: 3, transform: 'scale(0.85)' }}>
                {topPlayers[3] && <PlayerCard name={topPlayers[3].name} position={topPlayers[3].role.substring(0,3).toUpperCase()} stats={topPlayers[3].stats} avatar={topPlayers[3].avatar} ovr={calcOvr(topPlayers[3])} badges={getPlayerBadges(topPlayers[3])} />}
              </div>
              <div style={{ position: 'absolute', bottom: '5%', right: '15%', zIndex: 3, transform: 'scale(0.85)' }}>
                {topPlayers[4] && <PlayerCard name={topPlayers[4].name} position={topPlayers[4].role.substring(0,3).toUpperCase()} stats={topPlayers[4].stats} avatar={topPlayers[4].avatar} ovr={calcOvr(topPlayers[4])} badges={getPlayerBadges(topPlayers[4])} />}
              </div>
            </div>
          );
      })()}

      {activeTab === 'profile' && (`;

if (historyTabEndRegex.test(content)) {
  content = content.replace(historyTabEndRegex, dreamTeamContent);
  console.log("5. Injected DreamTeam UI content");
} else {
  console.log("5. FAILED to inject DreamTeam UI content");
}

fs.writeFileSync('src/views/CompanionApp.jsx', content);
