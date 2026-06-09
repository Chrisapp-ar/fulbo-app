import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

const newLogic = `
  const [resolvedLeagueId, setResolvedLeagueId] = useState(null);
  const [isResolvingLeague, setIsResolvingLeague] = useState(true);

  useEffect(() => {
    const fetchProfile = async (lIdToSet) => {
      if (session?.user && isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('player_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (data && data.length > 0) {
            const lastReg = data[0];
            if (!lIdToSet) {
              lIdToSet = lastReg.host_id;
              localStorage.setItem('fulbo_last_league', lIdToSet);
            }
            if (!localStorage.getItem('guestName') && lastReg.name) {
              localStorage.setItem('guestName', lastReg.name);
              if (lastReg.role) localStorage.setItem('guestRole', lastReg.role);
              if (lastReg.stats) localStorage.setItem('guestStats', JSON.stringify(lastReg.stats));
              if (lastReg.avatar) localStorage.setItem('guestAvatar', lastReg.avatar);
            }
          }
        } catch (e) {
          console.error("Error recovering profile", e);
        }
      }
      setResolvedLeagueId(lIdToSet);
      setIsResolvingLeague(false);
    };

    const urlParams = new URLSearchParams(window.location.search);
    let lId = urlParams.get('league');
    
    if (lId && lId !== 'null' && lId !== 'undefined') {
      localStorage.setItem('fulbo_last_league', lId);
      fetchProfile(lId);
    } else {
      lId = localStorage.getItem('fulbo_last_league');
      if (lId && lId !== 'null' && lId !== 'undefined') {
        fetchProfile(lId);
      } else {
        fetchProfile(null);
      }
    }
  }, [session]);

  const leagueId = resolvedLeagueId;
`;

content = content.replace(
  /  const \[resolvedLeagueId, setResolvedLeagueId\] = useState\(null\);\n  const \[isResolvingLeague, setIsResolvingLeague\] = useState\(true\);\n\n  useEffect\(\(\) => \{\n    const urlParams[\s\S]*?const leagueId = resolvedLeagueId;\n/m,
  newLogic + '\n'
);

fs.writeFileSync('src/App.jsx', content);
console.log('Fixed App.jsx profile recovery');
