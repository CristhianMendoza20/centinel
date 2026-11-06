import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cx, getImagenUrl } from '../utils/formatters';
import {
  AlertIcon,
  PersonIcon,
  SearchIcon,
  CarIcon,
  ServerIcon,
  ChevronRightIcon,
  CamIcon,
  LayersIcon,
  ClockIcon
} from '../components/ui/Icons';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState, SectionHeader } from '../components/ui/LayoutShared';
import { API_URL } from '../utils/constants';
import useAppStore from '../store/useAppStore';

// Barra de progreso de telemetría táctica
const ProgressBar = ({ label, count, max, colorClass, barColor }) => {
  const percentage = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
  return (
    <div className="mb-4 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs font-semibold tracking-wide text-slate-300 group-hover:text-white transition-colors">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-500">({percentage}%)</span>
          <span className={cx('text-xs font-black font-mono', colorClass)}>{count}</span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden p-0.5" style={{ background: 'var(--bg-deep, #050914)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            background: barColor || 'var(--accent-cyan, #06b6d4)',
            boxShadow: `0 0 10px ${barColor || '#06b6d4'}60`
          }}
        />
      </div>
    </div>
  );
};

// Medidor circular de telemetría de hardware
const CircularGauge = ({ label, value, info, color }) => {
  const val = value != null ? Math.min(100, Math.max(0, value)) : 0;
  const strokeColor = val > 85 ? '#ef4444' : val > 65 ? '#f59e0b' : color;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (val / 100) * circumference;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border transition-all duration-300 hover:border-slate-600/60"
      style={{ background: 'var(--bg-deep, #050914)', borderColor: 'var(--border-secondary, rgba(255,255,255,0.06))' }}>
      <div className="min-w-0 pr-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
          {label}
        </span>
        <span className="text-xl font-black font-mono tracking-tight text-white block">
          {value != null ? `${value.toFixed(1)}%` : 'N/D'}
        </span>
        {info && (
          <span className="text-[10px] font-mono text-slate-500 truncate block mt-0.5 max-w-[190px]">
            {info}
          </span>
        )}
      </div>

      <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
        <svg className="w-14 h-14 -rotate-90">
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            className="text-slate-800"
            fill="none"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke={strokeColor}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            fill="none"
          />
        </svg>
        <span className="absolute text-[10px] font-bold font-mono text-slate-300">
          {Math.round(val)}%
        </span>
      </div>
    </div>
  );
};

