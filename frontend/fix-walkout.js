import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

// 1. Initialize state with localStorage
const stateRegex = /const \[teamsRevealed, setTeamsRevealed\] = useState\(false\);/;
const stateReplacement = `const [teamsRevealed, setTeamsRevealed] = useState(() => localStorage.getItem('has_seen_walkout_' + leagueId) === 'true');`;
content = content.replace(stateRegex, stateReplacement);

// 2. Clear localStorage when returning to lobby
const lobbyEffectRegex = /useEffect\(\(\) => \{\n\s*if \(activeEvent\?\.status === 'lobby'\) \{\n\s*setTeamsRevealed\(false\);\n\s*setIsRevealing\(false\);\n\s*\}\n\s*\}, \[activeEvent\?\.status\]\);/;
const lobbyEffectReplacement = `useEffect(() => {
    if (activeEvent?.status === 'lobby') {
      setTeamsRevealed(false);
      setIsRevealing(false);
      if (leagueId) {
        localStorage.removeItem('has_seen_walkout_' + leagueId);
      }
    } else if (activeEvent?.status === 'preview' && localStorage.getItem('has_seen_walkout_' + leagueId) === 'true') {
      setTeamsRevealed(true);
    }
  }, [activeEvent?.status, leagueId]);`;
content = content.replace(lobbyEffectRegex, lobbyEffectReplacement);

// 3. Save to localStorage when clicking "VER EQUIPOS COMPLETOS"
const btnRegex = /<button \n\s*onClick=\{\(\) => \{\n\s*setShowPackOpening\(false\);\n\s*setTeamsRevealed\(true\);\n\s*\}\}/;
const btnReplacement = `<button 
                    onClick={() => {
                        setShowPackOpening(false);
                        setTeamsRevealed(true);
                        localStorage.setItem('has_seen_walkout_' + leagueId, 'true');
                    }}`;
content = content.replace(btnRegex, btnReplacement);

fs.writeFileSync('src/views/CompanionApp.jsx', content);
console.log('Fixed walkout persistence');
