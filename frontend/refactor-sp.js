import fs from 'fs';

let c = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

const spStart = c.indexOf('if (selectedPlayer) {');
const spEnd = c.indexOf('  const isEventExpired = (event) => {');
const spBlock = c.substring(spStart, spEnd);
c = c.replace(spBlock, '');

// Process spBlock to get just the JSX
let jsxBlock = spBlock.replace('if (selectedPlayer) {', '');
jsxBlock = jsxBlock.substring(jsxBlock.indexOf('return (') + 8);
// Find the last closing brace of the if block
const lastBrace = jsxBlock.lastIndexOf('}');
jsxBlock = jsxBlock.substring(0, lastBrace).trim();
// Remove the last semicolon if it exists
if (jsxBlock.endsWith(';')) jsxBlock = jsxBlock.slice(0, -1);

// Find the main return
const mainReturnStart = c.indexOf('{showPackOpening && (');
const firstPart = c.slice(0, mainReturnStart);
const secondPart = c.slice(mainReturnStart);

// We want to wrap the rest of the tab contents in a Fragment, EXCEPT we need to insert the selectedPlayer logic before it.
// Actually, let's just insert `{selectedPlayer ? ( jsxBlock ) : ( <>`
// And add `</>)}` at the end of the file.

const endIdx = secondPart.lastIndexOf('</div>');
const middle = secondPart.slice(0, endIdx);
const finalEnd = secondPart.slice(endIdx);

const newC = firstPart + 
  '{selectedPlayer ? (' + jsxBlock + ') : (<>\n' + 
  middle + '\n</>)}\n' + finalEnd;

fs.writeFileSync('src/views/CompanionApp.jsx', newC);
console.log('Refactored CompanionApp.jsx');
