import React, { useState, useEffect } from 'react';
import { PersonIcon, PencilIcon, XIcon, CheckIcon, PlusIcon, TrashIcon, LockIcon } from '../components/ui/Icons';
import { Badge } from '../components/ui/Badge';
import { API_URL } from '../utils/constants';
import Modal, { ModalHeader, ModalBody, ModalFooter, FormInput, FormSelect } from '../components/ui/Modal';

export default function Usuarios({ user, askConfirm, askAlert, askPrompt }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', rol_nombre: 'operador' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUsuarios(); }, []);

  const fetchUsuarios = async () => {
    try {
      const token = localStorage.getItem('centinel-token');
      const res = await fetch(`${API_URL}/api/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al cargar usuarios');
      setUsuarios(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('centinel-token');
      const isEdit = !!editingId;
      const url = isEdit ? `${API_URL}/api/usuarios/${editingId}` : `${API_URL}/api/usuarios`;
      const payload = { ...formData };
      if (isEdit) delete payload.password;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al guardar usuario'); }
      await fetchUsuarios();
      cerrarForm();
    } catch (err) { askAlert('Error al guardar', err.message); }
    finally { setSaving(false); }
  };

  const editarUsuario = (u) => {
    setEditingId(u.id);
    setFormData({ nombre: u.nombre, email: u.email, password: '', rol_nombre: u.rol_nombre || 'operador' });
    setShowForm(true);
  };

  const toggleEstado = async (u) => {
    try {
      const token = localStorage.getItem('centinel-token');
      await fetch(`${API_URL}/api/usuarios/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ estado: !u.estado })
      });
      fetchUsuarios();
    } catch (err) { askAlert('Error', err.message); }
  };

  const eliminarUsuario = (u) => {
    askConfirm('Eliminar Usuario', `¿Estás seguro de que deseas eliminar permanentemente al usuario ${u.nombre}?`, async () => {
      try {
        const token = localStorage.getItem('centinel-token');
        const res = await fetch(`${API_URL}/api/usuarios/${u.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al eliminar'); }
        fetchUsuarios();
      } catch (err) { askAlert('Error', err.message); }
    });
  };

  const resetearPassword = (u) => {
    askPrompt('Restablecer Contraseña', `Introduce la nueva contraseña para ${u.nombre} (Mínimo 6 caracteres):`, async (nuevaClave) => {
      if (!nuevaClave) return;
      if (nuevaClave.length < 6) return askAlert('Aviso', 'La contraseña debe tener al menos 6 caracteres.');
      try {
        const token = localStorage.getItem('centinel-token');
        const res = await fetch(`${API_URL}/api/usuarios/${u.id}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ newPassword: nuevaClave })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al restablecer'); }
        askAlert('Éxito', 'Contraseña restablecida correctamente.');
      } catch (err) { askAlert('Error', err.message); }
    });
  };

  const cerrarForm = () => { setShowForm(false); setEditingId(null); setFormData({ nombre: '', email: '', password: '', rol_nombre: 'operador' }); };
  const abrirNuevo = () => { setEditingId(null); setFormData({ nombre: '', email: '', password: '', rol_nombre: 'operador' }); setShowForm(true); };

  if (user?.rol_nombre !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <h2 className="text-3xl font-bold text-red-500 mb-2">Acceso Denegado</h2>
        <p style={{ color: 'var(--text-secondary)' }}>No tienes permisos para ver esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>Gestión de Usuarios</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Administra los accesos y roles del sistema.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge color="blue">{usuarios.length} usuarios</Badge>
          <button onClick={abrirNuevo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)' }}>
            <PlusIcon className="w-4 h-4" /> Nuevo Usuario
          </button>
        </div>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-500">{error}</div>}

      {/* Tabla */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-black uppercase tracking-wider" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Último Acceso</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
                    <span className="text-xs">Cargando usuarios...</span>
                  </div>
                </td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  <PersonIcon className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs">No hay usuarios registrados</span>
                </td></tr>
              ) : usuarios.map(u => (
                <tr key={u.id} className="transition-colors"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                        style={{ background: u.rol_nombre === 'admin' ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'linear-gradient(135deg, #2563eb, #3b82f6)' }}>
                        {u.nombre?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{u.nombre}</div>
                        <div className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><Badge color={u.rol_nombre === 'admin' ? 'red' : 'blue'}>{u.rol_nombre === 'admin' ? 'Administrador' : 'Operador'}</Badge></td>
                  <td className="px-6 py-4"><Badge color={u.estado ? 'green' : 'slate'} dot>{u.estado ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-BO') : '— Nunca —'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => editarUsuario(u)} title="Editar"
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110"
                        style={{ background: 'rgba(0, 200, 255, 0.08)', border: '1px solid rgba(0, 200, 255, 0.15)', color: 'var(--accent-cyan)' }}>
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleEstado(u)} title={u.estado ? 'Desactivar' : 'Activar'}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110"
                        style={{ background: u.estado ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${u.estado ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}`, color: u.estado ? '#ef4444' : '#10b981' }}>
                        {u.estado ? <XIcon className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => resetearPassword(u)} title="Restablecer Contraseña"
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110"
                        style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber, #f59e0b)' }}>
                        <LockIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => eliminarUsuario(u)} title="Eliminar"
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110"
                        style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== MODAL (Portal) ========== */}
      <Modal open={showForm} onClose={cerrarForm} maxWidth="480px">
        <ModalHeader
          icon={PersonIcon}
          iconGradient="linear-gradient(135deg, #2563eb, #7c3aed)"
          title={editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
          subtitle={editingId ? 'Modifica los datos del usuario' : 'Crea una nueva cuenta de acceso'}
          onClose={cerrarForm}
        />
        <ModalBody>
          <form id="usuario-form" onSubmit={handleGuardar} className="space-y-5">
            <FormInput label="Nombre Completo" required value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Nombre y Apellido" />
            <FormInput label="Correo Electrónico" required disabled={!!editingId} type="email" value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})} placeholder="correo@ejemplo.com" />
            {!editingId && (
              <FormInput label="Contraseña" required type="password" minLength={6} value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Mínimo 6 caracteres" />
            )}
            <FormSelect label="Rol del Sistema" value={formData.rol_nombre}
              onChange={e => setFormData({...formData, rol_nombre: e.target.value})}>
              <option value="operador">👤 Operador (Monitoreo)</option>
              <option value="admin">🛡️ Administrador Global</option>
            </FormSelect>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button type="button" onClick={cerrarForm}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button type="submit" form="usuario-form" disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 4px 15px rgba(37,99,235,0.3)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : (editingId ? '✓ Guardar Cambios' : '+ Crear Cuenta')}
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}
