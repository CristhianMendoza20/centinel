import React, { useState, useEffect } from 'react';
import { cx } from '../utils/formatters';
import { BellIcon, CheckIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import { API_URL } from '../utils/constants';
import useAppStore from '../store/useAppStore';

export default function NotificacionesConfig() {
  const { alertas } = useAppStore();
  const [config, setConfig] = useState({ telegram: false, email: false });

  useEffect(() => {
    const token = localStorage.getItem('centinel-token');
    fetch(`${API_URL}/api/notif/config`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfig(d); })
      .catch(() => { });
  }, []);

  const labelTipo = tipo => {
    if (!tipo) return 'Sin tipo';
    const m = { SOSPECHOSO: 'Persona Sospechosa', DESAPARECIDO: 'Persona Desaparecida', LPR: 'Vehículo / Matrícula' };
    return m[tipo.toUpperCase()] || tipo;
  };

  const colorTipo = tipo => {
    const m = { SOSPECHOSO: 'red', DESAPARECIDO: 'cyan', LPR: 'amber' };
    return m[(tipo || '').toUpperCase()] || 'slate';
  };

  const fmtFechaHora = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const extractCam = cam => (cam || '').match(/CAM\s*\d+/i)?.[0] || cam || '—';

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Historial de Notificaciones"
        subtitle="Registro de alertas enviadas a Telegram y Gmail"
      />

      <div className="backdrop-blur-md rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            Últimos envíos ({alertas.length})
          </span>
        </div>

        {alertas.length === 0 ? (
          <EmptyState icon={BellIcon} message="No hay notificaciones recientes" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {['Fecha / Hora', 'Cámara', 'Categoría', 'Objetivo', 'Telegram', 'Gmail'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertas.slice(0, 50).map((a, i) => (
                  <tr key={a.id} className={cx(
                    'transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                    i % 2 === 0 ? '' : 'bg-black/[0.02] dark:bg-white/[0.02]'
                  )} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtFechaHora(a.fecha_hora)}</td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{extractCam(a.ubicacion_camara)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge color={colorTipo(a.tipo_alerta)}>{labelTipo(a.tipo_alerta)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold max-w-[150px] truncate" style={{ color: 'var(--text-primary)' }}>
                      {a.nombre || 'Desconocido'}
                    </td>
                    <td className="px-5 py-3">
                      {config.telegram ? (
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          <CheckIcon className="w-3.5 h-3.5" /> Enviado
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                          Inactivo
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {config.email ? (
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          <CheckIcon className="w-3.5 h-3.5" /> Enviado
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                          Inactivo
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
