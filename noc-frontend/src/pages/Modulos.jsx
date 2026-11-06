import React, { useState, useEffect } from 'react';
import {
  LayersIcon,
  ClockIcon,
  MapPinIcon,
  RefreshIcon,
  ShieldIcon,
  PersonIcon,
  CarIcon
} from '../components/ui/Icons';
import { SectionHeader } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import { API_URL } from '../utils/constants';
import useAppStore from '../store/useAppStore';

const MODULO_META = {
  reconocimiento_facial: {
    icon: PersonIcon,
    color: '#06b6d4',
    badgeColor: 'cyan',
    tag: 'IA Visión — Biometría & Sujetos de Interés',
    gpu: 'VRAM: ~450MB (InsightFace ArcFace)',
    views: [
      { name: 'Sujetos de Interés', path: '/facial/sujetos' },
      { name: 'Personas Desaparecidas', path: '/facial/desaparecidos' },
      { name: 'Capturas en Vivo', path: '/facial/capturas' }
    ]
  },
  reconocimiento_placas: {
    icon: CarIcon,
    color: '#f59e0b',
    badgeColor: 'amber',
    tag: 'IA Visión — LPR & Lista Negra de Matrículas',
    gpu: 'CPU/GPU: YOLOv8 + EasyOCR',
    views: [
      { name: 'Lista Negra LPR / Matrículas', path: '/lpr/lista-negra' },
      { name: 'Vehículos Capturados', path: '/lpr/capturas' }
    ]
  },
  asistencia: {
    icon: ClockIcon,
    color: '#10b981',
    badgeColor: 'green',
    tag: 'Control Laboral & Turnos',
    gpu: 'Motor Facial Compartido (0MB VRAM extra)',
    views: [
      { name: 'Monitor en Vivo', path: '/asistencia/en-vivo' },
      { name: 'Jornadas y Marcaciones', path: '/asistencia/jornadas' },
      { name: 'Gestión de Empleados', path: '/asistencia/empleados' },
      { name: 'Métricas & Horas', path: '/asistencia/metricas' }
    ]
  },
  zonas_restringidas: {
    icon: MapPinIcon,
    color: '#ef4444',
    badgeColor: 'red',
    tag: 'Perímetro Táctico & Intrusiones',
    gpu: 'CPU Ultraligero (Ray-Casting Poligonal)',
    views: [
      { name: 'Editor de Zonas (Próx.)', path: '/zonas/editor' },
      { name: 'Historial de Intrusiones', path: '/zonas/intrusiones' }
    ]
  }
};

