import fs from 'fs';
let c = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');
c = c.replace(/maxWidth: '100vw'/g, "maxWidth: '100%'");
c = c.replace(/width: '100vw'/g, "width: '100%'");
fs.writeFileSync('src/views/CompanionApp.jsx', c);
console.log('Fixed 100vw');
