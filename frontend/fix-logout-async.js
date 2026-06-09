import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

const oldLogoutRegex = /const handleLogout = \(\) => \{\s*localStorage\.removeItem\('userRole'\);[\s\S]*?window\.location\.href = '\/';\s*\};/m;

const newLogout = `const handleLogout = async () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('guestName');
    localStorage.removeItem('guestRole');
    localStorage.removeItem('guestStats');
    localStorage.removeItem('guestAvatar');
    setIsAuthenticated(false);
    setSession(null);
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    window.location.href = '/';
  };`;

if (oldLogoutRegex.test(content)) {
  content = content.replace(oldLogoutRegex, newLogout);
  fs.writeFileSync('src/App.jsx', content);
  console.log('Fixed async handleLogout');
} else {
  console.log('Failed to match handleLogout');
}
