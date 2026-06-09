import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

const oldList = `<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {uniqueRegistrations.length === 0 ? (
                          <span style={{ color: 'var(--off-white)', fontSize: '0.8rem' }}>Nadie registrado a\\u00FAn. \\u00A1S\\u00E9 el primero!</span>
                        ) : (
                          uniqueRegistrations.map((r, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', color: 'white', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span>{r.avatar || '\\uD83D\\uDC64'}</span>
                              <span style={{ fontWeight: 'bold' }}>{r.name}</span>
                            </div>
                          ))
                        )}
                      </div>`;

// The exact file has different encoding/escaping so we use a regex or string fallback
const oldRegex = /<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0\.5rem' }}>[\s\S]*?<\/div>\n\s*<\/div>\n\n\s*\{isUserRegistered \?/m;

const newList = `<ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {uniqueRegistrations.length === 0 ? (
                          <span style={{ color: 'var(--off-white)', fontSize: '0.8rem' }}>Nadie registrado aún. ¡Sé el primero!</span>
                        ) : (
                          uniqueRegistrations.map((r, i) => (
                            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                                  <span>{r.avatar || '👤'}</span>
                                </div>
                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>{r.name}</span>
                              </div>
                              <span style={{ color: 'var(--electric-cyan)', fontSize: '0.7rem', fontWeight: 'bold' }}>{r.role || 'JUG'}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    {isUserRegistered ?`;

if (oldRegex.test(content)) {
  content = content.replace(oldRegex, newList);
  fs.writeFileSync('src/views/CompanionApp.jsx', content);
  console.log('Fixed Convocados list via Regex');
} else {
  console.log('Regex failed to match');
}
