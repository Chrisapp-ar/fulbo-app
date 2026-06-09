import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

const oldStr = `<div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                                 <span>{r.avatar || '👤'}</span>
                               </div>`;

const newStr = `<div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', overflow: 'hidden' }}>
                                 {r.avatar && r.avatar.startsWith('data:image') ? <img src={r.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{r.avatar || '👤'}</span>}
                               </div>`;

content = content.replace(oldStr, newStr);

fs.writeFileSync('src/views/CompanionApp.jsx', content);
console.log('Fixed Convocados Avatar');
