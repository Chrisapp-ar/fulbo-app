import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const Login = ({ isGuest = false, onLogin }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const isActuallyGuest = selectedRole === 'guest';
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [plan, setPlan] = useState('trial'); // 'trial' | 'monthly'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);

  // Detect payment return parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription_payment') === 'approved') {
      setSubscriptionSuccess(true);
      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('FATAL ERROR: Cloud Security Gateway no configurado. Faltan variables de entorno en Vercel.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      localStorage.setItem('userRole', isActuallyGuest ? 'guest' : 'host');
      setLoading(false);
      onLogin();
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('FATAL ERROR: Cloud Security Gateway no configurado.');
      return;
    }

    if (!orgName.trim()) {
      setErrorMsg(isActuallyGuest ? 'Por favor, ingresa tu nombre completo.' : 'Por favor, ingresa el nombre de tu club o liga.');
      return;
    }

    setLoading(true);

    if (isActuallyGuest) {
      localStorage.setItem('guestName', orgName.trim());
      localStorage.setItem('userRole', 'guest');
      // 1. SignUp Guest User
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: orgName.trim()
          }
        }
      });

      if (signUpError) {
        setErrorMsg(signUpError.message);
        setLoading(false);
        return;
      }

      // 2. Log in Guest User
      await supabase.auth.signInWithPassword({ email, password });
      
      // Always bypass email confirmation block for guests to provide immediate access
      setLoading(false);
      onLogin();
      return;
    }
    
    // 1. SignUp Host in Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      setErrorMsg(signUpError.message);
      setLoading(false);
      return;
    }

    const hostUser = signUpData.user;
    if (!hostUser) {
      setErrorMsg('Error en el registro. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }

    const hostId = hostUser.id;
    const isTrial = plan === 'trial';
    const endsAt = isTrial 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString(); // Ends now (unpaid) until webhook updates it
    const subStatus = isTrial ? 'active' : 'unpaid';

    // Sleep 1.2s for PostgreSQL trigger to finish executing handle_new_host()
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 2. Update league metadata in public.hosts
    const { error: updateError } = await supabase
      .from('hosts')
      .update({
        organization_name: orgName.trim(),
        subscription_type: plan,
        subscription_status: subStatus,
        subscription_ends_at: endsAt
      })
      .eq('id', hostId);

    if (updateError) {
      console.error("Error setting host organization name:", updateError);
    }

    if (isTrial) {
      // 3a. For trial hosts, log them in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setErrorMsg(signInError.message);
        setLoading(false);
      } else {
        localStorage.setItem('userRole', 'host');
        setLoading(false);
        onLogin();
      }
    } else {
      // 3b. For monthly paid hosts, fetch Mercado Pago preference from Vercel Serverless Function
      try {
        const redirectUrl = `${window.location.origin}/?subscription_payment=approved&host_id=${hostId}`;
        const response = await fetch('/api/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostId, redirectUrl })
        });

        const data = await response.json();
        if (response.ok && data.initPoint) {
          // Redirect browser to Mercado Pago checkout
          window.location.href = data.initPoint;
        } else {
          setErrorMsg("Error al crear preferencia de Mercado Pago: " + (data.error || "Inténtalo más tarde."));
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Error al conectar con la pasarela de Mercado Pago.");
        setLoading(false);
      }
    }
  };

  const inputStyle = { 
    background: 'rgba(0,0,0,0.6)', 
    border: '1px solid rgba(255,255,255,0.1)', 
    color: 'var(--pure-white)', 
    padding: '0.8rem', 
    borderRadius: '6px', 
    width: '100%', 
    fontFamily: 'var(--font-secondary)', 
    marginBottom: '1rem', 
    fontSize: '1rem', 
    textAlign: 'center' 
  };

  const labelStyle = {
    color: 'var(--off-white)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.4rem',
    display: 'block',
    textAlign: 'left'
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pitch-black)' }}>
      <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '3rem 2rem', borderTop: '2px solid var(--electric-cyan)', animation: 'fadeIn 1s ease-out' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="FULBO Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', filter: 'drop-shadow(0 0 15px rgba(204,255,0,0.5))' }} />
            <h1 className="glow-text-volt" style={{ fontSize: '3.5rem', margin: 0, letterSpacing: '4px', fontStyle: 'italic', fontWeight: '900' }}>FULBO</h1>
          </div>
          <p style={{ color: 'var(--electric-cyan)', letterSpacing: '5px', textTransform: 'uppercase', marginTop: '0.5rem', marginBottom: '1.5rem', fontSize: '0.7rem', fontWeight: 'bold', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '100%' }}>
            THE ELITE MATCHMAKING ENGINE
          </p>
        </div>

        {selectedRole === null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
            <h2 style={{ color: 'var(--off-white)', fontSize: '1.2rem', marginBottom: '1rem' }}>¿Cómo deseas ingresar?</h2>
            
            <button 
              onClick={() => setSelectedRole('host')}
              style={{
                background: 'var(--pitch-black)',
                border: '2px solid var(--electric-cyan)',
                padding: '1.5rem',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--pure-white)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.8rem',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.4)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <span style={{ fontSize: '2.5rem' }}>👑</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>SOY ORGANIZADOR</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--electric-cyan)' }}>Crea ligas, gestiona eventos (Trial 7 Días)</span>
            </button>

            <button 
              onClick={() => setSelectedRole('guest')}
              style={{
                background: 'var(--pitch-black)',
                border: '2px solid var(--volt-lime)',
                padding: '1.5rem',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--pure-white)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.8rem',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(204, 255, 0, 0.4)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <span style={{ fontSize: '2.5rem' }}>👟</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-primary)' }}>SOY JUGADOR</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--volt-lime)' }}>100% Gratis. Únete a partidos y rankings.</span>
            </button>
          </div>
        ) : (
          <>
        {subscriptionSuccess && (
          <div style={{ 
            background: 'rgba(37,211,102,0.1)', 
            border: '1px solid #25D366', 
            color: '#25D366', 
            padding: '1rem', 
            borderRadius: '6px', 
            marginBottom: '1.5rem', 
            fontSize: '0.85rem',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            ¡Suscripción aprobada con éxito! 🎉<br />
            Inicia sesión para activar tu Matchmaking.
          </div>
        )}
        
        <div style={{ color: 'var(--off-white)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '1.5rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
          {isRegistering 
            ? (isActuallyGuest ? 'Registro de Jugador' : 'Registro de Club / Liga') 
            : (isActuallyGuest ? 'Acceso de Jugador' : 'Cloud Security Gateway')
          }
        </div>
        
        {errorMsg && (
          <div style={{ color: 'var(--crimson-red)', marginBottom: '1.2rem', fontSize: '0.85rem', fontWeight: '500' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          {isRegistering && (
            <div style={{ textAlign: 'left' }}>
              <label style={labelStyle}>{isActuallyGuest ? 'Tu Nombre completo' : 'Nombre de tu Club / Liga'}</label>
              <input type="text" placeholder={isActuallyGuest ? 'Ej: Lionel Messi' : 'Ej: Liga Intercountries'} style={inputStyle} value={orgName} onChange={e => setOrgName(e.target.value)} required />
            </div>
          )}

          <div style={{ textAlign: 'left' }}>
            <label style={labelStyle}>{isActuallyGuest ? 'Email del Jugador' : 'Email del Organizador (Host)'}</label>
            <input type="email" placeholder="jugador@email.com" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={labelStyle}>Clave de Acceso (Password)</label>
            <input type="password" placeholder="******" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {isRegistering && !isActuallyGuest && (
            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Selecciona tu Plan</label>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.4rem' }}>
                <button 
                  type="button" 
                  onClick={() => setPlan('trial')}
                  style={{
                    flex: 1,
                    padding: '0.8rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    background: plan === 'trial' ? 'var(--volt-lime)' : 'rgba(255,255,255,0.05)',
                    color: plan === 'trial' ? 'black' : 'white',
                    border: plan === 'trial' ? '1px solid var(--volt-lime)' : '1px solid rgba(255,255,255,0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  PRUEBA GRATIS<br />
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>(1 Semana)</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setPlan('monthly')}
                  style={{
                    flex: 1,
                    padding: '0.8rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    background: plan === 'monthly' ? 'var(--electric-cyan)' : 'rgba(255,255,255,0.05)',
                    color: plan === 'monthly' ? 'black' : 'white',
                    border: plan === 'monthly' ? '1px solid var(--electric-cyan)' : '1px solid rgba(255,255,255,0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  PREMIUM PRO<br />
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>$9.999 ARS/mes</span>
                </button>
              </div>
              <p style={{ color: 'var(--off-white)', fontSize: '0.65rem', marginTop: '0.5rem', textAlign: 'center' }}>
                * Ambos planes limitan los partidos a un máximo de 15 jugadores.
              </p>
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading} 
            style={{ 
              marginTop: '0.5rem', 
              borderColor: isRegistering 
                ? (isActuallyGuest ? 'var(--volt-lime)' : (plan === 'trial' ? 'var(--volt-lime)' : 'var(--electric-cyan)')) 
                : 'var(--electric-cyan)', 
              color: isRegistering 
                ? (isActuallyGuest ? 'var(--volt-lime)' : (plan === 'trial' ? 'var(--volt-lime)' : 'var(--electric-cyan)')) 
                : 'var(--electric-cyan)' 
            }}
          >
            {loading 
              ? 'PROCESANDO...' 
              : (isRegistering 
                  ? (isActuallyGuest ? 'REGISTRARSE Y ENTRAR ⚡' : (plan === 'trial' ? 'INICIAR PRUEBA GRATIS ⚡' : 'PAGAR E INICIALIZAR 💳')) 
                  : (isActuallyGuest ? 'INGRESAR A LA LIGA ⚽' : 'INITIALIZE MATCHMAKING'))
            }
          </button>
        </form>

        <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(''); }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--electric-cyan)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}
          >
            {isRegistering 
              ? (isActuallyGuest ? '¿Ya tienes cuenta de jugador? Inicia Sesión' : '¿Ya tienes una liga? Inicia Sesión') 
              : (isActuallyGuest ? '¿No tienes cuenta de jugador? Regístrate' : '¿No tienes cuenta? Regístrate')
            }
          </button>
          {!isGuest && (
            <button 
              onClick={() => { setSelectedRole(null); setErrorMsg(''); setIsRegistering(false); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--off-white)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                fontSize: '0.75rem',
                textDecoration: 'underline'
              }}
            >
              Cambiar Rol (Volver)
            </button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default Login;