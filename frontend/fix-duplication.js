import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

// Find the first declaration of myMatches
const myMatchesRegex = /const myMatches = matchHistory\.filter\([\s\S]*?const connectedPlayers = new Set\(\);[\s\S]*?inA \|\| inB;\n  \}\);/g;

// Instead of regex, let's just find the exact block and replace all occurrences with a single one.
const block = `  const myMatches = matchHistory.filter(match => {
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

`;

content = content.split(block).join('');
content = content.replace('  return (\r\n    <div className="page-container"', block + '  return (\r\n    <div className="page-container"');
content = content.replace('  return (\n    <div className="page-container"', block + '  return (\n    <div className="page-container"');

fs.writeFileSync('src/views/CompanionApp.jsx', content);
console.log('Fixed duplication');
