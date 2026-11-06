import React, { useState, useEffect } from 'react';
import { LockIcon, ShieldIcon } from '../components/ui/Icons';
import { API_URL } from '../utils/constants';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [codigo2FA, setCodigo2FA] = useState('');
  const [userId, setUserId] = useState(null);
  const [ping, setPing] = useState(12);

  // Simulación de latencia táctica en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setPing(Math.floor(10 + Math.random() * 8));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Credenciales de acceso no válidas');
        setLoading(false);
        return;
      }

      if (data.requires2FA) {
        setUserId(data.userId);
        setStep(2);
        setLoading(false);
        return;
      }

      localStorage.setItem('centinel-token', data.token);
      localStorage.setItem('centinel-user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) {
      setError('Error de enlace con el servidor central. Verifica tu conexión de red.');
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, codigo: codigo2FA }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Código 2FA incorrecto o expirado');
        setLoading(false);
        return;
      }

      localStorage.setItem('centinel-token', data.token);
      localStorage.setItem('centinel-user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) {
      setError('Error al validar token de seguridad');
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@centinel.lat');
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center relative overflow-hidden px-4 py-8 select-none"
      style={{ background: 'var(--bg-primary, #020d18)' }}>

      {/* ── Luces de atmósfera y orbes radiantes CENTINEL ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[20%] -left-[10%] w-[680px] h-[680px] rounded-full blur-[140px] opacity-25 animate-pulse"
          style={{ background: 'radial-gradient(circle, var(--accent-cyan, #00f0ff), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[620px] h-[620px] rounded-full blur-[140px] opacity-20"
          style={{ background: 'radial-gradient(circle, #0284c7, transparent 70%)' }}
        />
        <div
          className="absolute top-[45%] left-[55%] -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full blur-[160px] opacity-10"
          style={{ background: 'radial-gradient(circle, #00d2df, transparent 70%)' }}
        />
      </div>

      {/* ── Retícula táctica de fondo con barrido radar ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 240, 255, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Línea sutil de barrido tipo radar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none opacity-40 animate-scanline"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--accent-cyan, #00f0ff), transparent)',
          boxShadow: '0 0 15px var(--accent-cyan, #00f0ff)'
        }}
      />

      {/* ── Tarjeta Central Flotante ── */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">

        {/* Ticker táctico superior */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg mb-6 text-[10px] font-mono border backdrop-blur-md"
          style={{
            background: 'var(--bg-panel, rgba(6, 21, 36, 0.72))',
            borderColor: 'var(--border-primary, rgba(30, 58, 88, 0.45))',
            color: 'var(--text-tertiary, #64748b)'
          }}>
          <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--accent-cyan, #00f0ff)' }}>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
            CENTINEL
          </span>
          <span className="hidden sm:inline">IA PLATFORM v2.4</span>
          <span className="font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {ping}ms
          </span>
        </div>

        {/* Identidad de Marca */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center p-2.5 relative z-10 shadow-2xl transition-transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 21, 36, 0.95), rgba(2, 13, 24, 0.95))',
                border: '1px solid var(--border-accent, rgba(0, 240, 255, 0.3))',
                boxShadow: '0 0 35px rgba(0, 240, 255, 0.25), inset 0 0 20px rgba(0, 240, 255, 0.1)'
              }}
            >
              <img src="/logo4.png" alt="CENTINEL" className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(0,240,255,0.4)]" />
            </div>
            {/* Halo de pulso */}
            <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 blur-xl animate-pulse pointer-events-none" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center justify-center gap-1.5" style={{ color: 'var(--text-heading, #ffffff)' }}>
            CENTI<span className="text-neon-cyan">NEL</span>
          </h1>
          <p className="text-xs font-semibold tracking-wider uppercase mt-1" style={{ color: 'var(--text-tertiary, #94a3b8)' }}>
            Seguridad Inteligente para tus Cámaras
          </p>
        </div>

        {/* ── Formulario de Acceso ── */}
        <div
          className="relative backdrop-blur-2xl rounded-2xl p-7 sm:p-8 overflow-hidden shadow-2xl transition-all"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            border: '1px solid var(--border-primary, rgba(30, 41, 59, 0.6))',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(0, 240, 255, 0.15)'
          }}
        >
          {/* Retículas tácticas de las 4 esquinas */}
          <span className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none" />
          <span className="absolute top-2 right-2 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
          <span className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none" />
          <span className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none" />

          {step === 1 ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-secondary, rgba(255,255,255,0.08))' }}>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-400">
                  <LockIcon className="w-3.5 h-3.5" />
                  Autenticación de Operador
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                  NIVEL 1
                </span>
              </div>

              {/* Mensaje de Error */}
              {error && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold animate-fade-in"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171'
                  }}>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Input Email */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                  Identificador / Correo Electrónico
                </label>
                <div className="relative group">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="operador@centinel.lat"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-slate-500"
                    style={{
                      background: 'var(--bg-input, #060d1a)',
                      border: '1px solid var(--border-primary, rgba(30, 41, 59, 0.8))',
                      color: 'var(--text-primary, #ffffff)'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--accent-cyan, #00f0ff)';
                      e.target.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.2)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--border-primary, rgba(30, 41, 59, 0.8))';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Input Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                    Contraseña Táctica
                  </label>
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                  >
                    <span>⚡ Autocompletar Admin</span>
                  </button>
                </div>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full px-4 py-3 pr-11 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-slate-500"
                    style={{
                      background: 'var(--bg-input, #060d1a)',
                      border: '1px solid var(--border-primary, rgba(30, 41, 59, 0.8))',
                      color: 'var(--text-primary, #ffffff)'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--accent-cyan, #00f0ff)';
                      e.target.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.2)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--border-primary, rgba(30, 41, 59, 0.8))';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label="Alternar visibilidad"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest text-white transition-all duration-300 relative overflow-hidden group hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: loading
                    ? '#334155'
                    : 'linear-gradient(135deg, var(--accent-cyan, #00f0ff), #0284c7)',
                  boxShadow: loading ? 'none' : '0 4px 25px rgba(0, 240, 255, 0.35)',
                }}
              >
                {/* Rayo de luz animado en hover */}
                {!loading && (
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                )}

                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Verificando Credenciales...
                    </>
                  ) : (
                    <>
                      <ShieldIcon className="w-4 h-4" />
                      Acceder a la Consola
                    </>
                  )}
                </span>
              </button>

              <div className="pt-2 text-center text-[10px] font-mono text-slate-500">
                <span>Sesión cifrada mediante tokens Bearer JWT • TLS 1.3</span>
              </div>
            </form>
          ) : (
            /* ── PASO 2: VERIFICACIÓN 2FA ── */
            <form onSubmit={handleVerify2FA} className="space-y-6 animate-fade-in">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-2 text-cyan-400">
                  <ShieldIcon className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Doble Factor de Autenticación
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Ingresa el código seguro de 6 dígitos enviado a tu correo o aplicación autenticadora.
                </p>
              </div>

              {error && (
                <div className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-center animate-fade-in text-red-400 bg-red-950/30 border border-red-800/40">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="text"
                  maxLength={6}
                  value={codigo2FA}
                  onChange={e => setCodigo2FA(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
                  className="w-full py-4 text-3xl font-mono font-black text-center tracking-[0.5em] rounded-xl outline-none transition-all placeholder:text-slate-700 text-cyan-300"
                  style={{
                    background: 'var(--bg-input, #060d1a)',
                    border: '2px solid var(--accent-cyan, #00f0ff)',
                    boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)'
                  }}
                />
              </div>

              <div className="space-y-2.5">
                <button
                  type="submit"
                  disabled={loading || codigo2FA.length !== 6}
                  className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest text-white transition-all"
                  style={{
                    background: (loading || codigo2FA.length !== 6)
                      ? '#334155'
                      : 'linear-gradient(135deg, var(--accent-cyan, #00f0ff), #0284c7)',
                    boxShadow: (loading || codigo2FA.length !== 6)
                      ? 'none'
                      : '0 4px 20px rgba(0, 240, 255, 0.35)'
                  }}
                >
                  {loading ? 'Verificando...' : 'Confirmar e Ingresar'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setCodigo2FA(''); setError(''); }}
                  className="w-full py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  ← Volver a inicio de sesión
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer institucional */}
        <div className="text-center mt-6 text-[11px] font-mono text-slate-500">
          CENTINEL • PLATAFORMA DE SEGURIDAD INTELIGENTE • centinel.lat
        </div>
      </div>
    </div>
  );
}