export default function Modulos({ askAlert, askConfirm }) {
  const { modulos, setModulos } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [configLocal, setConfigLocal] = useState({});

  useEffect(() => {
    cargarModulos();
  }, []);

  const cargarModulos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('centinel-token');
      const res = await fetch(`${API_URL}/api/modulos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setModulos(data);
        const cfg = {};
        data.forEach(m => { cfg[m.clave] = m.config || {}; });
        setConfigLocal(cfg);
      }
    } catch (err) {
      console.error('Error cargando módulos:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleModulo = async (modulo) => {
    const nuevoEstado = !modulo.activo;
    const accion = nuevoEstado ? 'ACTIVAR' : 'DESACTIVAR';
    
    const meta = MODULO_META[modulo.clave];
    const mensaje = nuevoEstado
      ? `Al activar '${modulo.nombre}', se habilitará en el Sidebar con todas sus vistas tácticas y el AI Worker comenzará a procesar esta analítica.`
      : `Al desactivar '${modulo.nombre}', el módulo desaparecerá del menú lateral y el AI Worker suspenderá su ejecución para liberar memoria y recursos de cómputo.`;

    if (askConfirm) {
      askConfirm(
        `${accion} Módulo: ${modulo.nombre}`,
        mensaje,
        async () => {
          await ejecutarUpdate(modulo.clave, { activo: nuevoEstado });
        }
      );
    } else {
      await ejecutarUpdate(modulo.clave, { activo: nuevoEstado });
    }
  };

  const ejecutarUpdate = async (clave, payload) => {
    try {
      setGuardando(clave);
      const token = localStorage.getItem('centinel-token');
      const res = await fetch(`${API_URL}/api/modulos/${clave}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar módulo');
      }

      const actualizado = await res.json();
      setModulos(modulos.map(m => m.clave === clave ? { ...m, ...actualizado } : m));
      if (askAlert) askAlert('Éxito', `Módulo '${actualizado.nombre}' actualizado correctamente.`);
    } catch (err) {
      if (askAlert) askAlert('Error', err.message);
    } finally {
      setGuardando(null);
    }
  };

  const guardarConfiguracion = (clave) => {
    const cfg = configLocal[clave] || {};
    ejecutarUpdate(clave, { config: cfg });
  };

  const updateConfigValue = (clave, campo, valor) => {
    setConfigLocal(prev => ({
      ...prev,
      [clave]: {
        ...(prev[clave] || {}),
        [campo]: valor
      }
    }));
  };

  const activosCount = modulos.filter(m => m.activo).length;

  return (
    <div className="space-y-6 animate-fade-in relative z-10 pb-12">
      <SectionHeader
        title="Gestión de Módulos de IA"
        subtitle="Activa o desactiva capacidades avanzadas de IA según tus requerimientos tácticos y optimiza la carga del servidor"
        action={
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border"
              style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              {activosCount} de {modulos.length} Módulos Activos
            </span>
            <button
              onClick={cargarModulos}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border hover:scale-105"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)'
              }}
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
          </div>
        }
      />

      {/* Grid de módulos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modulos.map(m => {
          const meta = MODULO_META[m.clave] || {
            icon: LayersIcon,
            color: '#06b6d4',
            badgeColor: 'cyan',
            tag: 'Módulo del Sistema',
            gpu: 'Cómputo Estándar',
            views: []
          };
          const Icon = meta.icon;
          const cfg = configLocal[m.clave] || m.config || {};
          const estaActivo = m.activo;
          const estaGuardando = guardando === m.clave;

          return (
            <div
              key={m.clave}
              className={`glass-panel p-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                estaActivo ? 'shadow-lg' : 'opacity-85'
              }`}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${estaActivo ? meta.color + '55' : 'var(--border-primary)'}`,
                boxShadow: estaActivo ? `0 4px 24px ${meta.color}15` : 'none'
              }}
            >
              {/* Barra superior con color representativo */}
              <div
                className="absolute top-0 left-0 right-0 h-1 transition-all"
                style={{
                  background: estaActivo ? meta.color : 'transparent'
                }}
              />

              <div>
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md transition-all"
                      style={{
                        background: estaActivo ? `${meta.color}20` : 'var(--bg-deep)',
                        border: `1px solid ${estaActivo ? meta.color : 'var(--border-primary)'}`,
                        color: estaActivo ? meta.color : 'var(--text-tertiary)'
                      }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black tracking-wide" style={{ color: 'var(--text-heading)' }}>
                          {m.nombre}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                          {meta.tag}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Interruptor Toggle */}
                  <div className="flex items-center gap-2">
                    <Badge color={estaActivo ? 'green' : 'slate'} dot={estaActivo}>
                      {estaActivo ? 'ACTIVO' : 'INACTIVO'}
                    </Badge>
                    <button
                      onClick={() => toggleModulo(m)}
                      disabled={estaGuardando}
                      aria-label={`Alternar ${m.nombre}`}
                      className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center relative ${
                        estaActivo ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                          estaActivo ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {m.descripcion || 'Módulo configurable de análisis inteligente CENTINEL.'}
                </p>

                {/* Impacto de Cómputo / Hardware */}
                <div className="mb-4 flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-mono"
                  style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-secondary)' }}>
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${estaActivo ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    Carga Hardware:
                  </span>
                  <span className="font-bold" style={{ color: estaActivo ? meta.color : 'var(--text-tertiary)' }}>
                    {meta.gpu}
                  </span>
                </div>

                {/* Vistas incluidas que se habilitan en Sidebar */}
                <div className="mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400">
                    Vistas y Herramientas del Módulo:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.views.map(v => (
                      <span
                        key={v.name}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                          estaActivo
                            ? 'bg-slate-800/80 text-slate-200 border-slate-700'
                            : 'bg-slate-900/40 text-slate-500 border-slate-800 line-through'
                        }`}
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Parámetros de configuración táctica */}
                <div className="p-4 rounded-xl space-y-4 mb-4" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-secondary)' }}>
                  <div className="text-[10px] font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                    <ShieldIcon className="w-3.5 h-3.5" /> Parámetros Tácticos de IA
                  </div>

                  {/* PARÁMETROS: RECONOCIMIENTO FACIAL */}
                  {m.clave === 'reconocimiento_facial' && (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Umbral de Similitud Facial:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0.40"
                            max="0.80"
                            step="0.05"
                            value={cfg.umbral_facial ?? 0.50}
                            onChange={e => updateConfigValue('reconocimiento_facial', 'umbral_facial', parseFloat(e.target.value))}
                            className="w-24 accent-cyan-500"
                          />
                          <span className="font-mono font-bold w-10 text-right" style={{ color: meta.color }}>
                            {(((cfg.umbral_facial ?? 0.50)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Cooldown entre Alertas (seg):</span>
                        <input
                          type="number"
                          min="5"
                          max="300"
                          value={cfg.cooldown_seg ?? 30}
                          onChange={e => updateConfigValue('reconocimiento_facial', 'cooldown_seg', parseInt(e.target.value, 10))}
                          className="w-16 px-2 py-1 rounded text-right font-mono"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Guardar capturas desconocidas:</span>
                        <input
                          type="checkbox"
                          checked={cfg.guardar_desconocidos ?? true}
                          onChange={e => updateConfigValue('reconocimiento_facial', 'guardar_desconocidos', e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* PARÁMETROS: RECONOCIMIENTO DE PLACAS */}
                  {m.clave === 'reconocimiento_placas' && (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Umbral Confianza OCR Placa:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0.40"
                            max="0.90"
                            step="0.05"
                            value={cfg.min_confianza_ocr ?? cfg.umbral_ocr ?? 0.65}
                            onChange={e => updateConfigValue('reconocimiento_placas', 'min_confianza_ocr', parseFloat(e.target.value))}
                            className="w-24 accent-amber-500"
                          />
                          <span className="font-mono font-bold w-10 text-right" style={{ color: meta.color }}>
                            {((cfg.min_confianza_ocr ?? cfg.umbral_ocr ?? 0.65) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Lecturas para confirmar placa:</span>
                        <input
                          type="number"
                          min="2"
                          max="15"
                          value={cfg.min_votos ?? cfg.confirmaciones_placa ?? cfg.confirmaciones ?? 3}
                          onChange={e => updateConfigValue('reconocimiento_placas', 'min_votos', Math.min(15, Math.max(2, parseInt(e.target.value, 10) || 3)))}
                          className="w-16 px-2 py-1 rounded text-right font-mono"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Cooldown entre Alertas LPR (seg):</span>
                        <input
                          type="number"
                          min="10"
                          max="300"
                          value={cfg.cooldown_seg ?? 30}
                          onChange={e => updateConfigValue('reconocimiento_placas', 'cooldown_seg', parseInt(e.target.value, 10))}
                          className="w-16 px-2 py-1 rounded text-right font-mono"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <details className="pt-2">
                        <summary className="cursor-pointer">Calidad y consenso del nuevo detector LPR (V2)</summary>
                        <p className="mt-2" style={{color:'var(--text-tertiary)'}}>Se aplican cuando el detector V2 esté instalado y activado en el worker.</p>
                        {[
                          ['min_ratio','Proporción mínima de consenso',0.65,0.5,1,0.05],
                          ['min_ancho_placa','Ancho mínimo de placa (px)',60,20,500,1],
                          ['min_nitidez','Nitidez mínima',60,0,1000,5],
                        ].map(([key,label,fallback,min,max,step])=><label key={key} className="flex items-center justify-between gap-3 mt-3">
                          <span>{label}</span><input type="number" min={min} max={max} step={step} value={cfg[key]??fallback}
                            onChange={e=>updateConfigValue('reconocimiento_placas',key,Math.max(min,Math.min(max,Number(e.target.value)||fallback)))}
                            className="w-20 px-2 py-1 rounded text-right font-mono" style={{background:'var(--bg-input)',color:'var(--text-primary)'}} />
                        </label>)}
                      </details>
                    </div>
                  )}

                  {/* PARÁMETROS: CONTROL DE ASISTENCIA */}
                  {m.clave === 'asistencia' && (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Umbral Facial de Marcación:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0.40"
                            max="0.80"
                            step="0.05"
                            value={cfg.umbral_facial ?? 0.50}
                            onChange={e => updateConfigValue('asistencia', 'umbral_facial', parseFloat(e.target.value))}
                            className="w-24 accent-emerald-500"
                          />
                          <span className="font-mono font-bold w-10 text-right" style={{ color: meta.color }}>
                            {(((cfg.umbral_facial ?? 0.50)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Confirmaciones Consecutivas:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={cfg.confirmaciones ?? 3}
                          onChange={e => updateConfigValue('asistencia', 'confirmaciones', parseInt(e.target.value, 10))}
                          className="w-16 px-2 py-1 rounded text-right font-mono"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Minutos Mínimos entre Marcas:</span>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={cfg.min_minutos_entre_marcas ?? 2}
                          onChange={e => updateConfigValue('asistencia', 'min_minutos_entre_marcas', parseInt(e.target.value, 10))}
                          className="w-16 px-2 py-1 rounded text-right font-mono"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Cierre Automático Diario:</span>
                        <input
                          type="time"
                          value={cfg.hora_cierre_automatico || '23:59'}
                          onChange={e => updateConfigValue('asistencia', 'hora_cierre_automatico', e.target.value)}
                          className="px-2 py-1 rounded text-right font-mono"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* PARÁMETROS: ZONAS RESTRINGIDAS */}
                  {m.clave === 'zonas_restringidas' && (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Permanencia mínima para alarma:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={cfg.segundos_permanencia ?? 3}
                            onChange={e => updateConfigValue('zonas_restringidas', 'segundos_permanencia', parseInt(e.target.value, 10))}
                            className="w-16 px-2 py-1 rounded text-right font-mono"
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                          />
                          <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>seg</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Cooldown entre alarmas:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="10"
                            max="600"
                            value={cfg.cooldown_seg ?? 60}
                            onChange={e => updateConfigValue('zonas_restringidas', 'cooldown_seg', parseInt(e.target.value, 10))}
                            className="w-16 px-2 py-1 rounded text-right font-mono"
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                          />
                          <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>seg</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Excluir empleados autorizados:</span>
                        <input
                          type="checkbox"
                          checked={Boolean(cfg.excluir_empleados)}
                          onChange={e => updateConfigValue('zonas_restringidas', 'excluir_empleados', e.target.checked)}
                          className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => guardarConfiguracion(m.clave)}
                      disabled={estaGuardando}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-white hover:scale-105 active:scale-95"
                      style={{
                        background: `linear-gradient(135deg, ${meta.color}, #0284c7)`,
                        boxShadow: `0 2px 10px ${meta.color}40`
                      }}
                    >
                      {estaGuardando ? 'Guardando...' : 'Aplicar Parámetros'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer con info de auditoría */}
              <div className="pt-3 border-t flex items-center justify-between text-[10px] font-mono" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-tertiary)' }}>
                <span>Actualizado: {m.actualizado_en ? new Date(m.actualizado_en).toLocaleString('es-BO') : 'Inicial'}</span>
                <span>Por: {m.actualizado_por_nombre || 'Sistema'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
