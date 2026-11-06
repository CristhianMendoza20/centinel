import React, { useState, useEffect } from 'react';
import { cx } from '../../utils/formatters';
import { MenuIcon, ShieldIcon } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import ThemeToggle from '../ui/ThemeToggle';

export default function TopBar({ setSidebarOpen, muted, setMuted, clock }) {
  const [latency, setLatency] = useState(12);

  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(Math.floor(10 + Math.random() * 6));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className="h-20 flex-shrink-0 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 z-20 transition-all border-b backdrop-blur-xl"
      style={{
        background: 'var(--bg-panel, rgba(11, 18, 33, 0.75))',
        borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.4))',
      }}
    >
      {/* ── Izquierda: Menú Móvil & Título Táctico ── */}
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir navegación lateral"
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95"
          style={{
            background: 'var(--bg-deep, #050914)',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
            color: 'var(--text-secondary, #94a3b8)'
          }}
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black tracking-tight" style={{ color: 'var(--text-heading, #ffffff)' }}>
              CENTRO DE COMANDO
            </h1>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
              CENTINEL
            </span>
          </div>
          <span className="text-[11px] font-medium tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-tertiary, #64748b)' }}>
            <span>Monitor Táctico Multicámara con Análisis Biométrico y LPR</span>
          </span>
        </div>
      </div>

      {/* ── Derecha: Controles Tácticos, Mute, Reloj y Tema ── */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-shrink-0">

        {/* Latencia & Estado IA */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono border"
          style={{
            background: 'var(--bg-deep, #050914)',
            borderColor: 'var(--border-secondary, rgba(30, 41, 59, 0.4))',
            color: 'var(--text-secondary, #94a3b8)'
          }}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-white text-[11px]">MOTOR IA ACTIVO</span>
          <span className="text-slate-500">•</span>
          <span className="text-cyan-400 font-semibold text-[11px]">{latency}ms</span>
        </div>

        {/* Selector de Tema */}
        <ThemeToggle />

        {/* Botón Mute Global de Audio Táctico */}
        <button
          onClick={() => setMuted(m => !m)}
          title={muted ? 'Activar sirena y alertas de sonido' : 'Silenciar alertas acústicas'}
          className={cx(
            'h-9 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all duration-200 active:scale-95',
            muted
              ? 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-white'
              : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:bg-cyan-500/20'
          )}
        >
          <span className="text-sm">{muted ? '🔇' : '🔊'}</span>
          <span className="hidden sm:inline text-[11px] tracking-wider uppercase font-mono">
            {muted ? 'MUTE' : 'AUDIO ON'}
          </span>
        </button>

        {/* Reloj Digital Militar */}
        <div
          className="hidden sm:flex flex-col items-end px-3.5 py-1 rounded-xl border font-mono"
          style={{
            background: 'var(--bg-deep, #050914)',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          }}
        >
          <div className="text-xs font-black tracking-widest text-white">
            {clock.toLocaleTimeString('es-BO', { hour12: false })}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {clock.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );
}
