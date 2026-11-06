import React from 'react';
import { cx, ACCENT } from '../../utils/formatters';

export function FieldRow({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300">
          {label}
        </label>
        {hint && (
          <span className="text-[10px] font-mono text-slate-500">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export const inputCls = (acc = 'cyan') => cx(
  'w-full rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200',
  'bg-slate-900/90 dark:bg-slate-900/90 text-white placeholder-slate-500 border border-slate-700/80',
  'focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20'
);

export function EmptyState({ icon: Icon, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-750 flex items-center justify-center text-slate-500 shadow-xl">
          {Icon && <Icon className="w-8 h-8" />}
        </div>
        <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl pointer-events-none" />
      </div>
      <p className="text-xs sm:text-sm font-semibold text-slate-300 max-w-sm mb-2">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, tag = 'CENTINEL', action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse inline-block" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
            {tag}
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
