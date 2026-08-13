import React, { useState } from 'react';

const MOCK_USERS = [
  { username: 'sumith', password: 'sumith@123', tenant: 'Oupi' },
  { username: 'deepa', password: 'deepa@123', tenant: 'Oupi' },
  { username: 'avinash', password: 'avinash@123', tenant: 'Oupi' },
  { username: 'Oupi_123', password: 'Oupi@123', tenant: 'Oupi' },
  { username: 'Kumar01', password: 'Kumar@123', tenant: 'Kumar' },
  
];

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const user = MOCK_USERS.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password);
    if (user) {
      setError('');
      onLoginSuccess({ ...user, username: user.username.charAt(0).toUpperCase() + user.username.slice(1) });
    } else {   
      setError('Invalid username or password');
    }
  };

  return (
    <div className="theme-day" style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      fontFamily: 'var(--font-sans)',
      position: 'relative'
    }}>
      {/* Background ambient glows matching the app-container */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(70% 55% at 12% 0%, rgba(124, 92, 255, 0.16) 0%, transparent 60%),
          radial-gradient(60% 50% at 92% 8%, rgba(34, 211, 238, 0.12) 0%, transparent 55%),
          radial-gradient(90% 80% at 50% 120%, rgba(244, 114, 182, 0.07) 0%, transparent 60%)
        `
      }} />
      
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(22px) saturate(140%)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '54px', height: '54px', 
            background: 'var(--accent-gradient)', 
            borderRadius: '14px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 16px',
            fontSize: '28px',
            boxShadow: '0 4px 16px var(--accent-glow)'
          }}>
            🎓
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>Teacher AI</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '14.5px' }}>Sign in to continue to your dashboard</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && <div style={{ color: 'var(--error-color)', fontSize: '13.5px', textAlign: 'center', background: 'rgba(251, 113, 133, 0.1)', padding: '10px', borderRadius: '10px', fontWeight: '500' }}>{error}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-main)' }}>Username</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                padding: '14px 16px',
                borderRadius: '12px',
                color: 'var(--text-main)',
                fontSize: '14.5px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent-color)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-subtle)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-main)' }}>Password</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  padding: '14px 46px 14px 16px',
                  borderRadius: '12px',
                  color: 'var(--text-main)',
                  fontSize: '14.5px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-color)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-subtle)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '12px',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  margin: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-dim)',
                  lineHeight: 0
                }}
              >
                {showPassword ? (
                  // eye-off
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  // eye
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" style={{
            background: 'var(--accent-gradient)',
            border: 'none',
            padding: '16px',
            borderRadius: '12px',
            color: 'var(--on-accent)',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            marginTop: '8px',
            boxShadow: '0 4px 14px var(--accent-glow)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={e => { e.target.style.transform = 'scale(1.02)'; e.target.style.boxShadow = '0 6px 20px var(--accent-glow)'; }}
          onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 4px 14px var(--accent-glow)'; }}
          >
            Sign In
          </button>
        </form>

   
          
      </div>
    </div>
  );
}
