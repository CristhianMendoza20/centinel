import React, { useState } from 'react';
import { cx, fmt, fmtDate, getImagenUrl } from '../utils/formatters';
import { API_URL } from '../utils/constants';
import { PersonIcon, SearchIcon } from '../components/ui/Icons';
import { SectionHeader, inputCls } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';

export default function PersonasCapturadas({
  capturasPersonas,
  filtroCapturasPersonas,
  setFiltroCapturasPersonas,
  filtroTiempoPersonas,
  setFiltroTiempoPersonas,
  filterByTime,
  setModalContexto
}) {
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleNotify = async (id) => {
    try {
      const token = localStorage.getItem('centinel-token');
      const res = await fetch(`${API_URL}/api/alertas/${id}/notificar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) showToast('Se han enviado alertas por Telegram y Correo exitosamente.');
      else showToast('No se pudo enviar la notificación manual.');
    } catch (e) {
      showToast('Error de red al intentar notificar.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative z-10">
      <SectionHeader
        title="Personas Capturadas"
        subtitle="Registro histórico de todas las personas detectadas en video"
      />
      
      <div className="backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row gap-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <input className={cx(inputCls('cyan'), 'flex-1')}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
          placeholder="Buscar por nombre, tipo o ID..."
          value={filtroCapturasPersonas} onChange={e => setFiltroCapturasPersonas(e.target.value)}
        />
        <select 
          className={cx(inputCls('blue'), 'w-full sm:w-48 cursor-pointer')}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
          value={filtroTiempoPersonas} onChange={e => setFiltroTiempoPersonas(e.target.value)}
        >
          <option value="TODO">Todo el historial</option>
          <option value="10MIN">Últimos 10 minutos</option>
          <option value="1HORA">Última hora</option>
          <option value="24HORAS">Últimas 24 horas</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {capturasPersonas
          .filter(p => filterByTime(p.fecha_hora, filtroTiempoPersonas))
          .filter(p => (p.nombre || '').toLowerCase().includes(filtroCapturasPersonas.toLowerCase()) || (p.tipo || '').toLowerCase().includes(filtroCapturasPersonas.toLowerCase()) || String(p.id_persona).includes(filtroCapturasPersonas))
          .map(p => (
          <div key={p.id_local || p.id_persona} className="backdrop-blur-md rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>ID: {String(p.id_persona).substring(0,8)}</p>
                <h4 className="text-sm font-black mt-0.5" style={{ color: 'var(--text-heading)' }}>{p.nombre || 'Desconocido'}</h4>
              </div>
              <Badge color={p.tipo === 'desconocido' ? 'slate' : (p.tipo === 'sospechoso' ? 'red' : 'amber')}>
                {p.tipo.toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex gap-2 h-32 mt-2">
              <div className="flex-1 rounded-lg overflow-hidden relative" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-primary)' }}>
                <span className="absolute top-1 left-1 z-10 text-[8px] px-1 rounded" style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>Rostro Capturado</span>
                {p.foto_rostro ? <img src={getImagenUrl(p.foto_rostro)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><PersonIcon className="w-6 h-6" style={{ color: 'var(--text-muted)' }} /></div>}
              </div>
              <div className="w-24 flex-shrink-0 rounded-lg overflow-hidden relative" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-primary)' }}>
                <span className="absolute top-1 left-1 z-10 text-[8px] px-1 rounded" style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>Registrado</span>
                {p.foto_registrada ? <img src={getImagenUrl(p.foto_registrada)} className="w-full h-full object-contain" /> : <div className="w-full h-full flex flex-col items-center justify-center text-center p-1"><PersonIcon className="w-4 h-4 mb-1" style={{ color: 'var(--text-muted)' }} /><span className="text-[7px]" style={{ color: 'var(--text-muted)' }}>Sin registro</span></div>}
              </div>
            </div>

            {p.nivel_confianza != null && (
              <div className="mt-2 mb-1 px-1">
                <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                  <span>Nivel de similitud</span>
                  <span className="font-bold">{parseFloat(p.nivel_confianza).toFixed(1)}%</span>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-deep)' }}>
                  <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.nivel_confianza))}%`, background: 'var(--accent-primary)' }}></div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              {p.foto_contexto && (
                <button onClick={() => setModalContexto(p.foto_contexto)} className="flex-1 flex items-center justify-center gap-2 text-[11px] font-bold py-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                  <SearchIcon className="w-3.5 h-3.5" /> Ver Contexto
                </button>
              )}
              <button onClick={() => handleNotify(p.id_persona)} className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                <span>🔔 Notificar</span>
              </button>
            </div>
            
            <div className="flex items-center justify-between text-[10px] font-mono mt-1 pt-2" style={{ borderTop: '1px solid var(--border-secondary)', color: 'var(--text-tertiary)' }}>
              <span>📷 {p.ubicacion_camara}</span>
              <span>{fmtDate(p.fecha_hora)} {fmt(p.fecha_hora)}</span>
            </div>
          </div>
        ))}
        
        {capturasPersonas.length === 0 && (
          <div className="col-span-full py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <PersonIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
            No hay personas capturadas aún.
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="backdrop-blur-xl rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-[var(--accent-cyan)]/50" 
               style={{ background: 'var(--bg-overlay)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-cyan-soft, rgba(6,182,212,0.2))', color: 'var(--accent-cyan, #06b6d4)' }}>
              ✓
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: 'var(--accent-cyan, #06b6d4)' }}>Registro notificado</p>
              <p className="text-[13px] font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{toastMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