export default function Dashboard({ alertas, camaras, workerOnline }) {
  const navigate = useNavigate();
  const { capturasPersonas, capturasVehiculos } = useAppStore();

  const [personasCount, setPersonasCount] = useState(0);
  const [desaparecidosCount, setDesaparecidosCount] = useState(0);
  const [vehiculosCount, setVehiculosCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Telemetría del servidor (CPU / RAM / GPU NVIDIA)
  const [hwStats, setHwStats] = useState({
    cpu: null,
    ram: null,
    gpu: null,
    gpuInfo: null,
    cpuInfo: null,
    ramInfo: null
  });

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const r = await fetch(`${API_URL}/api/sistema/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        if (!r.ok || !activo) return;
        const d = await r.json();
        setHwStats({
          cpu: d.cpu?.uso ?? null,
          ram: d.ram?.uso ?? null,
          gpu: d.gpu ? d.gpu.uso : null,
          cpuInfo: d.cpu ? `${d.cpu.nucleos} núcleos activos` : null,
          ramInfo: d.ram ? `${d.ram.usada_gb} / ${d.ram.total_gb} GB` : null,
          gpuInfo: d.gpu
            ? `${d.gpu.nombre} · ${d.gpu.vram_usada_mb}/${d.gpu.vram_total_mb} MB${d.gpu.temperatura != null ? ` · ${d.gpu.temperatura}°C` : ''}`
            : 'Acelerador NVIDIA no detectado',
        });
      } catch { /* mantener últimos valores */ }
    };
    cargar();
    const interval = setInterval(cargar, 3000);
    return () => { activo = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const token = localStorage.getItem('centinel-token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const [rP, rD, rV] = await Promise.all([
          fetch(`${API_URL}/api/personas`, { headers }),
          fetch(`${API_URL}/api/desaparecidos`, { headers }),
          fetch(`${API_URL}/api/vehiculos`, { headers }),
        ]);

        if (rP.ok) setPersonasCount((await rP.json()).length);
        if (rD.ok) setDesaparecidosCount((await rD.json()).length);
        if (rV.ok) setVehiculosCount((await rV.json()).length);

        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    };
    fetchCounts();
  }, []);

  // Estadísticas por cámara
  const statsPorCamara = camaras.map(cam => {
    const sospechosos = capturasPersonas.filter(c => c.ubicacion_camara === cam.nombre && (c.tipo === 'sospechoso' || c.tipo_alerta === 'SOSPECHOSO')).length;
    const desaparecidos = capturasPersonas.filter(c => c.ubicacion_camara === cam.nombre && (c.tipo === 'desaparecido' || c.tipo_alerta === 'DESAPARECIDO')).length;
    const autos = capturasVehiculos.filter(c => c.ubicacion_camara === cam.nombre).length;
    return { ...cam, sospechosos, desaparecidos, autos };
  });

  const maxSosp = Math.max(...statsPorCamara.map(s => s.sospechosos), 1);
  const maxDesap = Math.max(...statsPorCamara.map(s => s.desaparecidos), 1);
  const maxAutos = Math.max(...statsPorCamara.map(s => s.autos), 1);

  return (
    <div className="space-y-6 animate-fade-in relative z-10 pb-8">
      {/* ── Cabecera Táctica con Accesos Rápidos ── */}
      <SectionHeader
        title="Centro de Mando Operacional"
        subtitle="Monitor táctico en tiempo real con detección continua de amenazas y reconocimiento de IA"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/camaras-vivo')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border text-white shadow-lg hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                borderColor: '#38bdf8'
              }}
            >
              <CamIcon className="w-4 h-4" />
              <span>Ver Cámaras en Vivo</span>
            </button>
            <button
              onClick={() => navigate('/modulos')}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border text-slate-300 hover:text-white"
              style={{
                background: 'var(--bg-card, rgba(15, 23, 42, 0.6))',
                borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))'
              }}
            >
              <LayersIcon className="w-3.5 h-3.5" />
              <span>Módulos IA</span>
            </button>
          </div>
        }
      />

      {/* ── Grid Principal de Tarjetas KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          label="ALERTAS CRÍTICAS"
          value={loading ? '…' : alertas.length}
          color="red"
          Icon={AlertIcon}
          trend={alertas.length > 0 ? 'ACTIVO' : 'NORMAL'}
          details={['Intrusiones en tiempo real', 'Disparos acústicos habilitados']}
        />
        <StatCard
          label="SUJETOS DE INTERÉS"
          value={loading ? '…' : personasCount}
          color="cyan"
          Icon={PersonIcon}
          trend={`${personasCount} perfiles`}
          details={['InsightFace ArcFace activo', 'Búsqueda facial instantánea']}
        />
        <StatCard
          label="PERSONAS BUSCADAS"
          value={loading ? '…' : desaparecidosCount}
          color="blue"
          Icon={SearchIcon}
          trend="Prioridad Alta"
          details={['Coincidencia biométrica', 'Notificación automática']}
        />
        <StatCard
          label="VEHÍCULOS EN LISTA"
          value={loading ? '…' : vehiculosCount}
          color="amber"
          Icon={CarIcon}
          trend="LPR Activo"
          details={['Reconocimiento de matrículas', 'Doble verificación OCR']}
        />
      </div>

      {/* ── Fila Secundaria: Telemetría de Servidor y Analíticas de Cámaras ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">

        {/* Panel Telemetría Hardware */}
        <div
          className="rounded-2xl p-5 border flex flex-col justify-between backdrop-blur-xl transition-all"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div className="flex items-center justify-between pb-3.5 border-b"
            style={{ borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.08))' }}>
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-white">
              <ServerIcon className="w-4 h-4 text-cyan-400" />
              Telemetría del Servidor
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              OPTIMIZADO
            </span>
          </div>

          <div className="my-4 space-y-3">
            <CircularGauge
              label="Procesador (CPU)"
              value={hwStats.cpu}
              info={hwStats.cpuInfo}
              color="#0ea5e9"
            />
            <CircularGauge
              label="Memoria RAM"
              value={hwStats.ram}
              info={hwStats.ramInfo}
              color="#8b5cf6"
            />
            <CircularGauge
              label="Motor Gráfico (GPU)"
              value={hwStats.gpu}
              info={hwStats.gpuInfo}
              color="#10b981"
            />
          </div>

          <div className="pt-3 border-t text-[10px] font-mono text-slate-500 flex items-center justify-between"
            style={{ borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.06))' }}>
            <span>Frecuencia de muestreo: 3s</span>
            <span className="text-emerald-400 font-bold">Estado: Óptimo</span>
          </div>
        </div>

        {/* Panel Desglose Analítico por Cámara */}
        <div
          className="rounded-2xl p-5 border lg:col-span-2 flex flex-col backdrop-blur-xl"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div className="flex items-center justify-between pb-3.5 border-b mb-4"
            style={{ borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.08))' }}>
            <div className="flex items-center gap-2">
              <CamIcon className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Analíticas en Vivo por Nodo de Video
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {camaras.length} Cámaras Conectadas
            </span>
          </div>

          <div className="h-[320px] overflow-y-auto custom-scrollbar pr-2">
            {camaras.length === 0 ? (
              <EmptyState icon={CamIcon} message="No hay cámaras registradas en el sistema" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-1 border-b border-red-500/20 text-xs font-bold text-red-400 uppercase tracking-wider">
                    <PersonIcon className="w-3.5 h-3.5" /> Sospechosos
                  </div>
                  {statsPorCamara.sort((a, b) => b.sospechosos - a.sospechosos).map(cam => (
                    <ProgressBar
                      key={cam.id}
                      label={cam.nombre}
                      count={cam.sospechosos}
                      max={maxSosp}
                      colorClass="text-red-400"
                      barColor="#ef4444"
                    />
                  ))}

                  <div className="flex items-center gap-2 mt-6 mb-3 pb-1 border-b border-cyan-500/20 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <SearchIcon className="w-3.5 h-3.5" /> Desaparecidos
                  </div>
                  {statsPorCamara.sort((a, b) => b.desaparecidos - a.desaparecidos).map(cam => (
                    <ProgressBar
                      key={cam.id}
                      label={cam.nombre}
                      count={cam.desaparecidos}
                      max={maxDesap}
                      colorClass="text-cyan-400"
                      barColor="#06b6d4"
                    />
                  ))}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3 pb-1 border-b border-amber-500/20 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <CarIcon className="w-3.5 h-3.5" /> Vehículos LPR
                  </div>
                  {statsPorCamara.sort((a, b) => b.autos - a.autos).map(cam => (
                    <ProgressBar
                      key={cam.id}
                      label={cam.nombre}
                      count={cam.autos}
                      max={maxAutos}
                      colorClass="text-amber-400"
                      barColor="#f59e0b"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Últimas Alertas Tácticas ── */}
      <div
        className="rounded-2xl overflow-hidden border backdrop-blur-xl"
        style={{
          background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
          borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.08))' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Historial Reciente de Alertas Tácticas
            </span>
          </div>
          <button
            onClick={() => navigate('/alertas')}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 group"
          >
            <span>Ver Log Completo</span>
            <ChevronRightIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {alertas.length === 0 ? (
          <EmptyState icon={AlertIcon} message="Sin incidentes ni alertas registradas en este turno" />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-secondary, rgba(255, 255, 255, 0.06))' }}>
            {alertas.slice(0, 5).map((a) => {
              const isDesap = a.tipo_alerta === 'DESAPARECIDO';
              const isLPR = a.tipo_alerta === 'LPR';
              const badgeColor = isLPR ? 'amber' : isDesap ? 'cyan' : 'red';
              const badgeText = isLPR ? 'LPR' : isDesap ? 'Desaparecido' : 'Sospechoso';

              return (
                <div
                  key={a.id}
                  className="flex items-center gap-4 px-5 py-3.5 transition-all hover:bg-slate-800/40"
                >
                  {a.foto_captura && (
                    <img
                      src={getImagenUrl(a.foto_captura)}
                      alt="Captura"
                      className="w-11 h-11 rounded-xl object-cover shadow border border-slate-700/60 flex-shrink-0"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Badge color={badgeColor} dot>{badgeText}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {isLPR ? `Vehículo Placa: ${a.nombre}` : (a.nombre || 'Sujeto Desconocido')}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      {a.ubicacion_camara ? `Ubicación: ${a.ubicacion_camara}` : 'Cámara Central'}
                      {a.nivel_confianza ? ` · Confianza: ${a.nivel_confianza}%` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400 flex-shrink-0">
                    {new Date(a.fecha_hora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
