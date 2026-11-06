import React, { useState } from 'react';
import { cx } from '../utils/formatters';
import { CamIcon, PlusIcon, PencilIcon, TrashIcon, RefreshIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import { API_URL, AI_WORKER_URL } from '../utils/constants';
import Modal, { ModalHeader, ModalBody, ModalFooter, FormInput } from '../components/ui/Modal';

const FORM_INITIAL = { nombre: '', url_rtsp: '', direccion: '', zona: '', rol_asistencia: '', unidad_id: '', activa: true };

export default function Camaras({ camaras, setCamaras, workerOnline, askConfirm, askAlert }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [reloadingIA, setReloadingIA] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unidades, setUnidades] = useState([]);

  React.useEffect(() => {
    fetch(`${API_URL}/api/unidades`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => setUnidades(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.url_rtsp.trim()) return;
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre, url_rtsp: form.url_rtsp,
        direccion: form.direccion,
        zona: form.zona,
        rol_asistencia: form.rol_asistencia || null,
        unidad_id: form.unidad_id ? parseInt(form.unidad_id) : null,
        activa: form.activa,
      };
      if (editingId) {
        const res = await fetch(`${API_URL}/api/camaras/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('centinel-token')}`
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al actualizar');
        }
        const updated = await res.json();
        setCamaras(prev => prev.map(c => c.id === editingId ? updated : c));
      } else {
        const res = await fetch(`${API_URL}/api/camaras`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('centinel-token')}`
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al crear');
        }
        const nueva = await res.json();
        setCamaras(prev => [nueva, ...prev]);
      }
      cerrarForm();
    } catch (err) { askAlert('Error al guardar', err.message); }
    finally { setSaving(false); }
  };

  const handleEdit = (cam) => {
    setForm({
      nombre: cam.nombre || '',
      url_rtsp: cam.url_rtsp || '',
      direccion: cam.direccion || '',
      zona: cam.zona || '',
      rol_asistencia: cam.rol_asistencia || '',
      unidad_id: cam.unidad_id || '',
      activa: cam.activa !== false
    });
    setEditingId(cam.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (askConfirm) {
      askConfirm('Eliminar cámara', '¿Eliminar esta cámara del sistema?', async () => {
        try {
          const res = await fetch(`${API_URL}/api/camaras/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
          });
          if (!res.ok) throw new Error('Error al eliminar');
          setCamaras(prev => prev.filter(c => c.id !== id));
        } catch (err) { askAlert('Error al eliminar', err.message); }
      });
    }
  };

  const handleReloadIA = async () => {
    setReloadingIA(true);
    try {
      const res = await fetch(`${AI_WORKER_URL}/reload_cameras`, { method: 'POST' });
      if (!res.ok) throw new Error('El Worker IA no responde');
      const data = await res.json();
      askAlert('Éxito', `¡Cámaras sincronizadas con la Inteligencia Artificial!\nNuevas cargadas: ${data.added.length}\nEliminadas/Inactivadas: ${data.removed.length}`);
    } catch (err) {
      askAlert('Error al sincronizar con el Worker IA', err.message + '\n¿Está corriendo el python main.py?');
    } finally {
      setReloadingIA(false);
    }
  };

  const cerrarForm = () => { setForm(FORM_INITIAL); setEditingId(null); setShowForm(false); };
  const abrirNuevo = () => { setForm(FORM_INITIAL); setEditingId(null); setShowForm(true); };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader title="Gestión de Cámaras" subtitle="Administrar cámaras RTSP del sistema de vigilancia" />
        <div className="flex items-center gap-3">
          <button onClick={handleReloadIA} disabled={reloadingIA}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105"
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-secondary)',
              color: 'var(--accent-cyan)', opacity: reloadingIA ? 0.7 : 1
            }}>
            <RefreshIcon className={`w-4 h-4 ${reloadingIA ? 'animate-spin' : ''}`} />
            {reloadingIA ? 'Sincronizando...' : 'Refrescar Motor IA'}
          </button>

          <button onClick={abrirNuevo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #0080ff)', boxShadow: '0 4px 15px rgba(0, 200, 255, 0.25)' }}>
            <PlusIcon className="w-4 h-4" /> Agregar Cámara
          </button>
        </div>
      </div>

      {/* Lista */}
      {camaras.length === 0 ? (
        <EmptyState icon={CamIcon} message="No hay cámaras registradas. Agrega tu primera cámara para comenzar." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {camaras.map(cam => (
            <div key={cam.id} className="backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] group" style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: cam.activa ? 'rgba(0, 200, 255, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                    border: `1px solid ${cam.activa ? 'rgba(0, 200, 255, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`,
                  }}>
                    <CamIcon className="w-4 h-4" style={{ color: cam.activa ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: 'var(--text-heading)' }}>{cam.nombre}</div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>ID: {cam.id}</span>
                      {cam.rol_asistencia && (
                        <span className={cx(
                          'text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block',
                          cam.rol_asistencia === 'entrada' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          cam.rol_asistencia === 'salida' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' :
                          'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        )}>
                          {cam.rol_asistencia === 'entrada' ? '🚪 Entrada' : cam.rol_asistencia === 'salida' ? '🚪 Salida' : '🔄 E/S'}
                        </span>
                      )}
                      {cam.unidad_id && (
                        <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                          {unidades.find(u => u.id === cam.unidad_id)?.nombre || `Unidad #${cam.unidad_id}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge color={cam.activa ? 'green' : 'slate'} dot>{cam.activa ? 'Activa' : 'Inactiva'}</Badge>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>URL RTSP</div>
                  <div className="text-[11px] font-mono break-all leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{cam.url_rtsp}</div>
                </div>
                {(cam.direccion || cam.zona) && (
                  <div className="flex gap-4">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Dirección</div>
                      <div className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{cam.direccion || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Zona</div>
                      <div className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{cam.zona || '—'}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 flex gap-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <button onClick={() => handleEdit(cam)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all hover:scale-105"
                  style={{ background: 'rgba(0, 200, 255, 0.08)', border: '1px solid rgba(0, 200, 255, 0.15)', color: 'var(--accent-cyan)' }}>
                  <PencilIcon className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => handleDelete(cam.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all hover:scale-105"
                  style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                  <TrashIcon className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="backdrop-blur-md rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Estado del Sistema</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
          <div className="flex items-center gap-2">
            <div className={cx('w-2 h-2 rounded-full', workerOnline ? 'bg-green-500' : 'bg-red-500')} />
            Worker IA: {workerOnline ? 'Conectado' : 'Desconectado'}
          </div>
          <div>Cámaras registradas: {camaras.length}</div>
          <div>Activas: {camaras.filter(c => c.activa).length}</div>
          <div>Inactivas: {camaras.filter(c => !c.activa).length}</div>
        </div>
      </div>

      {/* ========== MODAL (Portal) ========== */}
      <Modal open={showForm} onClose={cerrarForm} maxWidth="580px">
        <ModalHeader icon={CamIcon} iconGradient="linear-gradient(135deg, var(--accent-cyan), #0080ff)"
          title={editingId ? 'Editar Cámara' : 'Nueva Cámara'}
          subtitle="Configuración RTSP del sistema de vigilancia" onClose={cerrarForm} />
        <ModalBody>
          <form id="camara-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Nombre de la Cámara" required value={form.nombre} accentColor="var(--accent-cyan)"
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="CAM 01 — Entrada Principal" />
              <FormInput label="URL RTSP" required value={form.url_rtsp} accentColor="var(--accent-cyan)"
                onChange={e => setForm(f => ({ ...f, url_rtsp: e.target.value }))} placeholder="rtsp://192.168.1.100:554/stream1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Dirección" value={form.direccion} accentColor="var(--accent-cyan)"
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} placeholder="Av. Principal esq. Calle 1" />
              <FormInput label="Zona" value={form.zona} accentColor="var(--accent-cyan)"
                onChange={e => setForm(f => ({ ...f, zona: e.target.value }))} placeholder="Norte" />
            </div>

            {/* Configuración Módulo Asistencia */}
            <div className="p-3.5 rounded-xl space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <div className="text-[11px] font-black uppercase tracking-wider text-cyan-400">Control de Asistencia de Personal</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-tertiary)' }}>
                    Rol de Registro
                  </label>
                  <select
                    value={form.rol_asistencia}
                    onChange={e => setForm(f => ({ ...f, rol_asistencia: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold outline-none"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}>
                    <option value="">Sin Rol (Solo Vigilancia)</option>
                    <option value="entrada">🚪 Punto de Entrada (Ingreso)</option>
                    <option value="salida">🚪 Punto de Salida (Egreso)</option>
                    <option value="ambas">🔄 Entrada y Salida (Bidireccional)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-tertiary)' }}>
                    Unidad / Sucursal
                  </label>
                  <select
                    value={form.unidad_id}
                    onChange={e => setForm(f => ({ ...f, unidad_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold outline-none"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}>
                    <option value="">Ninguna / General</option>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, activa: !f.activa }))}
                className="relative w-11 h-6 rounded-full transition-all duration-300"
                style={{ background: form.activa ? 'var(--accent-green)' : 'var(--text-muted)', boxShadow: form.activa ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none' }}>
                <div className={cx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300', form.activa ? 'left-[22px]' : 'left-0.5')} />
              </button>
              <span className="text-xs font-bold" style={{ color: form.activa ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>
                {form.activa ? '✓ Activa' : '✗ Inactiva'}
              </span>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button type="button" onClick={cerrarForm} className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" form="camara-form" disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #0080ff)', boxShadow: '0 4px 15px rgba(0,200,255,0.25)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : (editingId ? '✓ Actualizar ' : '+ Registrar ')}
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}
