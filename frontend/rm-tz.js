import fs from 'fs';
const files = ['src/views/CompanionApp.jsx', 'src/views/Dashboard.jsx'];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace("WebkitTransform: 'translateZ(0)',", "");
  c = c.replace("transform: 'translateZ(0)',", "");
  c = c.replace("WebkitTransform: 'translateZ(0)'", "");
  c = c.replace("transform: 'translateZ(0)'", "");
  fs.writeFileSync(f, c);
});
console.log("Done");
