import fs from 'fs';

const files = [
  'src/views/CompanionApp.jsx',
  'src/views/Dashboard.jsx',
  'src/App.jsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    // regex to remove animation: 'fadeIn ...'
    content = content.replace(/,\s*animation:\s*'fadeIn[^']*'/g, '');
    content = content.replace(/animation:\s*'fadeIn[^']*',?\s*/g, '');
    fs.writeFileSync(f, content);
  }
});
console.log("Animations removed.");
