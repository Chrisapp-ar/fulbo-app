import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

const oldTeamA = `<span>{p.avatar || '\\uD83D\\uDC64'}</span>
                                <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                                <span style={{ color: 'var(--volt-lime)', fontSize: '0.7rem' }}>({p.role.substring(0,3).toUpperCase()})</span>`;

const newTeamA = `<div style={{ width: '20px', height: '20px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {p.avatar && p.avatar.startsWith('data:image') ? <img src={p.avatar} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : <span>{p.avatar || '👤'}</span>}
                                </div>
                                <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                                <span style={{ color: 'var(--volt-lime)', fontSize: '0.7rem' }}>({p.role.substring(0,3).toUpperCase()})</span>`;

const oldTeamB = `<span>{p.avatar || '\\uD83D\\uDC64'}</span>
                                <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                                <span style={{ color: 'var(--electric-cyan)', fontSize: '0.7rem' }}>({p.role.substring(0,3).toUpperCase()})</span>`;

const newTeamB = `<div style={{ width: '20px', height: '20px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {p.avatar && p.avatar.startsWith('data:image') ? <img src={p.avatar} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : <span>{p.avatar || '👤'}</span>}
                                </div>
                                <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                                <span style={{ color: 'var(--electric-cyan)', fontSize: '0.7rem' }}>({p.role.substring(0,3).toUpperCase()})</span>`;

const fallbackRegexA = /<span>\{p\.avatar \|\| '👤'\}<\/span>\s*<span style=\{\{ fontWeight: 'bold' \}\}>\{p\.name\}<\/span>\s*<span style=\{\{ color: 'var\(--volt-lime\)', fontSize: '0\.7rem' \}\}>\(\{p\.role\.substring\(0,3\)\.toUpperCase\(\)\}\)<\/span>/;
const fallbackRegexB = /<span>\{p\.avatar \|\| '👤'\}<\/span>\s*<span style=\{\{ fontWeight: 'bold' \}\}>\{p\.name\}<\/span>\s*<span style=\{\{ color: 'var\(--electric-cyan\)', fontSize: '0\.7rem' \}\}>\(\{p\.role\.substring\(0,3\)\.toUpperCase\(\)\}\)<\/span>/;

content = content.replace(fallbackRegexA, newTeamA);
content = content.replace(fallbackRegexB, newTeamB);

fs.writeFileSync('src/views/CompanionApp.jsx', content);
console.log('Fixed remaining avatars');
