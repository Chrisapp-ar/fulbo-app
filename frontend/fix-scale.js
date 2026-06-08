import fs from 'fs';

// 1. Update index.css
let css = fs.readFileSync('src/index.css', 'utf8');
if (!css.includes('overflow-x: hidden;')) {
  css = css.replace(/body \{/, 'body {\n  overflow-x: hidden;');
}
fs.writeFileSync('src/index.css', css);

// 2. Update CompanionApp.jsx
let c = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

// Replace the inline styled root div with className="page-container"
// Note: We'll keep minHeight and background for the specific app look
c = c.replace(
  "<div style={{ width: '100%', minHeight: '100vh', background: 'var(--pitch-black)', padding: '2rem 1.5rem 80px 1.5rem', fontFamily: 'var(--font-secondary)', boxSizing: 'border-box' }}>",
  "<div className=\"page-container\" style={{ minHeight: '100vh', background: 'var(--pitch-black)', fontFamily: 'var(--font-secondary)' }}>"
);

// Fallback in case it wasn't exactly that string
c = c.replace(
  "<div style={{ minHeight: '100vh', background: 'var(--pitch-black)', padding: '1rem 0.5rem 80px 0.5rem', fontFamily: 'var(--font-secondary)' }}>",
  "<div className=\"page-container\" style={{ minHeight: '100vh', background: 'var(--pitch-black)', fontFamily: 'var(--font-secondary)' }}>"
);

// Add flexWrap to Header Info
c = c.replace(
  "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>",
  "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>"
);

fs.writeFileSync('src/views/CompanionApp.jsx', c);
console.log('Fixed CompanionApp container scaling and overflow');
