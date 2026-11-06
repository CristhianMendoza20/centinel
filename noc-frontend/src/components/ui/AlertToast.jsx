import React, { useState, useEffect } from 'react';
import { cx } from '../../utils/formatters';
import { CarIcon, ShieldIcon, XIcon } from './Icons';
import AudioEngine from '../../utils/AudioEngine';

export function AlertToast({ alerta, onClose, muted, onToggleMute, notifStatus }) {
  const isDesap  = alerta?.tipo_alerta === 'DESAPARECIDO';
  const isLPR    = alerta?.tipo_alerta === 'LPR';
  const notif    = notifStatus || { whatsapp: false, telegram: false, email: false };
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alerta) setTimeout(() => setVisible(true), 30);
    else setVisible(false);
  }, [alerta]);

  if (!alerta) return null;

  const canalesActivos = [
    notif.whatsapp && { label: 'WhatsApp', icon: '📱' },
    notif.telegram && { label: 'Telegram', icon: '✈️'  },
    notif.email    && { label: 'Email',    icon: '📧' },
  ].filter(Boolean);

  const toastBg = isLPR ? 'var(--toast-bg-amber)' : isDesap ? 'var(--toast-bg-cyan)' : 'var(--toast-bg-red)';
  const accentColor = isLPR ? 'var(--accent-amber)' : isDesap ? 'var(--accent-cyan)' : 'var(--accent-red)';
  const barCls = isLPR ? 'bg-amber-500' : isDesap ? 'bg-cyan-500' : 'bg-red-500';
  const iconBg = isLPR ? 'var(--accent-amber-soft)' : isDesap ? 'var(--accent-cyan-soft)' : 'var(--accent-red-soft)';
  const AlertIconComponent = isLPR ? CarIcon : ShieldIcon;
  const titleText = isLPR ? '🚗 Vehículo en lista negra' : isDesap ? '🔍 Persona desaparecida localizada' : '🚨 Sospechoso detectado';

  return (
    <div className={cx(
      'fixed top-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]',
      'rounded-2xl border-2 shadow-2xl backdrop-blur-sm overflow-hidden',
      'transition-all duration-500',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4',
    )} style={{
      background: toastBg,
      borderColor: accentColor,
    }}>

      <div className="absolute top-0 left-0 right-0 h-0.5">
        <div className={cx('h-full alert-progress', barCls)} />
      </div>

      <div className="p-4 pt-5">
        <div className="flex items-start gap-3">
          <div className={cx(
            'relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden',
          )} style={!alerta.foto_captura ? { background: iconBg } : undefined}>
            {!alerta.foto_captura && (
              <div className="absolute inset-0 rounded-xl animate-ping opacity-25" style={{ background: accentColor }} />
            )}
            {alerta.foto_captura ? (
              <img src={alerta.foto_captura} alt="Captura" className="w-full h-full object-cover" />
            ) : (
              <AlertIconComponent className="relative w-5 h-5" style={{ color: accentColor }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: accentColor }}>
              {titleText}
            </p>
            <p className="text-base font-black mt-1 truncate leading-tight" style={{ color: 'var(--text-heading)' }}>
              {isLPR ? `Placa: ${alerta.nombre || 'N/D'}` : (alerta.nombre || 'Desconocido')}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              📷 {alerta.ubicacion_camara || 'Cámara táctica'}
              {isLPR && alerta.tipo_vehiculo ? ` · ${alerta.tipo_vehiculo}` : ''}
            </p>
            {isLPR && alerta.contacto_referencia && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--accent-amber)', opacity: 0.8 }}>
                📞 {alerta.contacto_referencia}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              style={{ color: 'var(--text-tertiary)' }}>
              <XIcon className="w-4 h-4" />
            </button>
            <button onClick={() => { onToggleMute(); AudioEngine.click(); }}
              title={muted ? 'Activar sonido' : 'Silenciar alerta'}
              className={cx(
                'w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-sm',
                muted
                  ? 'hover:bg-black/10 dark:hover:bg-white/10'
                  : 'hover:bg-amber-500/10'
              )}
              style={{ color: muted ? 'var(--text-tertiary)' : 'var(--accent-amber)' }}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
            <div
              className={cx('h-full rounded-full transition-all duration-700',
                isLPR ? 'bg-amber-400' : isDesap ? 'bg-cyan-400' : 'bg-red-400')}
              style={{ width: `${Math.min(100, alerta.nivel_confianza || 0)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
            {parseFloat(alerta.nivel_confianza || 0).toFixed(1)}% IA
          </span>
        </div>

        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-secondary)' }}>
          {canalesActivos.length > 0 ? (
            <>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Notificaciones enviadas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {canalesActivos.map(c => (
                  <span key={c.label}
                    className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 rounded-md px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {c.icon} {c.label} ✓
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
              ⚠ Sin canales activos — configura notificaciones en el módulo correspondiente
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
