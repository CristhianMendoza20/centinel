import React, { useState } from 'react';
import { cx, fmt, fmtDate, getImagenUrl } from '../utils/formatters';
import { AlertIcon, CarIcon, ShieldIcon, SearchIcon, XIcon, DownloadIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';

export default function AlertasLog({ alertas = [] }) {
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [modalFoto, setModalFoto] = useState(null);

  const alertasFiltradas = alertas.filter(a => {
    const isDesap = a.tipo_alerta === 'DESAPARECIDO';
    const isLPR = a.tipo_alerta === 'LPR';
    const isSosp = !isDesap && !isLPR;

    if (filtroTipo === 'SOSPECHOSOS' && !isSosp) return false;
    if (filtroTipo === 'DESAPARECIDOS' && !isDesap) return false;
    if (filtroTipo === 'LPR' && !isLPR) return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const matchNombre = (a.nombre || '').toLowerCase().includes(q);
      const matchCam = (a.ubicacion_camara || '').toLowerCase().includes(q);
      const matchPlaca = (a.placa_detectada || '').toLowerCase().includes(q);
      if (!matchNombre && !matchCam && !matchPlaca) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in relative z-10 pb-8">
      <SectionHeader
        title="Registro Táctico de Incidentes y Alertas"
        subtitle="Bitácora cronológica con captura de evidencia biométrica y matrículas vehiculares"
        action={
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping inline-block" />
              {alertas.length} Eventos Totales
            </span>
          </div>
        }
      />

      {/* ── Barra de Búsqueda y Filtros Rápidos ── */}
      <div
        className="p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl"
        style={{
          background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
          borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Buscador */}
        <div className="relative w-full md:w-80">
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, placa o cámara..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-slate-500 text-white"
            style={{
              background: 'var(--bg-deep, #050914)',
              border: '1px solid var(--border-secondary, rgba(255, 255, 255, 0.08))'
            }}
          />
        </div>

        {/* Filtros por Categoría */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['TODOS', 'SOSPECHOSOS', 'DESAPARECIDOS', 'LPR'].map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={cx(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                filtroTipo === t
                  ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista de Eventos ── */}
      {alertasFiltradas.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border backdrop-blur-xl"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          }}
        >
          <EmptyState
            icon={AlertIcon}
            message={busqueda ? 'No se encontraron alertas con los términos de búsqueda' : 'Sin incidentes ni intrusiones registradas en este período'}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {alertasFiltradas.map((a) => {
            const isDesap = a.tipo_alerta === 'DESAPARECIDO';
            const isLPR = a.tipo_alerta === 'LPR';
            const alertColor = isLPR ? 'amber' : isDesap ? 'cyan' : 'red';
            const badgeText = isLPR ? 'Vehículo LPR' : isDesap ? 'Desaparecido' : 'Sospechoso';
            const accentBorder = isLPR ? 'rgba(245, 158, 11, 0.35)' : isDesap ? 'rgba(6, 182, 212, 0.35)' : 'rgba(239, 68, 68, 0.35)';

            return (
              <div
                key={a.id}
                className="rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 group"
                style={{
                  background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
                  borderColor: accentBorder,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
                }}
              >
                {/* Miniatura de Evidencia */}
                {a.foto_captura ? (
                  <button
                    onClick={() => setModalFoto(a)}
                    className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden shadow-md border relative group/btn cursor-pointer"
                    style={{ borderColor: accentBorder }}
                  >
                    <img
                      src={getImagenUrl(a.foto_captura)}
                      alt="Evidencia"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/btn:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/btn:opacity-100 flex items-center justify-center transition-opacity">
                      <SearchIcon className="w-5 h-5 text-white" />
                    </div>
                  </button>
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 border"
                    style={{
                      background: 'var(--bg-deep, #050914)',
                      borderColor: accentBorder,
                      color: isLPR ? '#f59e0b' : isDesap ? '#06b6d4' : '#ef4444'
                    }}
                  >
                    {isLPR ? <CarIcon className="w-7 h-7" /> : <ShieldIcon className="w-7 h-7" />}
                  </div>
                )}

                {/* Información Principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1">
                    <Badge color={alertColor} dot>{badgeText}</Badge>
                    <span className="text-base font-black text-white tracking-wide truncate">
                      {isLPR ? `Placa Matrícula: ${a.nombre}` : (a.nombre || 'Sujeto No Identificado')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1 text-slate-300">
                      📍 {a.ubicacion_camara || 'Cámara táctica'}
                    </span>
                    <span>
                      Confianza IA: <strong className="text-white">{parseFloat(a.nivel_confianza || 0).toFixed(1)}%</strong>
                    </span>
                    {isLPR && a.contacto_referencia && (
                      <span className="text-amber-400">
                        📞 Ref: {a.contacto_referencia}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fecha y Hora Táctica */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 text-xs font-mono flex-shrink-0">
                  <span className="font-black text-white sm:text-sm">
                    {fmt(a.fecha_hora)}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {fmtDate(a.fecha_hora)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de Evidencia en Alta Resolución ── */}
      {modalFoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setModalFoto(null)}
          />
          <div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden border z-10 shadow-2xl animate-fade-in"
            style={{
              background: 'var(--bg-card, #0b1221)',
              borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.8))'
            }}
          >
            <div className="p-4 border-b flex items-center justify-between border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Evidencia Táctica Capturada: {modalFoto.nombre}
                </h3>
              </div>
              <button
                onClick={() => setModalFoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center max-h-[70vh]">
              <img
                src={getImagenUrl(modalFoto.foto_captura)}
                alt="Evidencia detallada"
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Cámara: {modalFoto.ubicacion_camara || 'N/D'}</span>
              <span>Hora: {new Date(modalFoto.fecha_hora).toLocaleString('es-BO')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
