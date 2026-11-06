import React, { useState } from 'react';
import { cx } from '../utils/formatters';
import { CamIcon, RefreshIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { AI_WORKER_URL } from '../utils/constants';

export default function CamarasVivo({ camaras, workerOnline }) {
  const [fullscreenCam, setFullscreenCam] = useState(null);

  return (
    <div className="space-y-6 animate-fade-in relative z-10 pb-8">
      <SectionHeader
        title="Mosaico de Cámaras en Vivo"
        subtitle="Monitoreo táctico multicámara con inferencia continua de YOLOv8, ByteTrack, InsightFace y LPR"
        action={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
              {camaras.length} Nodos Activos
            </span>
          </div>
        }
      />

      {camaras.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border backdrop-blur-xl"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          }}
        >
          <EmptyState
            icon={CamIcon}
            message={workerOnline ? 'No hay cámaras registradas en la base de datos' : 'AI Worker sin conexión o iniciando...'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {camaras.map((cam, idx) => {
            const isAlt = idx % 2 === 1;
            const accentColor = isAlt ? '#f59e0b' : '#06b6d4';

            return (
              <div
                key={cam.id}
                className="rounded-2xl overflow-hidden border transition-all duration-300 group hover:shadow-2xl"
                style={{
                  background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
                  borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
                  boxShadow: `0 8px 30px rgba(0, 0, 0, 0.4)`
                }}
              >
                {/* ── Cabecera HUD de la Cámara ── */}
                <div
                  className="px-4 py-3 flex items-center justify-between border-b backdrop-blur-md"
                  style={{
                    background: 'rgba(6, 11, 20, 0.85)',
                    borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.08))'
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex items-center justify-center">
                      <span className="absolute rounded-full opacity-75 animate-ping w-2.5 h-2.5 bg-red-500" />
                      <span className="relative rounded-full w-2 h-2 bg-red-500" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      {cam.nombre}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      ID: {cam.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="hidden sm:inline px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      ● EN VIVO
                    </span>
                    <span className="font-bold text-slate-300">24 FPS</span>
                  </div>
                </div>

                {/* ── Ventana de Video con Overlay Táctico ── */}
                <div className="relative aspect-video bg-black overflow-hidden select-none">
                  <img
                    src={`${AI_WORKER_URL}/video_feed/${cam.id}`}
                    alt={cam.nombre}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />

                  {/* Estado Sin Señal (Fallback) */}
                  <div
                    className="absolute inset-0 hidden flex-col items-center justify-center p-6 text-center"
                    style={{ background: 'rgba(2, 5, 15, 0.95)' }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-2">
                      <CamIcon className="w-6 h-6 animate-pulse" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-200">
                      SIN SEÑAL RTSP / WEBCAM
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      Compruebe la URL RTSP en Registro de Cámaras
                    </p>
                  </div>

                  {/* Retículas tácticas en las 4 esquinas */}
                  <span className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400/70 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400/70 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400/70 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400/70 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Marca de agua táctica inferior */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/70 pointer-events-none drop-shadow">
                    <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur">
                      AI INFERENCE: ACTIVA
                    </span>
                    <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur">
                      H.264 • 1080p
                    </span>
                  </div>
                </div>

                {/* ── Pie de tarjeta con rol y parámetros ── */}
                <div
                  className="px-4 py-2.5 flex items-center justify-between text-xs font-mono"
                  style={{
                    background: 'var(--bg-deep, #050914)',
                    borderTop: '1px solid var(--border-secondary, rgba(255, 255, 255, 0.06))',
                    color: 'var(--text-tertiary, #64748b)'
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Rol Asistencia: <strong className="text-slate-300">{cam.rol_asistencia || 'General'}</strong></span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: accentColor }}>
                    Canal #{idx + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
