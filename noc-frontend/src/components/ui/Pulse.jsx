import React from 'react';
import { cx } from '../../utils/formatters';

export function Pulse({ color = 'blue', size = 'sm' }) {
  const s = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const c = color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-red-500' : color === 'cyan' ? 'bg-cyan-500' : 'bg-blue-500';
  return (
    <span className="relative flex items-center justify-center">
      <span className={cx('absolute rounded-full opacity-60 animate-ping', s, c)} />
      <span className={cx('relative rounded-full', s, c)} />
    </span>
  );
}
