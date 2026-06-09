import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

const regex = /<div style=\{\{\s*width:\s*'28px',\s*height:\s*'28px',\s*borderRadius:\s*'50%',\s*background:\s*'rgba\(255,255,255,0\.1\)',\s*display:\s*'flex',\s*alignItems:\s*'center',\s*justifyContent:\s*'center',\s*fontSize:\s*'0\.9rem'\s*\}\}>\s*<span>\{r\.avatar\s*\|\|\s*'👤'\}<\/span>\s*<\/div>/g;

const replacement = `<div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', overflow: 'hidden' }}>
                                 {r.avatar && r.avatar.startsWith('data:image') ? <img src={r.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{r.avatar || '👤'}</span>}
                               </div>`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('src/views/CompanionApp.jsx', content);
  console.log('Fixed Convocados Avatar Regex');
} else {
  console.log('Regex failed to match');
}
