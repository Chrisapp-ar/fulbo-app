import fs from 'fs';

let content = fs.readFileSync('src/views/CompanionApp.jsx', 'utf8');

// 1. Add isSubmittingReg state
const statePattern = /const \[regSuccess, setRegSuccess\] = useState\(false\);/;
content = content.replace(statePattern, "const [regSuccess, setRegSuccess] = useState(false);\n  const [isSubmittingReg, setIsSubmittingReg] = useState(false);");

// 2. Fix isUserRegistered logic
const userRegPattern = /const isUserRegistered = uniqueRegistrations\.some\(r => r\.player_id === currentUser\?\.id \|\| \(r\.name && currentUser\?\.user_metadata\?\.full_name && r\.name\.toLowerCase\(\)\.trim\(\) === currentUser\.user_metadata\.full_name\.toLowerCase\(\)\.trim\(\)\)\);/;
const newUserReg = `const isUserRegistered = uniqueRegistrations.some(r => 
    (currentUser && r.player_id === currentUser.id) || 
    (r.name && regName && r.name.toLowerCase().trim() === regName.toLowerCase().trim())
  ) || regSuccess;`;
content = content.replace(userRegPattern, newUserReg);

// 3. Update handleRegSubmit to use isSubmittingReg
const submitPattern = /const handleRegSubmit = async \(e\) => \{\n\s*e\.preventDefault\(\);\n\s*if \(!regName\.trim\(\)\) return;/;
const newSubmit = `const handleRegSubmit = async (e) => {\n    e.preventDefault();\n    if (!regName.trim() || isSubmittingReg) return;\n    setIsSubmittingReg(true);`;
content = content.replace(submitPattern, newSubmit);

// 4. Update the end of handleRegSubmit to clear isSubmittingReg
const endSubmitPattern = /setRegSuccess\(true\);\n\s*setIsRegistering\(false\);\n\s*\}\n\s*\}\n\s*\};/;
const newEndSubmit = `setRegSuccess(true);\n          setIsRegistering(false);\n        }\n      }\n      setIsSubmittingReg(false);\n    };`;
content = content.replace(endSubmitPattern, newEndSubmit);

// 5. Update the "INSCRIBIRSE AHORA" button text to show loading state
const btnPattern = /<button onClick=\{\(e\) => \{ if \(localStorage\.getItem\('guestName'\)\) \{ handleRegSubmit\(e\); \} else \{ setIsRegistering\(true\); \} \}\} className="btn-primary" style=\{\{ padding: '0\.8rem' \}\}>\n\s*INSCRIBIRSE AHORA\n\s*<\/button>/;
const newBtn = `<button onClick={(e) => { if (localStorage.getItem('guestName')) { handleRegSubmit(e); } else { setIsRegistering(true); } }} className="btn-primary" style={{ padding: '0.8rem' }} disabled={isSubmittingReg}>
                                {isSubmittingReg ? 'INSCRIBIENDO...' : 'INSCRIBIRSE AHORA'}
                              </button>`;
content = content.replace(btnPattern, newBtn);

fs.writeFileSync('src/views/CompanionApp.jsx', content);
console.log('Fixed CompanionApp registration logic');
