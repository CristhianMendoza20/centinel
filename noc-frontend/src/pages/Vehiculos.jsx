import React, { useState, useEffect } from 'react';
import { getImagenUrl, cx } from '../utils/formatters';
import { CarIcon, PlusIcon, PencilIcon, TrashIcon, SearchIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import FotoUploader from '../components/FotoUploader';
import { API_URL } from '../utils/constants';
import Modal, { ModalHeader, ModalBody, ModalFooter, FormInput, FormTextarea, FormSelect } from '../components/ui/Modal';

const FORM_INITIAL = { placa: '', ruat: '', tipo: 'Auto', antecedentes: '', foto: '', contacto: '' };

export default function Vehiculos({ user, askConfirm, askAlert }) {
  const [vehiculos, setVehiculos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchVehiculos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/vehiculos`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVehiculos(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehiculos();
  }, []);

  const handleGuardar = async e => {
    e.preventDefault();
    if (!form.placa.trim()) return;
    setSaving(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('centinel-token')}`
      };
      if (editingId) {
        const res = await fetch(`${API_URL}/api/vehiculos/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al actualizar registro');
        }
      } else {
        const res = await fetch(`${API_URL}/api/vehiculos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al registrar matrícula');
        }
      }
      await fetchVehiculos();
      cerrarForm();
    } catch (err) {
      askAlert('Error al guardar', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (v) => {
    setForm({
      placa: v.placa || '',
      ruat: v.ruat || '',
      tipo: v.tipo || 'Auto',
      antecedentes: v.antecedentes || '',
      foto: v.foto || '',
      contacto: v.contacto || ''
    });
    setEditingId(v.id);
    setShowForm(true);
  };

  const handleEliminar = id => {
    if (askConfirm) {
      askConfirm('Eliminar matrícula', '¿Deseas remover esta placa de la lista negra de rastreo LPR?', async () => {
        await fetch(`${API_URL}/api/vehiculos/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        setVehiculos(p => p.filter(x => x.id !== id));
      });
    }
  };

  const cerrarForm = () => { setShowForm(false); setEditingId(null); setForm(FORM_INITIAL); };
  const abrirNuevo = () => { setEditingId(null); setForm(FORM_INITIAL); setShowForm(true); };

  const vehiculosFiltrados = vehiculos.filter(v => {
    if (filtroTipo !== 'TODOS' && v.tipo !== filtroTipo) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const mPlaca = (v.placa || '').toLowerCase().includes(q);
      const mRuat = (v.ruat || '').toLowerCase().includes(q);
      const mCont = (v.contacto || '').toLowerCase().includes(q);
      if (!mPlaca && !mRuat && !mCont) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in relative z-10 pb-8">
      <SectionHeader
        title="Lista Negra LPR / Matrículas"
        subtitle="Monitoreo óptico de matrículas vehiculares en tiempo real con EasyOCR y YOLOv8"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={abrirNuevo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300 text-white shadow-lg hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.35)'
              }}
            >
              <PlusIcon className="w-4 h-4" />
              <span>Nueva Matrícula</span>
            </button>
          </div>
        }
      />

      {/* ── Buscador y Filtros por Tipo de Vehículo ── */}
      <div
        className="p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl"
        style={{
          background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
          borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="relative w-full md:w-80">
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por placa, RUAT o contacto..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-slate-500 text-white"
            style={{
              background: 'var(--bg-deep, #050914)',
              border: '1px solid var(--border-secondary, rgba(255, 255, 255, 0.08))'
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          {['TODOS', 'Auto', 'Camioneta', 'Motocicleta', 'Camión', 'Minibús'].map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={cx(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                filtroTipo === t
                  ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
              )}
            >
              {t === 'TODOS' ? 'Todos los Tipos' : t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de Vehículos LPR ── */}
      {vehiculosFiltrados.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border backdrop-blur-xl"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          }}
        >
          <EmptyState
            icon={CarIcon}
            message={busqueda ? 'No se encontraron vehículos con el criterio de búsqueda' : 'Sin matrículas en la lista negra LPR'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vehiculosFiltrados.map(v => (
            <div
              key={v.id}
              className="rounded-2xl p-5 border flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden"
              style={{
                background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
                borderColor: 'rgba(245, 158, 11, 0.35)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Barra superior con placa simulada tipo chapa táctica */}
              <div className="flex items-start justify-between gap-3 mb-4">
                {/* Chapa Vehicular Táctica */}
                <div
                  className="px-3.5 py-1.5 rounded-lg border-2 flex items-center gap-2 shadow-inner"
                  style={{
                    background: '#040812',
                    borderColor: '#f59e0b',
                    boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)'
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-[0.2em] text-amber-400">
                    {v.placa}
                  </span>
                </div>

                <Badge color="amber">{v.tipo || 'Vehículo'}</Badge>
              </div>

              {/* Foto de Referencia (si existe) */}
              {v.foto && (
                <div className="mb-3 w-full h-32 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950">
                  <img
                    src={getImagenUrl(v.foto)}
                    alt={v.placa}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {/* Contenido / Detalles */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                  <span className="text-slate-500">RUAT:</span>
                  <span className="font-bold">{v.ruat || 'Sin registro'}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                  <span className="text-slate-500">Contacto / Tel:</span>
                  <span className="font-bold text-amber-300">{v.contacto || 'No especificado'}</span>
                </div>
                {v.antecedentes && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 pt-1 border-t border-slate-800/80">
                    {v.antecedentes}
                  </p>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleEditar(v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 flex items-center gap-1.5"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                {user?.rol_nombre === 'admin' && (
                  <button
                    onClick={() => handleEliminar(v.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1.5"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de Edición / Creación ── */}
      <Modal open={showForm} onClose={cerrarForm} maxWidth="560px">
        <form onSubmit={handleGuardar} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ModalHeader
            icon={CarIcon}
            iconGradient="linear-gradient(135deg, #d97706, #f59e0b)"
            title={editingId ? 'Modificar Matrícula LPR' : 'Registrar Matrícula en Lista Negra'}
            subtitle="Ingresa los datos del vehículo para activar alarmas acústicas y despachos tácticos"
            onClose={cerrarForm}
          />
          <ModalBody className="space-y-4">
            <FotoUploader
              foto={form.foto}
              setFoto={foto => setForm(f => ({ ...f, foto }))}
              label="Fotografía del Vehículo / Placa (Opcional)"
            />

            <FormInput
              label="Número de Placa / Matrícula"
              value={form.placa}
              onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })}
              placeholder="Ej: 4082-KPT"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                label="Registro RUAT"
                value={form.ruat}
                onChange={e => setForm({ ...form, ruat: e.target.value })}
                placeholder="Ej: 9948212"
              />
              <FormSelect
                label="Tipo de Vehículo"
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value })}
                options={[
                  { value: 'Auto', label: '🚗 Automóvil / Sedán' },
                  { value: 'Camioneta', label: '🚙 Camioneta / SUV' },
                  { value: 'Motocicleta', label: '🏍️ Motocicleta' },
                  { value: 'Camión', label: '🚛 Camión de Carga' },
                  { value: 'Minibús', label: '🚐 Minibús / Transporte' }
                ]}
              />
            </div>

            <FormInput
              label="Contacto / Autoridad de Referencia"
              value={form.contacto}
              onChange={e => setForm({ ...form, contacto: e.target.value })}
              placeholder="Ej: Fiscal Táctico / Tel: 70012345"
            />

            <FormTextarea
              label="Motivo de Búsqueda / Infracciones"
              value={form.antecedentes}
              onChange={e => setForm({ ...form, antecedentes: e.target.value })}
              placeholder="Detalles sobre denuncias de robo o requerimientos de incautación..."
              rows={3}
            />
          </ModalBody>
          <ModalFooter
            onCancel={cerrarForm}
            confirmText={saving ? 'Guardando en Base de Datos...' : editingId ? 'Guardar Cambios' : 'Registrar Matrícula'}
            confirmColor="amber"
            confirmDisabled={saving || !form.placa.trim()}
          />
        </form>
      </Modal>
    </div>
  );
}
