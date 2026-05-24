import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!isSupabaseConfigured || !supabase) {
      // Mock Auth Fallback
      if(email && password) onLogin();
      return;
    }

    // Real Supabase Auth
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
       // Auto-registro para la demo si el usuario no existe (y si Supabase permite signups sin confirmación de email)
       const { error: signUpError } = await supabase.auth.signUp({ email, password });
       if (signUpError) setErrorMsg(signUpError.message);
       else alert("Tu cuenta Host ha sido registrada en la Nube. (Revisa tu email si tienes confirmación activa, de lo contrario vuelve a darle Entrar).");
    }
    setLoading(false);
  };

  const inputStyle = { background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--pure-white)', padding: '1rem', borderRadius: '6px', width: '100%', fontFamily: 'var(--font-secondary)', marginBottom: '1.5rem', fontSize: '1rem', textAlign: 'center' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pitch-black)' }}>
      <div className="glass-panel" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '4rem 2rem', borderTop: '2px solid var(--electric-cyan)', animation: 'fadeIn 1s ease-out' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.5rem' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <img src="/logo.png" alt="FULBO Logo" style={{ width: '90px', height: '90px', objectFit: 'contain', filter: 'drop-shadow(0 0 15px rgba(204,255,0,0.5))' }} />
             <h1 className="glow-text-volt" style={{ fontSize: '4.5rem', margin: 0, letterSpacing: '4px', fontStyle: 'italic', fontWeight: '900' }}>FULBO</h1>
           </div>
           <p style={{ color: 'var(--electric-cyan)', letterSpacing: '6px', textTransform: 'uppercase', marginTop: '0', marginBottom: '2rem', fontSize: '0.75rem', fontWeight: 'bold', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '100%' }}>
             THE ELITE MATCHMAKING ENGINE
           </p>
        </div>
        
        <div style={{ color: 'var(--off-white)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '2rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
          {isSupabaseConfigured ? 'Cloud Security Gateway' : 'Local Mock Gateway'}
        </div>
        
        {!isSupabaseConfigured && (
           <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid var(--ultimate-gold)', color: 'var(--ultimate-gold)', padding: '0.5rem', borderRadius: '4px', marginBottom: '2rem', fontSize: '0.8rem' }}>
             Modo Local: Escribe cualquier texto para ingresar. Las credenciales maestras de Supabase aún no están configuradas en .env.local
           </div>
        )}
        
        {errorMsg && (
           <div style={{ color: 'var(--crimson-red)', marginBottom: '1rem', fontSize: '0.9rem' }}>{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <input type={isSupabaseConfigured ? "email" : "text"} placeholder={isSupabaseConfigured ? "Email (Host Account)" : "HOST ID"} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="ACCESS KEY (Password)" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} required />
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem', borderColor: 'var(--electric-cyan)', color: 'var(--electric-cyan)' }}>
            {loading ? 'AUTENTICANDO...' : 'INITIALIZE MATCHMAKING'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
