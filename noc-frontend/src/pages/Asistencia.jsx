import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_URL } from '../utils/constants';
import { cx, getImagenUrl } from '../utils/formatters';
import {
  ClockIcon, PersonIcon, PlusIcon, PencilIcon, TrashIcon,
  DownloadIcon, RefreshIcon, CheckIcon, XIcon, AlertIcon,
  SearchIcon, CheckCircleIcon, MapPinIcon
} from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import Modal, { ModalHeader, ModalBody, ModalFooter, FormInput } from '../components/ui/Modal';
import FotoUploader from '../components/FotoUploader';
import useAppStore from '../store/useAppStore';

// ══════════════════════════════════════════════════════════════
// COMPONENTE: CRONÓMETRO DE TIEMPO TRANSCURRIDO EN VIVO
// ══════════════════════════════════════════════════════════════
function Cronometro({ inicio }) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!inicio) return;
    const calc = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - new Date(inicio).getTime()) / 1000));
      const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSec % 60).padStart(2, '0');
      setElapsed(`${hrs}:${mins}:${secs}`);
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [inicio]);

  return (
    <span className="font-mono font-bold tracking-wider text-emerald-400">
      {elapsed}
    </span>
  );
}

function formatDuracion(segundos) {
  if (!segundos && segundos !== 0) return '—';
  const hrs = Math.floor(segundos / 3600);
  const mins = Math.floor((segundos % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

function formatHora(fechaIso) {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatFecha(fechaIso) {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso);
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL: CONTROL DE ASISTENCIA
// ══════════════════════════════════════════════════════════════
export default function Asistencia({ askConfirm, askAlert }) {
  const { user } = useAppStore();
  const isAdmin = user?.rol_nombre === 'admin';
  const location = useLocation();
  const navigate = useNavigate();

  // Determinar tab según la URL actual
  const getTabFromUrl = () => {
    if (location.pathname.includes('/jornadas')) return 'jornadas';
    if (location.pathname.includes('/empleados')) return 'empleados';
    if (location.pathname.includes('/metricas')) return 'metricas';
    return 'presentes';
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tabActual = getTabFromUrl();
    if (tabActual !== activeTab) {
      setActiveTab(tabActual);
    }
  }, [location.pathname]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    const ruta = tabId === 'presentes' ? '/asistencia/en-vivo'
      : tabId === 'jornadas' ? '/asistencia/jornadas'
      : tabId === 'empleados' ? '/asistencia/empleados'
      : '/asistencia/metricas';
    navigate(ruta);
  };

  // Datos
  const [presentes, setPresentes] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [totalJornadas, setTotalJornadas] = useState(0);
  const [empleados, setEmpleados] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [metricas, setMetricas] = useState(null);

  // Filtros
  const [filtroUnidad, setFiltroUnidad] = useState('');
  const [filtroBusquedaEmp, setFiltroBusquedaEmp] = useState('');
  const [filtroRangoFecha, setFiltroRangoFecha] = useState('hoy'); // 'hoy' | 'semana' | 'mes' | 'custom'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroCierre, setFiltroCierre] = useState('');
  const [filtroEstadoJornada, setFiltroEstadoJornada] = useState('');

  // Modales
  const [modalEmpleado, setModalEmpleado] = useState(null); // null | 'nuevo' | empleadoObj
  const [modalManual, setModalManual] = useState(null); // null | { accion: 'crear' | 'cerrar' | 'editar', ... }
  const [modalUnidades, setModalUnidades] = useState(false);
  const [modalFoto, setModalFoto] = useState(null); // null | { url, titulo }

  // Estados de formularios
  const [formEmp, setFormEmp] = useState({
    nombre: '', ci: '', cargo: '', unidad_id: '',
    horario_entrada: '08:30', horario_salida: '17:30',
    foto: null, consentimiento_biometrico: true, activo: true
  });
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [nuevaUnidad, setNuevaUnidad] = useState({ nombre: '', direccion: '' });

  // ── CARGAS DE DATOS ───────────────────────────────────────────
  const fetchPresentes = useCallback(async () => {
    try {
      const url = new URL(`${API_URL}/api/asistencia/presentes`);
      if (filtroUnidad) url.searchParams.append('unidad_id', filtroUnidad);
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPresentes(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error cargando presentes:', e);
    }
  }, [filtroUnidad]);

  const fetchJornadas = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL(`${API_URL}/api/asistencia/jornadas`);
      if (filtroUnidad) url.searchParams.append('unidad_id', filtroUnidad);
      if (filtroCierre) url.searchParams.append('cierre', filtroCierre);
      if (filtroEstadoJornada) url.searchParams.append('estado', filtroEstadoJornada);

      // Rango de fechas
      const hoyStr = new Date().toISOString().split('T')[0];
      if (filtroRangoFecha === 'hoy') {
        url.searchParams.append('desde', hoyStr);
      } else if (filtroRangoFecha === 'semana') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        url.searchParams.append('desde', d.toISOString().split('T')[0]);
      } else if (filtroRangoFecha === 'mes') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        url.searchParams.append('desde', d.toISOString().split('T')[0]);
      } else if (filtroRangoFecha === 'custom') {
        if (fechaDesde) url.searchParams.append('desde', fechaDesde);
        if (fechaHasta) url.searchParams.append('hasta', fechaHasta);
      }

      url.searchParams.append('limit', '100');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJornadas(data.jornadas || []);
        setTotalJornadas(data.total || 0);
      }
    } catch (e) {
      console.error('Error cargando jornadas:', e);
    } finally {
      setLoading(false);
    }
  }, [filtroUnidad, filtroCierre, filtroEstadoJornada, filtroRangoFecha, fechaDesde, fechaHasta]);

  const fetchEmpleados = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/empleados`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmpleados(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error cargando empleados:', e);
    }
  }, []);

  const fetchUnidades = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/unidades`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnidades(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error cargando unidades:', e);
    }
  }, []);

  const fetchMetricas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/asistencia/resumen`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetricas(data);
      }
    } catch (e) {
      console.error('Error cargando métricas:', e);
    }
  }, []);

  // Cargar según pestaña activa
  useEffect(() => {
    fetchUnidades();
    if (activeTab === 'presentes') {
      fetchPresentes();
    } else if (activeTab === 'jornadas') {
      fetchJornadas();
    } else if (activeTab === 'empleados') {
      fetchEmpleados();
    } else if (activeTab === 'metricas') {
      fetchMetricas();
    }
  }, [activeTab, fetchPresentes, fetchJornadas, fetchEmpleados, fetchUnidades, fetchMetricas]);

  // Escuchar eventos en tiempo real vía WebSocket
  useEffect(() => {
    const handleWsEvent = (event) => {
      const msg = event.detail;
      if (msg && msg.type === 'ASISTENCIA_MARCA') {
        fetchPresentes();
        if (activeTab === 'jornadas') fetchJornadas();
        if (activeTab === 'metricas') fetchMetricas();
      }
    };
    window.addEventListener('centinel-ws-message', handleWsEvent);
    return () => window.removeEventListener('centinel-ws-message', handleWsEvent);
  }, [fetchPresentes, fetchJornadas, fetchMetricas, activeTab]);

  // ── GESTIÓN DE EMPLEADOS ──────────────────────────────────────
  const handleAbrirNuevoEmpleado = () => {
    setFormEmp({
      nombre: '', ci: '', cargo: '', unidad_id: '',
      horario_entrada: '08:30', horario_salida: '17:30',
      foto: null, consentimiento_biometrico: true, activo: true
    });
    setFotoPreview(null);
    setModalEmpleado('nuevo');
  };

  const handleEditarEmpleado = (emp) => {
    setFormEmp({
      nombre: emp.nombre || '',
      ci: emp.ci || '',
      cargo: emp.cargo || '',
      unidad_id: emp.unidad_id || '',
      horario_entrada: emp.horario_entrada ? emp.horario_entrada.substring(0, 5) : '08:30',
      horario_salida: emp.horario_salida ? emp.horario_salida.substring(0, 5) : '17:30',
      foto: null,
      consentimiento_biometrico: emp.consentimiento_biometrico !== false,
      activo: emp.activo !== false
    });
    setFotoPreview(emp.foto_url ? getImagenUrl(emp.foto_url) : null);
    setModalEmpleado(emp);
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result);
        setFormEmp(prev => ({ ...prev, foto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGuardarEmpleado = async (e) => {
    e.preventDefault();
    if (!formEmp.nombre.trim()) return;

    try {
      const esEdicion = typeof modalEmpleado === 'object' && modalEmpleado?.id;
      const url = esEdicion ? `${API_URL}/api/empleados/${modalEmpleado.id}` : `${API_URL}/api/empleados`;
      const method = esEdicion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('centinel-token')}`
        },
        body: JSON.stringify(formEmp)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al guardar empleado');
      }

      setModalEmpleado(null);
      fetchEmpleados();
      if (askAlert) askAlert('Éxito', `Empleado ${esEdicion ? 'actualizado' : 'registrado'} correctamente.`);
    } catch (err) {
      if (askAlert) askAlert('Error al guardar', err.message);
    }
  };

  const handleEliminarEmpleado = (emp) => {
    if (!askConfirm) return;
    askConfirm('Dar de baja empleado', `¿Deseas dar de baja a ${emp.nombre}? Sus registros históricos se conservarán pero no podrá marcar asistencia.`, async () => {
      try {
        const res = await fetch(`${API_URL}/api/empleados/${emp.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        if (!res.ok) throw new Error('Error al dar de baja');
        fetchEmpleados();
        if (askAlert) askAlert('Baja confirmada', `${emp.nombre} ha sido dado de baja.`);
      } catch (err) {
        if (askAlert) askAlert('Error', err.message);
      }
    });
  };

  // ── MARCAR SALIDA MANUAL ──────────────────────────────────────
  const handleCerrarJornadaManual = (jornada) => {
    if (!askConfirm) return;
    askConfirm(
      'Marcar Salida Manual',
      `¿Cerrar turno de ${jornada.empleado_nombre} con hora actual?`,
      async () => {
        try {
          const res = await fetch(`${API_URL}/api/asistencia/manual`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('centinel-token')}`
            },
            body: JSON.stringify({
              accion: 'cerrar_jornada',
              jornada_id: jornada.jornada_id || jornada.id,
              observacion: 'Cierre manual por administrador'
            })
          });
          if (!res.ok) throw new Error('Error al registrar salida');
          fetchPresentes();
          if (activeTab === 'jornadas') fetchJornadas();
          if (askAlert) askAlert('Salida Registrada', `Se registró la salida de ${jornada.empleado_nombre}`);
        } catch (err) {
          if (askAlert) askAlert('Error', err.message);
        }
      }
    );
  };

  // ── EXPORTAR CSV ──────────────────────────────────────────────
  const handleExportarCSV = () => {
    const url = new URL(`${API_URL}/api/asistencia/csv`);
    if (filtroUnidad) url.searchParams.append('unidad_id', filtroUnidad);
    if (filtroRangoFecha === 'hoy') {
      url.searchParams.append('desde', new Date().toISOString().split('T')[0]);
    } else if (filtroRangoFecha === 'semana') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      url.searchParams.append('desde', d.toISOString().split('T')[0]);
    } else if (filtroRangoFecha === 'mes') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      url.searchParams.append('desde', d.toISOString().split('T')[0]);
    } else if (filtroRangoFecha === 'custom') {
      if (fechaDesde) url.searchParams.append('desde', fechaDesde);
      if (fechaHasta) url.searchParams.append('hasta', fechaHasta);
    }

    // Descarga directa con token en header usando fetch
    fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `asistencia_centinel_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => {
        if (askAlert) askAlert('Error al exportar', err.message);
      });
  };

  // ── GESTIÓN DE UNIDADES ───────────────────────────────────────
  const handleCrearUnidad = async (e) => {
    e.preventDefault();
    if (!nuevaUnidad.nombre.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/unidades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('centinel-token')}`
        },
        body: JSON.stringify(nuevaUnidad)
      });
      if (!res.ok) throw new Error('Error al crear unidad');
      setNuevaUnidad({ nombre: '', direccion: '' });
      fetchUnidades();
    } catch (err) {
      if (askAlert) askAlert('Error', err.message);
    }
  };

  const handleEliminarUnidad = (u) => {
    if (!askConfirm) return;
    askConfirm('Eliminar Unidad', `¿Eliminar la unidad ${u.nombre}?`, async () => {
      try {
        const res = await fetch(`${API_URL}/api/unidades/${u.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        if (!res.ok) throw new Error('Error al eliminar unidad');
        fetchUnidades();
      } catch (err) {
        if (askAlert) askAlert('Error', err.message);
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── HEADER SUPERIOR ───────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(16,185,129,0.2))',
                border: '1px solid rgba(0,200,255,0.4)',
                boxShadow: '0 0 20px rgba(0,200,255,0.2)'
              }}>
              <ClockIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-black tracking-tight" style={{ color: 'var(--text-heading)' }}>
                Control de Asistencia de Personal
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Reconocimiento facial biométrico, cronómetro de estancia y control de jornadas
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setModalUnidades(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-secondary)',
                color: 'var(--text-secondary)'
              }}>
              <MapPinIcon className="w-3.5 h-3.5 text-cyan-400" />
              Unidades / Sedes
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleAbrirNuevoEmpleado}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--accent-cyan), #0080ff)',
                boxShadow: '0 4px 15px rgba(0, 200, 255, 0.25)'
              }}>
              <PlusIcon className="w-4 h-4" />
              Nuevo Empleado
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === 'presentes') fetchPresentes();
              else if (activeTab === 'jornadas') fetchJornadas();
              else if (activeTab === 'empleados') fetchEmpleados();
              else if (activeTab === 'metricas') fetchMetricas();
            }}
            className="p-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-secondary)',
              color: 'var(--accent-cyan)'
            }}
            title="Refrescar">
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── SELECTOR DE PESTAÑAS ──────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b overflow-x-auto pb-1" style={{ borderColor: 'var(--border-primary)' }}>
        {[
          { id: 'presentes', label: '⏱️ En Vivo / Presentes', count: presentes.length },
          { id: 'jornadas', label: '📋 Historial de Jornadas', count: totalJornadas },
          { id: 'empleados', label: '👥 Directorio de Empleados', count: empleados.length },
          { id: 'metricas', label: '📊 Métricas & Puntualidad' }
        ].map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cx(
                'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap',
                active ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'
              )}>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cx(
                  'text-[10px] px-2 py-0.5 rounded-full font-black',
                  active ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PESTAÑA 1: EN VIVO / PRESENTES (CRONÓMETRO)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'presentes' && (
        <div className="space-y-4">
          {/* Barra de control y conteo */}
          <div className="backdrop-blur-md rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-xs font-black text-emerald-400">
                  {presentes.length} {presentes.length === 1 ? 'EMPLEADO PRESENTE' : 'EMPLEADOS PRESENTES'}
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Permanencia activa en las instalaciones
              </span>
            </div>

            {/* Filtro de Unidad */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-400">Sede / Unidad:</label>
              <select
                value={filtroUnidad}
                onChange={e => setFiltroUnidad(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}>
                <option value="">Todas las Unidades</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid de presentes con cronómetros activos */}
          {presentes.length === 0 ? (
            <div className="backdrop-blur-md rounded-2xl p-12 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
                <ClockIcon className="w-7 h-7 text-cyan-400 opacity-60" />
              </div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                No hay empleados dentro del establecimiento
              </h3>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--text-tertiary)' }}>
                Cuando las cámaras con rol de entrada reconozcan a los empleados mediante biometría facial, aparecerán aquí con su cronómetro en vivo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {presentes.map(p => (
                <div
                  key={p.jornada_id}
                  className="backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] group relative"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                  }}>
                  {/* Borde sutil superior verde para denotar presencia activa */}
                  <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-cyan-500" />

                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Avatar / Foto */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative border border-cyan-500/30 bg-slate-800">
                        {p.empleado_foto ? (
                          <img
                            src={getImagenUrl(p.empleado_foto)}
                            alt={p.empleado_nombre}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-black text-cyan-400">
                            {p.empleado_nombre ? p.empleado_nombre.charAt(0).toUpperCase() : 'E'}
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                      </div>

                      {/* Datos empleado */}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate text-white">
                          {p.empleado_nombre}
                        </div>
                        <div className="text-[11px] font-mono text-cyan-400">
                          CI: {p.empleado_ci || 'S/N'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.empleado_cargo || 'Personal'}
                        </div>
                      </div>
                    </div>

                    {/* Metadatos de ingreso */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Ingreso</div>
                        <div className="font-mono text-slate-200 font-semibold">{formatHora(p.entrada)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Cámara</div>
                        <div className="font-semibold text-cyan-400 truncate">{p.camara_entrada_nombre || 'Principal'}</div>
                      </div>
                      {p.unidad_nombre && (
                        <div className="col-span-2">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Unidad / Sucursal</div>
                          <div className="text-slate-300 truncate">{p.unidad_nombre}</div>
                        </div>
                      )}
                    </div>

                    {/* Cronómetro en vivo */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-400">Tiempo en sitio:</span>
                      </div>
                      <div className="text-base">
                        <Cronometro inicio={p.entrada} />
                      </div>
                    </div>

                    {/* Acción para marcar salida manual */}
                    {isAdmin && (
                      <button
                        onClick={() => handleCerrarJornadaManual(p)}
                        className="w-full py-2 rounded-xl text-xs font-bold transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2 text-orange-400 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20">
                        <CheckCircleIcon className="w-4 h-4" />
                        Marcar Salida Manual
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PESTAÑA 2: HISTORIAL DE JORNADAS
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'jornadas' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="backdrop-blur-md rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Rango Rápido */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
                  {['hoy', 'semana', 'mes', 'custom'].map(r => (
                    <button
                      key={r}
                      onClick={() => setFiltroRangoFecha(r)}
                      className={cx(
                        'px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all',
                        filtroRangoFecha === r ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                      )}>
                      {r === 'hoy' ? 'Hoy' : r === 'semana' ? '7 Días' : r === 'mes' ? '30 Días' : 'Personalizado'}
                    </button>
                  ))}
                </div>

                {filtroRangoFecha === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={fechaDesde}
                      onChange={e => setFechaDesde(e.target.value)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white"
                    />
                    <span className="text-xs text-slate-400">a</span>
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={e => setFechaHasta(e.target.value)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                )}
              </div>

              {/* Botón Exportar CSV */}
              <button
                onClick={handleExportarCSV}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)'
                }}>
                <DownloadIcon className="w-4 h-4" />
                Descargar Reporte CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              {/* Filtro Unidad */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Unidad</label>
                <select
                  value={filtroUnidad}
                  onChange={e => setFiltroUnidad(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white">
                  <option value="">Todas las Unidades</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Estado */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Estado</label>
                <select
                  value={filtroEstadoJornada}
                  onChange={e => setFiltroEstadoJornada(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white">
                  <option value="">Todos los Estados</option>
                  <option value="abierta">🟢 En Curso (Presente)</option>
                  <option value="cerrada">🏁 Jornadas Completadas</option>
                </select>
              </div>

              {/* Filtro Tipo de Cierre */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Tipo de Cierre</label>
                <select
                  value={filtroCierre}
                  onChange={e => setFiltroCierre(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white">
                  <option value="">Todos los Cierres</option>
                  <option value="normal">✓ Normal (Reconocimiento Facial)</option>
                  <option value="automatico">⚙️ Automático (Fin de Turno)</option>
                  <option value="manual">✍️ Ajuste Manual Administrador</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabla de Historial */}
          <div className="backdrop-blur-md rounded-2xl overflow-hidden border border-slate-800"
            style={{ background: 'var(--bg-card)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 px-4">Empleado</th>
                    <th className="py-3 px-4">Unidad</th>
                    <th className="py-3 px-4">Entrada</th>
                    <th className="py-3 px-4">Salida</th>
                    <th className="py-3 px-4">Duración</th>
                    <th className="py-3 px-4">Modo Cierre</th>
                    <th className="py-3 px-4 text-center">Capturas IA</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {jornadas.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-400">
                        No se encontraron registros de jornadas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    jornadas.map(j => (
                      <tr key={j.id} className="hover:bg-slate-850 transition-colors">
                        {/* Empleado */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{j.empleado_nombre}</div>
                          <div className="text-[10px] font-mono text-cyan-400">CI: {j.empleado_ci || 'S/N'}</div>
                        </td>

                        {/* Unidad */}
                        <td className="py-3 px-4 text-slate-300">
                          {j.unidad_nombre || '—'}
                        </td>

                        {/* Entrada */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{formatHora(j.entrada)}</div>
                          <div className="text-[10px] text-slate-400">{formatFecha(j.entrada)}</div>
                          <div className="text-[9px] text-cyan-500/80 truncate max-w-[120px]">{j.camara_entrada_nombre}</div>
                        </td>

                        {/* Salida */}
                        <td className="py-3 px-4">
                          {j.salida ? (
                            <>
                              <div className="font-semibold text-white">{formatHora(j.salida)}</div>
                              <div className="text-[10px] text-slate-400">{formatFecha(j.salida)}</div>
                              <div className="text-[9px] text-cyan-500/80 truncate max-w-[120px]">{j.camara_salida_nombre}</div>
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              EN CURSO
                            </span>
                          )}
                        </td>

                        {/* Duración */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {j.salida ? formatDuracion(j.duracion_segundos) : <Cronometro inicio={j.entrada} />}
                        </td>

                        {/* Modo Cierre */}
                        <td className="py-3 px-4">
                          <span className={cx(
                            'text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block',
                            j.cierre === 'normal' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            j.cierre === 'automatico' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                            'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                          )}>
                            {j.cierre === 'normal' ? '✓ Normal' : j.cierre === 'automatico' ? '⚙️ Automático' : '✍️ Manual'}
                          </span>
                        </td>

                        {/* Fotos de Captura IA */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {j.foto_entrada_url ? (
                              <button
                                onClick={() => setModalFoto({ url: getImagenUrl(j.foto_entrada_url), titulo: `Ingreso: ${j.empleado_nombre}` })}
                                className="w-7 h-7 rounded-lg overflow-hidden border border-emerald-500/50 hover:scale-110 transition-transform"
                                title="Ver captura facial de entrada">
                                <img src={getImagenUrl(j.foto_entrada_url)} alt="Entrada" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] text-slate-500">In</div>
                            )}

                            {j.foto_salida_url ? (
                              <button
                                onClick={() => setModalFoto({ url: getImagenUrl(j.foto_salida_url), titulo: `Egreso: ${j.empleado_nombre}` })}
                                className="w-7 h-7 rounded-lg overflow-hidden border border-orange-500/50 hover:scale-110 transition-transform"
                                title="Ver captura facial de salida">
                                <img src={getImagenUrl(j.foto_salida_url)} alt="Salida" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] text-slate-500">Out</div>
                            )}
                          </div>
                        </td>

                        {/* Acción rápida */}
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            {!j.salida && (
                              <button
                                onClick={() => handleCerrarJornadaManual(j)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20">
                                Cerrar Turno
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PESTAÑA 3: DIRECTORIO DE EMPLEADOS
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'empleados' && (
        <div className="space-y-4">
          {/* Barra de Búsqueda y Filtros */}
          <div className="backdrop-blur-md rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="relative flex-1 min-w-[240px]">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar empleado por nombre o CI..."
                value={filtroBusquedaEmp}
                onChange={e => setFiltroBusquedaEmp(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-900/60 border border-slate-700 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Unidad:</label>
              <select
                value={filtroUnidad}
                onChange={e => setFiltroUnidad(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-white outline-none">
                <option value="">Todas</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid de Empleados */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {empleados
              .filter(e => {
                if (filtroUnidad && String(e.unidad_id) !== String(filtroUnidad)) return false;
                if (filtroBusquedaEmp) {
                  const b = filtroBusquedaEmp.toLowerCase();
                  return (e.nombre && e.nombre.toLowerCase().includes(b)) || (e.ci && e.ci.toLowerCase().includes(b));
                }
                return true;
              })
              .map(emp => (
                <div
                  key={emp.id}
                  className="backdrop-blur-md rounded-2xl overflow-hidden p-4 space-y-3 transition-all duration-300 hover:scale-[1.01] relative"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                  }}>
                  <div className="flex items-start gap-3">
                    {/* Foto */}
                    <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border border-cyan-500/30 bg-slate-800 relative">
                      {emp.foto_url ? (
                        <img
                          src={getImagenUrl(emp.foto_url)}
                          alt={emp.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-black text-cyan-400 text-lg">
                          {emp.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Datos */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white truncate">{emp.nombre}</h4>
                        <span className={cx(
                          'text-[9px] font-black uppercase px-2 py-0.5 rounded-full',
                          emp.activo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        )}>
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-cyan-400">CI: {emp.ci || '—'}</div>
                      <div className="text-[11px] text-slate-400">{emp.cargo || 'Sin cargo'}</div>
                    </div>
                  </div>

                  {/* Horario y Unidad */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <div className="text-slate-500 uppercase font-bold text-[9px]">Horario Entrada</div>
                      <div className="font-mono text-slate-200">{emp.horario_entrada ? emp.horario_entrada.substring(0, 5) : '08:30'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase font-bold text-[9px]">Horario Salida</div>
                      <div className="font-mono text-slate-200">{emp.horario_salida ? emp.horario_salida.substring(0, 5) : '17:30'}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-slate-500 uppercase font-bold text-[9px]">Sede / Unidad</div>
                      <div className="text-cyan-400 font-semibold truncate">{emp.unidad_nombre || 'Sin Asignar'}</div>
                    </div>
                  </div>

                  {/* Consentimiento Biométrico */}
                  <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400">Consentimiento Biométrico:</span>
                    <span className={emp.consentimiento_biometrico ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {emp.consentimiento_biometrico ? '✓ Concedido' : '✗ Denegado'}
                    </span>
                  </div>

                  {/* Acciones */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleEditarEmpleado(emp)}
                        className="flex-1 py-1.5 rounded-xl text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 flex items-center justify-center gap-1.5">
                        <PencilIcon className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => handleEliminarEmpleado(emp)}
                        className="flex-1 py-1.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 flex items-center justify-center gap-1.5">
                        <TrashIcon className="w-3.5 h-3.5" /> Dar de Baja
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PESTAÑA 4: MÉTRICAS Y PUNTUALIDAD
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'metricas' && metricas && (
        <div className="space-y-6">
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Presentes Ahora', val: metricas.presentes_ahora, color: 'text-emerald-400', bg: 'rgba(16, 185, 129, 0.1)' },
              { label: 'Empleados Activos', val: metricas.empleados_activos, color: 'text-cyan-400', bg: 'rgba(0, 200, 255, 0.1)' },
              { label: 'Entradas Hoy', val: metricas.entradas_hoy, color: 'text-blue-400', bg: 'rgba(59, 130, 246, 0.1)' },
              { label: 'Salidas Hoy', val: metricas.salidas_hoy, color: 'text-purple-400', bg: 'rgba(168, 85, 247, 0.1)' },
              { label: 'Tardanzas Hoy', val: metricas.tardanzas_hoy, color: 'text-orange-400', bg: 'rgba(249, 115, 22, 0.1)' }
            ].map((kpi, idx) => (
              <div
                key={idx}
                className="backdrop-blur-md rounded-2xl p-4 border border-slate-800 space-y-1"
                style={{ background: 'var(--bg-card)' }}>
                <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">{kpi.label}</div>
                <div className={cx('text-2xl lg:text-3xl font-black', kpi.color)}>{kpi.val}</div>
              </div>
            ))}
          </div>

          {/* Tabla de Ranking y Horas Últimos 30 Días */}
          <div className="backdrop-blur-md rounded-2xl overflow-hidden border border-slate-800"
            style={{ background: 'var(--bg-card)' }}>
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Resumen de Asistencia de Personal (Últimos 30 Días)</h3>
              <p className="text-xs text-slate-400">Total de horas computadas y registro de puntualidad</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 px-4">Empleado</th>
                    <th className="py-3 px-4">Cargo</th>
                    <th className="py-3 px-4 text-center">Jornadas</th>
                    <th className="py-3 px-4 text-center">Horas Acumuladas</th>
                    <th className="py-3 px-4 text-center">Tardanzas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {metricas.ranking_empleados?.map(r => (
                    <tr key={r.id} className="hover:bg-slate-850 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        {r.nombre}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{r.cargo || '—'}</td>
                      <td className="py-3 px-4 text-center font-mono text-cyan-400 font-bold">{r.total_jornadas}</td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-400 font-bold">{r.total_horas} hrs</td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className={cx(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold',
                          parseInt(r.tardanzas) > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'
                        )}>
                          {r.tardanzas}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: NUEVO / EDITAR EMPLEADO
          ══════════════════════════════════════════════════════════════ */}
      <Modal open={Boolean(modalEmpleado)} onClose={() => setModalEmpleado(null)} maxWidth="640px">
        <ModalHeader
          icon={PersonIcon}
          iconGradient="linear-gradient(135deg, var(--accent-cyan), #0080ff)"
          title={modalEmpleado === 'nuevo' ? 'Registrar Nuevo Empleado' : 'Editar Datos de Empleado'}
          subtitle="Configuración de perfil, horario y biometría facial"
          onClose={() => setModalEmpleado(null)}
        />
        <ModalBody>
          <form id="empleado-form" onSubmit={handleGuardarEmpleado} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Nombre Completo"
                required
                value={formEmp.nombre}
                onChange={e => setFormEmp(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Lic. Carlos Murillo"
              />
              <FormInput
                label="CI / Documento de Identidad"
                value={formEmp.ci}
                onChange={e => setFormEmp(f => ({ ...f, ci: e.target.value }))}
                placeholder="Ej: 8394012 LP"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Cargo / Función"
                value={formEmp.cargo}
                onChange={e => setFormEmp(f => ({ ...f, cargo: e.target.value }))}
                placeholder="Ej: Supervisor de Seguridad"
              />
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider block text-slate-300">
                  Unidad / Sucursal Asignada
                </label>
                <select
                  value={formEmp.unidad_id}
                  onChange={e => setFormEmp(f => ({ ...f, unidad_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold outline-none bg-slate-900 border border-slate-700 text-white">
                  <option value="">Seleccione una unidad...</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Horarios estándar */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Horario Entrada Normal
                </label>
                <input
                  type="time"
                  value={formEmp.horario_entrada}
                  onChange={e => setFormEmp(f => ({ ...f, horario_entrada: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-slate-850 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Horario Salida Normal
                </label>
                <input
                  type="time"
                  value={formEmp.horario_salida}
                  onChange={e => setFormEmp(f => ({ ...f, horario_salida: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-slate-850 border border-slate-700 text-white font-mono"
                />
              </div>
            </div>

            {/* Foto de Referencia para Reconocimiento Facial */}
            <FotoUploader
              foto={formEmp.foto || fotoPreview}
              setFoto={foto => {
                setFotoPreview(foto);
                setFormEmp(f => ({ ...f, foto }));
              }}
              label="Fotografía de Referencia Facial (InsightFace)"
            />

            {/* Switches: Consentimiento y Activo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs">
                  <div className="font-bold text-white">Consentimiento Biométrico</div>
                  <div className="text-[10px] text-slate-400">Autoriza reconocimiento facial</div>
                </div>
                <input
                  type="checkbox"
                  checked={formEmp.consentimiento_biometrico}
                  onChange={e => setFormEmp(f => ({ ...f, consentimiento_biometrico: e.target.checked }))}
                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs">
                  <div className="font-bold text-white">Empleado Activo</div>
                  <div className="text-[10px] text-slate-400">Habilita marcación en el sistema</div>
                </div>
                <input
                  type="checkbox"
                  checked={formEmp.activo}
                  onChange={e => setFormEmp(f => ({ ...f, activo: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setModalEmpleado(null)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">
              Cancelar
            </button>
            <button
              type="submit"
              form="empleado-form"
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              Guardar Empleado
            </button>
          </div>
        </ModalFooter>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: GESTIÓN DE UNIDADES / SUCURSALES
          ══════════════════════════════════════════════════════════════ */}
      <Modal open={modalUnidades} onClose={() => setModalUnidades(false)} maxWidth="520px">
        <ModalHeader
          icon={MapPinIcon}
          iconGradient="linear-gradient(135deg, #10b981, #059669)"
          title="Gestión de Unidades y Sedes"
          subtitle="Organización por sucursales o establecimientos"
          onClose={() => setModalUnidades(false)}
        />
        <ModalBody>
          <div className="space-y-4">
            {/* Formulario rápida para crear unidad */}
            <form onSubmit={handleCrearUnidad} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-cyan-400">Agregar Nueva Unidad</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nombre: Ej: Sede Central"
                  value={nuevaUnidad.nombre}
                  onChange={e => setNuevaUnidad(u => ({ ...u, nombre: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-white outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Dirección (opcional)"
                  value={nuevaUnidad.direccion}
                  onChange={e => setNuevaUnidad(u => ({ ...u, direccion: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-white outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors">
                + Crear Unidad
              </button>
            </form>

            {/* Lista de unidades */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {unidades.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay unidades registradas.</p>
              ) : (
                unidades.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
                    <div>
                      <div className="font-bold text-white">{u.nombre}</div>
                      {u.direccion && <div className="text-[10px] text-slate-400">{u.direccion}</div>}
                    </div>
                    <button
                      onClick={() => handleEliminarUnidad(u)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: VISOR DE FOTO DE CAPTURA
          ══════════════════════════════════════════════════════════════ */}
      {modalFoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setModalFoto(null)}>
          <div className="max-w-md w-full bg-slate-900 rounded-2xl overflow-hidden border border-cyan-500/40 shadow-2xl space-y-3 p-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-cyan-400">{modalFoto.titulo}</h4>
              <button onClick={() => setModalFoto(null)} className="text-slate-400 hover:text-white">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
              <img src={modalFoto.url} alt="Captura IA" className="max-h-full max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
