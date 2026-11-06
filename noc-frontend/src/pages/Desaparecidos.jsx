import React, { useState, useEffect } from 'react';
import { getImagenUrl } from '../utils/formatters';
import { SearchIcon, CheckCircleIcon, PlusIcon, PencilIcon, TrashIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import FotoUploader from '../components/FotoUploader';
import { API_URL } from '../utils/constants';
import Modal, { ModalHeader, ModalBody, ModalFooter, FormInput, FormTextarea } from '../components/ui/Modal';

const FORM_INITIAL = { nombre: '', contacto: '', fecha_desaparicion: '', rasgos: '', ropa: '', foto: '' };

export default function Desaparecidos({ user, askConfirm, askAlert }) {
  const [desaparecidos, setDesaparecidos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCasos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/desaparecidos`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDesaparecidos(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCasos();
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
        const res = await fetch(`${API_URL}/api/desaparecidos/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al actualizar caso');
        }
      } else {
        const res = await fetch(`${API_URL}/api/desaparecidos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al registrar persona desaparecida');
        }
      }
      await fetchCasos();
      cerrarForm();
    } catch (err) {
      askAlert('Error al guardar', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (d) => {
    setForm({
      nombre: d.nombre || '',
      contacto: d.contacto || '',
      fecha_desaparicion: d.fecha_desaparicion || '',
      rasgos: d.rasgos || '',
      ropa: d.ropa || '',
      foto: d.foto || ''
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handlePersonaEncontrada = id => {
    if (askConfirm) {
      askConfirm('Persona Localizada', '¿Confirmas que la persona ha sido encontrada para cerrar positivamente este caso?', async () => {
        await fetch(`${API_URL}/api/desaparecidos/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        setDesaparecidos(p => p.filter(x => x.id !== id));
      });
    }
  };

  const handleEliminar = id => {
    if (askConfirm) {
      askConfirm('Eliminar registro', '¿Deseas remover este expediente del protocolo de búsqueda activa?', async () => {
        await fetch(`${API_URL}/api/desaparecidos/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
        });
        setDesaparecidos(p => p.filter(x => x.id !== id));
      });
    }
  };

  const cerrarForm = () => { setShowForm(false); setEditingId(null); setForm(FORM_INITIAL); };
  const abrirNuevo = () => { setEditingId(null); setForm(FORM_INITIAL); setShowForm(true); };

  const desaparecidosFiltrados = desaparecidos.filter(d => {
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const mNom = (d.nombre || '').toLowerCase().includes(q);
      const mCont = (d.contacto || '').toLowerCase().includes(q);
      const mRasg = (d.rasgos || '').toLowerCase().includes(q);
      if (!mNom && !mCont && !mRasg) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in relative z-10 pb-8">
      <SectionHeader
        title="Protocolo de Búsqueda de Personas Desaparecidas"
        subtitle="Rastreo biométrico continuo en todas las cámaras públicas y nodos de acceso"
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
              <span>Activar Nuevo Caso</span>
            </button>
          </div>
        }
      />

      {/* ── Buscador ── */}
      <div
        className="p-4 rounded-2xl border flex items-center justify-between gap-4 backdrop-blur-xl"
        style={{
          background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
          borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="relative w-full max-w-md">
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, contacto o señas particulares..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all placeholder:text-slate-500 text-white"
            style={{
              background: 'var(--bg-deep, #050914)',
              border: '1px solid var(--border-secondary, rgba(255, 255, 255, 0.08))'
            }}
          />
        </div>

        <span className="text-xs font-mono font-bold text-slate-400 hidden sm:inline">
          {desaparecidosFiltrados.length} Expedientes en Rastreo
        </span>
      </div>

      {/* ── Grid de Casos ── */}
      {desaparecidosFiltrados.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border backdrop-blur-xl"
          style={{
            background: 'var(--bg-card, rgba(15, 23, 42, 0.65))',
            borderColor: 'var(--border-primary, rgba(30, 41, 59, 0.6))',
          }}
        >
          <EmptyState
            icon={SearchIcon}
            message={busqueda ? 'No se encontraron expedientes con los términos ingresados' : 'Sin casos de personas desaparecidas activos en este momento'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {desaparecidosFiltrados.map(d => (
            <div
              key={d.id}
              className="rounded-2xl p-4.5 border flex items-start gap-4 transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden"
              style={{
                background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
                borderColor: 'rgba(6, 182, 212, 0.35)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Foto de Búsqueda */}
              <div
                className="w-18 h-18 rounded-xl overflow-hidden flex-shrink-0 relative border shadow-md"
                style={{
                  background: 'var(--bg-deep, #050914)',
                  borderColor: 'rgba(6, 182, 212, 0.5)'
                }}
              >
                {d.foto ? (
                  <img
                    src={getImagenUrl(d.foto)}
                    alt={d.nombre}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-cyan-400">
                    <SearchIcon className="w-8 h-8" />
                  </div>
                )}
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              </div>

              {/* Información del Caso */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-black text-white truncate tracking-wide">
                    {d.nombre}
                  </h3>
                </div>

                <p className="text-[11px] font-mono text-cyan-300 truncate">
                  📞 Contacto: {d.contacto || 'Sin número registrado'}
                </p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Desaparecido: {d.fecha_desaparicion || 'Fecha no precisada'}
                </p>

                {d.rasgos && (
                  <p className="text-[10px] text-slate-300 mt-1 line-clamp-1">
                    Señas: {d.rasgos}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <Badge color="cyan" dot>
                    Búsqueda Activa
                  </Badge>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-col gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                <button
                  onClick={() => handlePersonaEncontrada(d.id)}
                  title="Marcar como Encontrada"
                  className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-110 bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleEditar(d)}
                  title="Editar Expediente"
                  className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-110 bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                {user?.rol_nombre === 'admin' && (
                  <button
                    onClick={() => handleEliminar(d.id)}
                    title="Eliminar Expediente"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-110 bg-red-500/10 border-red-500/30 text-red-400"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de Edición / Nuevo Caso ── */}
      <Modal open={showForm} onClose={cerrarForm} maxWidth="560px">
        <form onSubmit={handleGuardar} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ModalHeader
            icon={SearchIcon}
            iconGradient="linear-gradient(135deg, #0284c7, #06b6d4)"
            title={editingId ? 'Modificar Expediente de Búsqueda' : 'Activar Protocolo de Búsqueda'}
            subtitle="El sistema rastreará de inmediato este rostro en todos los streams de video activos"
            onClose={cerrarForm}
          />
          <ModalBody className="space-y-4">
            <FotoUploader
              foto={form.foto}
              setFoto={foto => setForm(f => ({ ...f, foto }))}
              label="Fotografía Reciente de la Persona"
            />

            <FormInput
              label="Nombre Completo"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Ana Lucía Beltrán Rojas"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                label="Teléfono de Contacto Familiar"
                value={form.contacto}
                onChange={e => setForm({ ...form, contacto: e.target.value })}
                placeholder="Ej: 71234567 (Madre)"
              />
              <FormInput
                type="date"
                label="Fecha de Desaparición"
                value={form.fecha_desaparicion}
                onChange={e => setForm({ ...form, fecha_desaparicion: e.target.value })}
              />
            </div>

            <FormTextarea
              label="Rasgos Particulares / Señas Físicas"
              value={form.rasgos}
              onChange={e => setForm({ ...form, rasgos: e.target.value })}
              placeholder="Cicatrices, tatuajes, altura aproximada, contextura..."
              rows={2}
            />

            <FormTextarea
              label="Vestimenta / Última vez vista con"
              value={form.ropa}
              onChange={e => setForm({ ...form, ropa: e.target.value })}
              placeholder="Chompa azul, jeans oscuros, mochila negra..."
              rows={2}
            />
          </ModalBody>
          <ModalFooter
            onCancel={cerrarForm}
            confirmText={saving ? 'Guardando en Base de Datos...' : editingId ? 'Guardar Cambios' : 'Activar Protocolo'}
            confirmColor="cyan"
            confirmDisabled={saving || !form.nombre.trim()}
          />
        </form>
      </Modal>
    </div>
  );
}
