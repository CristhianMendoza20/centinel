import React, { useState, useEffect } from 'react';
import { getImagenUrl, cx } from '../utils/formatters';
import { PersonIcon, PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, SearchIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import FotoUploader from '../components/FotoUploader';
import { API_URL } from '../utils/constants';
import Modal, { ModalHeader, ModalBody, ModalFooter, FormInput, FormTextarea, FormSelect } from '../components/ui/Modal';

const FORM_INITIAL = { nombre: '', alias: '', ci: '', peligrosidad: 'Baja', antecedentes: '', foto: '' };

export default function Personas({ user, askConfirm, askAlert }) {
  const [personas, setPersonas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRiesgo, setFiltroRiesgo] = useState('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPersonas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/personas`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPersonas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleGuardar = async e => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('centinel-token')}`
      };
      if (editingId) {
        const res = await fetch(`${API_URL}/api/personas/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Error al actualizar');
        }
      } else {
        const res = await fetch(`${API_URL}/api/personas`, {
          method: 'POST',
          headers,
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Error al guardar');
        }
      }
      await fetchPersonas();
      cerrarForm();
    } catch (err) {
      askAlert('Error al guardar', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (p) => {
    setForm({
      nombre: p.nombre || '',
      alias: p.alias || '',
      ci: p.ci || '',
      peligrosidad: p.peligrosidad || 'Baja',
      antecedentes: p.antecedentes || '',
      foto: p.foto || ''
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handlePersonaCapturada = id => {
    if (askConfirm) {
      askConfirm('Sujeto Capturado', '¿Confirmas que este sujeto ha sido aprehendido? Se registrará el cierre en el sistema.', async () => {
        await fetch(`${API_URL}/api/personas/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        setPersonas(p => p.filter(x => x.id !== id));
      });
    }
  };

  const handleEliminar = id => {
    if (askConfirm) {
      askConfirm('Eliminar registro biométrico', 'Esta acción eliminará el perfil facial de la memoria IA. ¿Continuar?', async () => {
        await fetch(`${API_URL}/api/personas/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        setPersonas(p => p.filter(x => x.id !== id));
      });
    }
  };

  const cerrarForm = () => { setShowForm(false); setEditingId(null); setForm(FORM_INITIAL); };
  const abrirNuevo = () => { setEditingId(null); setForm(FORM_INITIAL); setShowForm(true); };

  const personasFiltradas = personas.filter(p => {
    if (filtroRiesgo !== 'TODOS' && p.peligrosidad !== filtroRiesgo) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const mNom = (p.nombre || '').toLowerCase().includes(q);
      const mAli = (p.alias || '').toLowerCase().includes(q);
      const mCi = (p.ci || '').toLowerCase().includes(q);
      if (!mNom && !mAli && !mCi) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in relative z-10 pb-8">
      <SectionHeader
        title="Sujetos de Interés / Lista de Sospechosos"
        subtitle="Registro de identidades para vigilancia activa con reconocimiento facial InsightFace"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={abrirNuevo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300 text-white shadow-lg hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                boxShadow: '0 4px 20px rgba(6, 182, 212, 0.35)'
              }}
            >
              <PlusIcon className="w-4 h-4" />
              <span>Registrar Sujeto</span>
            </button>
          </div>
        }
      />

      {/* ── Barra de Búsqueda y Filtros ── */}
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
            placeholder="Buscar por nombre, alias o CI..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-slate-500 text-white"
            style={{
              background: 'var(--bg-deep, #050914)',
              border: '1px solid var(--border-secondary, rgba(255, 255, 255, 0.08))'
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          {['TODOS', 'Alta', 'Media', 'Baja'].map(r => (
            <button
              key={r}
              onClick={() => setFiltroRiesgo(r)}
              className={cx(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                filtroRiesgo === r
                  ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
              )}
            >
              {r === 'TODOS' ? 'Todos los Riesgos' : `Riesgo ${r}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de Sujetos ── */}
      {personasFiltradas.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border backdrop-blur-xl"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          }}
        >
          <EmptyState
            icon={PersonIcon}
            message={busqueda ? 'No se encontraron sujetos con el filtro aplicado' : 'Sin sujetos registrados en la base de datos biométrica'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {personasFiltradas.map(p => {
            const isHigh = p.peligrosidad === 'Alta';
            const isMed = p.peligrosidad === 'Media';
            const riskColor = isHigh ? 'red' : isMed ? 'amber' : 'green';
            const borderGlow = isHigh ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-primary, rgba(30, 41, 59, 0.6))';

            return (
              <div
                key={p.id}
                className="rounded-2xl p-4.5 border flex items-start gap-4 transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden"
                style={{
                  background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
                  borderColor: borderGlow,
                  boxShadow: isHigh ? '0 8px 30px rgba(239, 68, 68, 0.15)' : '0 8px 30px rgba(0, 0, 0, 0.3)'
                }}
              >
                {/* Foto Biometría */}
                <div
                  className="w-18 h-18 rounded-xl overflow-hidden flex-shrink-0 relative border shadow-md"
                  style={{
                    background: 'var(--bg-deep, #050914)',
                    borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.8))'
                  }}
                >
                  {p.foto ? (
                    <img
                      src={getImagenUrl(p.foto)}
                      alt={p.nombre}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <PersonIcon className="w-8 h-8" />
                    </div>
                  )}
                  {isHigh && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  )}
                </div>

                {/* Info del Sujeto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-sm font-black text-white truncate tracking-wide">
                      {p.nombre}
                    </h3>
                  </div>

                  <p className="text-[11px] font-mono text-cyan-400 truncate">
                    Alias: {p.alias ? `"${p.alias}"` : 'Sin alias'}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                    CI: {p.ci || 'Sin documento'}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <Badge color={riskColor} dot={isHigh}>
                      Riesgo {p.peligrosidad}
                    </Badge>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-col gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                  <button
                    onClick={() => handlePersonaCapturada(p.id)}
                    title="Marcar Sujeto Capturado"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-110 bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditar(p)}
                    title="Editar Perfil"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-110 bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  {user?.rol_nombre === 'admin' && (
                    <button
                      onClick={() => handleEliminar(p.id)}
                      title="Eliminar Perfil"
                      className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-110 bg-red-500/10 border-red-500/30 text-red-400"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de Registro / Edición ── */}
      <Modal open={showForm} onClose={cerrarForm} maxWidth="560px">
        <form onSubmit={handleGuardar} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ModalHeader
            icon={PersonIcon}
            iconGradient="linear-gradient(135deg, #0891b2, #06b6d4)"
            title={editingId ? 'Modificar Ficha de Sujeto' : 'Nuevo Sujeto de Interés'}
            subtitle="Ingresa la biometría y antecedentes para el reconocimiento facial en tiempo real"
            onClose={cerrarForm}
          />
          <ModalBody className="space-y-4">
            <FotoUploader
              foto={form.foto}
              setFoto={foto => setForm(f => ({ ...f, foto }))}
              label="Fotografía Facial Táctica (Frontal)"
            />

            <FormInput
              label="Nombre Completo"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Carlos Mendoza Quispe"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                label="Alias / Apodo"
                value={form.alias}
                onChange={e => setForm({ ...form, alias: e.target.value })}
                placeholder="Ej: 'El Zorro'"
              />
              <FormInput
                label="Cédula de Identidad (CI)"
                value={form.ci}
                onChange={e => setForm({ ...form, ci: e.target.value })}
                placeholder="Ej: 8945123 LP"
              />
            </div>

            <FormSelect
              label="Nivel de Peligrosidad / Riesgo"
              value={form.peligrosidad}
              onChange={e => setForm({ ...form, peligrosidad: e.target.value })}
              options={[
                { value: 'Baja', label: '🟢 Baja (Seguimiento preventivo)' },
                { value: 'Media', label: '🟡 Media (Requisitoria no violenta)' },
                { value: 'Alta', label: '🔴 Alta (Peligro crítico / Armado)' }
              ]}
            />

            <FormTextarea
              label="Antecedentes / Observaciones Tácticas"
              value={form.antecedentes}
              onChange={e => setForm({ ...form, antecedentes: e.target.value })}
              placeholder="Detalles sobre órdenes de captura, señas particulares o infracciones..."
              rows={3}
            />
          </ModalBody>
          <ModalFooter
            onCancel={cerrarForm}
            confirmText={saving ? 'Guardando en Base de Datos...' : editingId ? 'Guardar Cambios' : 'Registrar Sujeto'}
            confirmColor="cyan"
            confirmDisabled={saving || !form.nombre.trim()}
          />
        </form>
      </Modal>
    </div>
  );
}
