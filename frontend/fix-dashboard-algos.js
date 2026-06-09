import fs from 'fs';

let content = fs.readFileSync('src/views/Dashboard.jsx', 'utf8');

const regex1 = /const key = r\.id \|\| r\.name\.toLowerCase\(\)\.trim\(\);/g;
content = content.replace(regex1, "const key = r.name.toLowerCase().trim();");

fs.writeFileSync('src/views/Dashboard.jsx', content);
console.log('Fixed Dashboard algorithms to clear duplicates by name');
