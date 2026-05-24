import React, { useState, useRef } from 'react';

const AVATARS = ['⚽', '🥅', '👟', '🏟️', '🏆', '🥇', '🧤', '🔥', '⚡', '🌟'];

const AvatarSelector = ({ onSelectAvatar, currentAvatar }) => {
  const [mode, setMode] = useState(null); // 'gallery' | 'camera'
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  const startCamera = async () => {
    setMode('camera');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      alert("No se pudo acceder a la cámara. Verifica los permisos de tu navegador.");
      setMode(null);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setMode(null);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      // Espejar la imagen para que se vea como un espejo natural
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      stopCamera();
      onSelectAvatar(dataUrl);
    }
  };

  const selectPredefined = (av) => {
    onSelectAvatar(av);
    setMode(null);
  };

  const btnStyle = { 
    background: 'rgba(255,255,255,0.05)', 
    color: 'var(--pure-white)', 
    border: '1px solid rgba(255,255,255,0.1)', 
    padding: '0.5rem', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    fontFamily: 'var(--font-primary)',
    fontSize: '0.8rem',
    flex: 1
  };

  return (
    <div style={{ marginTop: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <label style={{ color: 'var(--electric-cyan)', fontSize: '0.9rem', fontWeight: 'bold' }}>FOTO DEL JUGADOR</label>
        {currentAvatar && (
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--pitch-black)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentAvatar.startsWith('data:image') ? <img src={currentAvatar} alt="preview" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <span>{currentAvatar}</span>}
          </div>
        )}
      </div>
      
      {!mode && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => setMode('gallery')} style={btnStyle}>Elegir Ícono</button>
          <button type="button" onClick={startCamera} style={{...btnStyle, borderColor: 'var(--volt-lime)', color: 'var(--volt-lime)'}}>Cámara Web 📷</button>
        </div>
      )}

      {mode === 'gallery' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
            {AVATARS.map(av => (
              <div key={av} onClick={() => selectPredefined(av)} style={{ fontSize: '1.5rem', background: 'rgba(255,255,255,0.1)', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='var(--electric-cyan)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}>
                {av}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setMode(null)} style={{...btnStyle, marginTop: '1rem', width: '100%', background: 'transparent', color: 'var(--off-white)'}}>Cancelar</button>
        </div>
      )}

      {mode === 'camera' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', animation: 'fadeIn 0.3s' }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--volt-lime)', transform: 'scaleX(-1)' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={capturePhoto} style={{...btnStyle, background: 'var(--volt-lime)', color: '#000', fontWeight: 'bold'}}>Capturar ✅</button>
            <button type="button" onClick={stopCamera} style={{...btnStyle}}>Cancelar ✖</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarSelector;
