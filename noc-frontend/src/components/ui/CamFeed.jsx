import React, { useState } from 'react';
import { cx, ACCENT } from '../../utils/formatters';
import { Pulse } from './Pulse';
import { CamIcon } from './Icons';

export function CamFeed({ src, title, badge, color }) {
  const [err, setErr] = useState(false);
  const a = ACCENT[color] || ACCENT.blue;
  
  return (
    <div className={cx('backdrop-blur-md border rounded-2xl overflow-hidden', a.border)}
      style={{ background: 'var(--bg-card)' }}>
      <div className={cx('px-4 py-3 border-b flex items-center justify-between', a.border)}>
        <div className="flex items-center gap-2.5">
          <Pulse color={color} />
          <span className={cx('text-[10px] font-black uppercase tracking-widest', a.text)}>{title}</span>
        </div>
        {badge}
      </div>
      <div className="relative aspect-video" style={{ background: 'var(--cam-bg)' }}>
        {!err ? (
          <img src={src} alt={title} className="w-full h-full object-cover"
            onError={() => setErr(true)} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <CamIcon className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>Sin señal de video</p>
            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>Verifica que el worker esté activo</p>
          </div>
        )}
        {!err && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
            <div className={cx(
              'absolute left-0 right-0 h-px opacity-20 animate-[scanline_4s_linear_infinite]',
              a.bg
            )} />
          </div>
        )}
      </div>
    </div>
  );
}
