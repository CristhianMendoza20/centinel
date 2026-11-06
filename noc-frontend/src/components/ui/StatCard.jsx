import React from 'react';
import { cx } from '../../utils/formatters';

const COLOR_CONFIG = {
  red: {
    accent: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.35)',
    badgeBg: 'rgba(239, 68, 68, 0.1)',
    text: 'text-red-400',
    headerBorder: 'linear-gradient(90deg, #ef4444 0%, transparent 100%)'
  },
  amber: {
    accent: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.35)',
    badgeBg: 'rgba(245, 158, 11, 0.1)',
    text: 'text-amber-400',
    headerBorder: 'linear-gradient(90deg, #f59e0b 0%, transparent 100%)'
  },
  cyan: {
    accent: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.35)',
    badgeBg: 'rgba(6, 182, 212, 0.1)',
    text: 'text-cyan-400',
    headerBorder: 'linear-gradient(90deg, #06b6d4 0%, transparent 100%)'
  },
  green: {
    accent: '#10b981',
    glow: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.35)',
    badgeBg: 'rgba(16, 185, 129, 0.1)',
    text: 'text-emerald-400',
    headerBorder: 'linear-gradient(90deg, #10b981 0%, transparent 100%)'
  },
  blue: {
    accent: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.35)',
    badgeBg: 'rgba(59, 130, 246, 0.1)',
    text: 'text-blue-400',
    headerBorder: 'linear-gradient(90deg, #3b82f6 0%, transparent 100%)'
  }
};

export function StatCard({ label, value, color = 'cyan', Icon, details, trend }) {
  const cfg = COLOR_CONFIG[color] || COLOR_CONFIG.cyan;

  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1"
      style={{
        background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 8px 30px -10px ${cfg.glow}`,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* ── Barra luminosa superior ── */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-1.5"
        style={{
          background: `linear-gradient(90deg, ${cfg.accent}, transparent)`
        }}
      />

      {/* ── Esquinas tácticas sutiles ── */}
      <span className="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-slate-600/50 pointer-events-none" />
      <span className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b border-l border-slate-600/50 pointer-events-none" />

      {/* ── Cabecera de la métrica ── */}
      <div className="relative flex items-center justify-between pb-3 border-b"
        style={{ borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.08))' }}>
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
          {label}
        </span>
        {Icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
            style={{
              background: cfg.badgeBg,
              border: `1px solid ${cfg.border}`,
              color: cfg.accent
            }}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* ── Valor Principal con Tipografía de Impacto ── */}
      <div className="mt-4 flex-1 flex flex-col justify-end">
        <div className="flex items-baseline justify-between">
          <div
            className={cx('text-4xl sm:text-5xl font-black font-mono tracking-tight leading-none', cfg.text)}
            style={{ textShadow: `0 0 20px ${cfg.glow}` }}
          >
            {value}
          </div>
          {trend && (
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {trend}
            </span>
          )}
        </div>

        {/* Detalles Tácticos */}
        {details && (
          <div className="mt-3 pt-2.5 border-t flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono"
            style={{ borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.06))', color: 'var(--text-tertiary, #64748b)' }}>
            {details.map((d, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-slate-500 inline-block" />
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
