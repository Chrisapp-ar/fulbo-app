import fs from 'fs';
const file = 'src/views/CompanionApp.jsx';
let c = fs.readFileSync(file, 'utf8');

// Fix root div
c = c.replace(
  "return (\n      <div style={{ minHeight: '100vh', background: 'var(--pitch-black)', padding: '1rem 0.5rem 80px 0.5rem', fontFamily: 'var(--font-secondary)' }}>",
  "return (\n      <div style={{ width: '100%', minHeight: '100vh', background: 'var(--pitch-black)', padding: '1rem 0.5rem 80px 0.5rem', fontFamily: 'var(--font-secondary)', boxSizing: 'border-box' }}>"
);

// Fix tab containers
c = c.replace(/maxWidth:\s*'600px',\s*margin:\s*'0 auto'/g, "width: '100%', maxWidth: '600px', margin: '0 auto', boxSizing: 'border-box'");

// Fix selectedPlayer container which also lacked width 100%
c = c.replace(
  "<div style={{ \n          minHeight: '100vh', \n          background: 'var(--pitch-black)', \n          display: 'flex', \n          flexDirection: 'column', \n          alignItems: 'center', \n          padding: '2rem 1rem', \n          overflowY: 'auto' \n        }}>",
  "<div style={{ \n          width: '100%',\n          minHeight: '100vh', \n          background: 'var(--pitch-black)', \n          display: 'flex', \n          flexDirection: 'column', \n          alignItems: 'center', \n          padding: '2rem 1rem', \n          overflowY: 'auto', \n          boxSizing: 'border-box'\n        }}>"
);

fs.writeFileSync(file, c);
console.log("Layout alignments fixed");
