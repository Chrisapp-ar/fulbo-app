import fs from 'fs';
const file = 'src/views/CompanionApp.jsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Update INSCRIBIRSE AHORA button to bypass form if guestName exists
c = c.replace(
  "onClick={() => setIsRegistering(true)}",
  "onClick={(e) => { if (localStorage.getItem('guestName')) { handleRegSubmit(e); } else { setIsRegistering(true); } }}"
);

// 2. Update myPlayerCard fallback to return local storage data even if not in eventRegistrations
const oldMyPlayerCard = `      || (() => {
        const gName = localStorage.getItem('guestName');
        const reg = eventRegistrations.find(r => r && (r.player_id === currentUser?.id || (r.name?.toLowerCase().trim() === (gName || '').toLowerCase().trim())));
        if (reg) {
          return {
            ...reg,
            glicko: { rating: 1500, rd: 350, vol: 0.06 },
            history: { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 },
            condition: { stamina: 100 }
          };
        }
        return null;
      })();`;

const newMyPlayerCard = `      || (() => {
        const gName = localStorage.getItem('guestName');
        const reg = eventRegistrations.find(r => r && (r.player_id === currentUser?.id || (r.name?.toLowerCase().trim() === (gName || '').toLowerCase().trim())));
        if (reg) {
          return {
            ...reg,
            glicko: { rating: 1500, rd: 350, vol: 0.06 },
            history: { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 },
            condition: { stamina: 100 }
          };
        }
        if (gName) {
          let gStats = { pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75 };
          try { gStats = JSON.parse(localStorage.getItem('guestStats')) || gStats; } catch(e) {}
          return {
            id: 'local_guest',
            name: gName,
            role: localStorage.getItem('guestRole') || 'Mediocampo',
            stats: gStats,
            avatar: localStorage.getItem('guestAvatar') || '👤',
            glicko: { rating: 1500, rd: 350, vol: 0.06 },
            history: { pj: 0, pg: 0, pe: 0, pp: 0, goals: 0 },
            condition: { stamina: 100 }
          };
        }
        return null;
      })();`;

c = c.replace(oldMyPlayerCard, newMyPlayerCard);

fs.writeFileSync(file, c);
console.log("Done");
