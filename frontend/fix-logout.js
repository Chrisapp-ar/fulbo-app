import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

const oldLogoutRegex = /const handleLogout = \(\) => \{\s*if \(isSupabaseConfigured && supabase\) supabase\.auth\.signOut\(\);\s*else \{\s*setIsAuthenticated\(false\);\s*setSession\(null\);\s*\}\s*\};/m;

const newLogout = `const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('guestName');
    localStorage.removeItem('guestRole');
    localStorage.removeItem('guestStats');
    localStorage.removeItem('guestAvatar');
    setIsAuthenticated(false);
    setSession(null);
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
    }
    window.location.href = '/';
  };`;

if (oldLogoutRegex.test(content)) {
  content = content.replace(oldLogoutRegex, newLogout);
  fs.writeFileSync('src/App.jsx', content);
  console.log('Fixed handleLogout');
} else {
  console.log('Failed to match handleLogout');
}
