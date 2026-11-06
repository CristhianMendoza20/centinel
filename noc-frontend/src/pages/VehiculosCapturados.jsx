import React, { useState } from 'react';
import { cx, fmt, fmtDate, getImagenUrl } from '../utils/formatters';
import { API_URL } from '../utils/constants';
import { CarIcon, SearchIcon } from '../components/ui/Icons';
import { SectionHeader, inputCls } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import LecturasLpr from '../components/LecturasLpr';

export default function VehiculosCapturados({
  capturasVehiculos,
  filtroCapturas,
  setFiltroCapturas,
  filtroTiempoVehiculos,
  setFiltroTiempoVehiculos,
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
      <LecturasLpr />
      <SectionHeader
        title="Vehículos Capturados"
        subtitle="Alertas vehiculares registradas"
      />
      
      <div className="backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row gap-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <input className={cx(inputCls('cyan'), 'flex-1')}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
          placeholder="Buscar por placa, tipo de vehículo o ID..."
          value={filtroCapturas} onChange={e => setFiltroCapturas(e.target.value)}
        />
        <select 
          className={cx(inputCls('blue'), 'w-full sm:w-48 cursor-pointer')}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
          value={filtroTiempoVehiculos} onChange={e => setFiltroTiempoVehiculos(e.target.value)}
        >
          <option value="TODO">Todo el historial</option>
          <option value="10MIN">Últimos 10 minutos</option>
          <option value="1HORA">Última hora</option>
          <option value="24HORAS">Últimas 24 horas</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {capturasVehiculos
          .filter(v => filterByTime(v.fecha_hora, filtroTiempoVehiculos))
          .filter(v => (v.placa || '').toLowerCase().includes(filtroCapturas.toLowerCase()) || (v.tipo_vehiculo || '').toLowerCase().includes(filtroCapturas.toLowerCase()) || String(v.id_vehiculo).includes(filtroCapturas))
          .map(v => (
          <div key={v.id_local || v.id_vehiculo} className="backdrop-blur-md rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>ID: {String(v.id_vehiculo).substring(0,8)}</p>
                <h4 className="text-sm font-black mt-0.5" style={{ color: 'var(--text-heading)' }}>{v.tipo_vehiculo || 'Desconocido'}</h4>
              </div>
              <Badge color={v.placa && v.placa !== "No detectada" ? 'cyan' : 'amber'}>
                {v.placa || 'No detectada'}
              </Badge>
            </div>
            
            <div className="flex gap-2 h-32 mt-2">
              <div className="flex-1 rounded-lg overflow-hidden relative" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-primary)' }}>
                <span className="absolute top-1 left-1 z-10 text-[8px] px-1 rounded" style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>Vehículo Capturado</span>
                {v.foto_vehiculo ? <img src={getImagenUrl(v.foto_vehiculo)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><CarIcon className="w-6 h-6" style={{ color: 'var(--text-muted)' }} /></div>}
              </div>
              <div className="w-24 flex-shrink-0 rounded-lg overflow-hidden relative" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-primary)' }}>
                <span className="absolute top-1 left-1 z-10 text-[8px] px-1 rounded" style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>Registrado</span>
                {v.foto_registrada ? <img src={getImagenUrl(v.foto_registrada)} className="w-full h-full object-contain" /> : <div className="w-full h-full flex flex-col items-center justify-center text-center p-1"><CarIcon className="w-4 h-4 mb-1" style={{ color: 'var(--text-muted)' }} /><span className="text-[7px]" style={{ color: 'var(--text-muted)' }}>Sin registro</span></div>}
              </div>
            </div>

            {v.nivel_confianza != null && (
              <div className="mt-2 mb-1 px-1">
                <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                  <span>Nivel de similitud</span>
                  <span className="font-bold">{parseFloat(v.nivel_confianza).toFixed(1)}%</span>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-deep)' }}>
                  <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, v.nivel_confianza))}%`, background: 'var(--accent-primary)' }}></div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              {v.foto_contexto && (
                <button onClick={() => setModalContexto(v.foto_contexto)} className="flex-1 flex items-center justify-center gap-2 text-[11px] font-bold py-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                  <SearchIcon className="w-3.5 h-3.5" /> Ver Contexto
                </button>
              )}
              <button onClick={() => handleNotify(v.id_vehiculo)} className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                <span>🔔 Notificar</span>
              </button>
            </div>
            
            <div className="flex items-center justify-between text-[10px] font-mono mt-1 pt-2" style={{ borderTop: '1px solid var(--border-secondary)', color: 'var(--text-tertiary)' }}>
              <span>📷 {v.ubicacion_camara}</span>
              <span>{fmtDate(v.fecha_hora)} {fmt(v.fecha_hora)}</span>
            </div>
          </div>
        ))}
        
        {capturasVehiculos.length === 0 && (
          <div className="col-span-full py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <CarIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
            No hay vehículos capturados aún.
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="backdrop-blur-xl rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-[var(--accent-amber)]/50" 
               style={{ background: 'var(--bg-overlay)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-amber-soft, rgba(245,158,11,0.2))', color: 'var(--accent-amber, #f59e0b)' }}>
              ✓
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: 'var(--accent-amber, #f59e0b)' }}>Registro notificado</p>
              <p className="text-[13px] font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{toastMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
