import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

const newLogic = `
  const [resolvedLeagueId, setResolvedLeagueId] = useState(null);
  const [isResolvingLeague, setIsResolvingLeague] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let lId = urlParams.get('league');
    
    if (lId && lId !== 'null' && lId !== 'undefined') {
      localStorage.setItem('fulbo_last_league', lId);
      setResolvedLeagueId(lId);
      setIsResolvingLeague(false);
    } else {
      lId = localStorage.getItem('fulbo_last_league');
      if (lId && lId !== 'null' && lId !== 'undefined') {
        setResolvedLeagueId(lId);
        setIsResolvingLeague(false);
      } else if (session?.user && isSupabaseConfigured && supabase) {
        // Try to recover leagueId from DB
        supabase
          .from('event_registrations')
          .select('host_id')
          .eq('player_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              const recoveredLeague = data[0].host_id;
              localStorage.setItem('fulbo_last_league', recoveredLeague);
              setResolvedLeagueId(recoveredLeague);
            }
            setIsResolvingLeague(false);
          })
          .catch(() => {
             setIsResolvingLeague(false);
          });
      } else {
        setIsResolvingLeague(false);
      }
    }
  }, [session]);

  const leagueId = resolvedLeagueId;
`;

// We will replace the existing synchronous leagueId logic
content = content.replace(
  /  const urlParams = new URLSearchParams\(window\.location\.search\);[\s\S]*?leagueId = localStorage\.getItem\('fulbo_last_league'\);\n  }/,
  newLogic
);

// We need to also wait for isResolvingLeague in the loading check
content = content.replace(
  /if \(loading\) {/,
  'if (loading || isResolvingLeague) {'
);

fs.writeFileSync('src/App.jsx', content);
console.log('Updated App.jsx with league auto-recovery');
