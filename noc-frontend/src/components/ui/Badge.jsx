import React from 'react';
import { cx } from '../../utils/formatters';
import { Pulse } from './Pulse';

export function Badge({ color = 'blue', children, dot = false, size = 'xs' }) {
  const styles = {
    red:   'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
    blue:  'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
    cyan:  'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]',
    slate: 'bg-slate-800/80 text-slate-400 border-slate-700/60 shadow-none',
  };

  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 font-bold uppercase tracking-wider border rounded-full px-2.5 py-0.5 transition-all select-none',
      size === 'xs' ? 'text-[9px]' : 'text-[10px]',
      styles[color] || styles.blue
    )}>
      {dot && <Pulse color={color} size="sm" />}
      {children}
    </span>
  );
}
