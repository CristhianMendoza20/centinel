import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cx } from '../../utils/formatters';
import { XIcon, LogoutIcon, PersonIcon } from '../ui/Icons';
import { NAV_SECCIONES, API_URL } from '../../utils/constants';
import { Pulse } from '../ui/Pulse';
import useAppStore from '../../store/useAppStore';
import SidebarGroup from './SidebarGroup';

export default function Sidebar({ sidebarOpen, setSidebarOpen, workerOnline = false }) {
  const { user, alertas, logout, modulos } = useAppStore();
  const location = useLocation();

  // Badges dinámicos para los ítems
  const [badges, setBadges] = useState({
    alertas: 0,
    presentes: 0,
    intrusiones: 0,
    capturasPersonas: 0,
    capturasVehiculos: 0
  });

  // Persistencia de qué grupos de módulos están abiertos
  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('centinel-sidebar-grupos');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        asistencia: true,
        zonas_restringidas: true,
        ...parsed,
        reconocimiento_facial: parsed.reconocimiento_facial !== undefined ? parsed.reconocimiento_facial : true,
        reconocimiento_placas: parsed.reconocimiento_placas !== undefined ? parsed.reconocimiento_placas : true,
      };
    } catch {
      return { reconocimiento_facial: true, reconocimiento_placas: true, asistencia: true, zonas_restringidas: true };
    }
  });

  const toggleGroup = (clave) => {
    setOpenGroups(prev => {
      const updated = { ...prev, [clave]: !prev[clave] };
      try {
        localStorage.setItem('centinel-sidebar-grupos', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Abrir automáticamente el grupo que contenga la ruta actual
  useEffect(() => {
    const seccionIA = NAV_SECCIONES.find(s => s.esModuloIA);
    if (!seccionIA) return;
    for (const g of seccionIA.grupos || []) {
      const coincide = (g.subitems || []).some(sub => location.pathname.startsWith(sub.path));
      if (coincide && !openGroups[g.clave]) {
        setOpenGroups(prev => ({ ...prev, [g.clave]: true }));
      }
    }
  }, [location.pathname]);

  // Cargar badges desde el backend
  const fetchBadges = async () => {
    try {
      const token = localStorage.getItem('centinel-token');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/sidebar/badges`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBadges(prev => ({ ...prev, ...data }));
      }
    } catch {}
  };

  useEffect(() => {
    fetchBadges();
    // Escuchar eventos WebSocket para actualizar badges
    const handleWs = (e) => {
      const msg = e.detail;
      if (msg && (msg.type === 'ASISTENCIA_MARCA' || msg.type === 'NUEVA_ALERTA')) {
        fetchBadges();
      }
    };
    window.addEventListener('centinel-ws-message', handleWs);
    return () => window.removeEventListener('centinel-ws-message', handleWs);
  }, []);

  // Sincronizar badge de alertas con el store
  useEffect(() => {
    setBadges(prev => ({ ...prev, alertas: alertas.length }));
  }, [alertas.length]);

  // Contar cuántos módulos de IA están activos
  const totalModulosIA = 4;
  const modulosIAActivosCount = useMemo(() => {
    const clavesIA = ['reconocimiento_facial', 'reconocimiento_placas', 'asistencia', 'zonas_restringidas'];
    return modulos.filter(m => clavesIA.includes(m.clave) && m.activo).length;
  }, [modulos]);

  return (
    <>
      {/* ── SIDEBAR OVERLAY (mobile) ─────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 backdrop-blur-md" style={{ background: 'var(--bg-overlay)' }} />
        </div>
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <aside className={cx(
        'fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto',
        'w-72 flex-shrink-0 rounded-none border-t-0 border-b-0 border-l-0',
        'flex flex-col transition-all duration-300 ease-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )} style={{
        background: 'var(--bg-sidebar)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid var(--border-primary)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.1)',
      }}>
        {/* Logo CENTINEL */}
        <div className="px-6 pt-7 pb-5 relative overflow-hidden" style={{ borderBottom: '1px solid var(--sidebar-divider)' }}>
          <div className="absolute -top-4 -left-4 w-32 h-32 blur-[40px] rounded-full pointer-events-none" style={{ background: 'var(--accent-cyan-soft)' }} />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shadow-md" style={{
                border: '1px solid var(--border-accent)',
                background: 'var(--bg-primary)',
              }}>
                <img src="/logo4.png" alt="Logo CENTINEL" className="w-full h-full object-cover scale-110" />
              </div>
              <div className="flex flex-col">
                <div className="text-[20px] font-black tracking-tight leading-none" style={{ color: 'var(--logo-text)' }}>
                  CENTI<span className="text-neon-cyan">NEL</span>
                </div>
                <div className="text-[9px] font-bold tracking-[0.2em] uppercase leading-tight mt-1" style={{ color: 'var(--accent-cyan)' }}>
                  SISTEMA TÁCTICO CENTINEL
                </div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden transition-colors" style={{ color: 'var(--text-tertiary)' }}>
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navegación por Secciones y Módulos de IA */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto custom-scrollbar">
          {NAV_SECCIONES.map((seccion, sIdx) => {
            // ── CASO A: MÓDULOS DE IA ──
            if (seccion.esModuloIA) {
              const gruposVisibles = (seccion.grupos || []).filter(g => {
                if (!modulos || modulos.length === 0) {
                  return g.clave === 'reconocimiento_facial' || g.clave === 'reconocimiento_placas';
                }
                const mod = modulos.find(m => m.clave === g.clave);
                return mod ? mod.activo : (g.clave === 'reconocimiento_facial' || g.clave === 'reconocimiento_placas');
              });

              return (
                <div key={sIdx} className="space-y-1.5">
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                      {seccion.titulo}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
                      {modulosIAActivosCount} / {totalModulosIA}
                    </span>
                  </div>

                  {gruposVisibles.length === 0 ? (
                    <div className="mx-2 p-3 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
                      <p className="text-[10px] text-slate-500 mb-1.5">No hay módulos de IA activos.</p>
                      {user?.rol_nombre === 'admin' && (
                        <Link
                          to="/modulos"
                          onClick={() => setSidebarOpen(false)}
                          className="text-[10px] font-bold text-cyan-400 hover:underline block"
                        >
                          Ir a Gestión de Módulos ›
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {gruposVisibles.map(g => (
                        <SidebarGroup
                          key={g.clave}
                          grupo={g}
                          isOpen={Boolean(openGroups[g.clave])}
                          onToggle={() => toggleGroup(g.clave)}
                          onCloseMobile={() => setSidebarOpen(false)}
                          user={user}
                          badges={badges}
                          workerOnline={workerOnline}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // ── CASO B: SECCIÓN GENERAL O ADMINISTRACIÓN ──
            const itemsVisibles = (seccion.items || []).filter(item => {
              if (item.adminOnly && user?.rol_nombre !== 'admin') return false;
              return true;
            });

            if (itemsVisibles.length === 0) return null;

            return (
              <div key={sIdx} className="space-y-1">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] px-3 pt-1 pb-1" style={{ color: 'var(--text-muted)' }}>
                  {seccion.titulo}
                </div>

                {itemsVisibles.map(item => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  const itemBadge = item.badgeKey && badges[item.badgeKey] ? badges[item.badgeKey] : 0;

                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cx(
                        'w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-left group relative',
                        active ? 'border font-bold' : 'border border-transparent'
                      )}
                      style={active ? {
                        background: 'var(--sidebar-active-bg)',
                        borderColor: 'var(--sidebar-active-border)',
                        boxShadow: 'var(--sidebar-active-glow)',
                        color: 'var(--text-primary)',
                      } : {
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 rounded-r-full"
                          style={{
                            background: 'var(--accent-cyan)',
                            boxShadow: `0 0 12px var(--accent-cyan)`,
                          }}
                        />
                      )}

                      <Icon
                        className="w-4 h-4 flex-shrink-0 transition-colors"
                        style={{ color: active ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }}
                      />
                      <span className="text-[12px] font-semibold flex-1 tracking-wide truncate">
                        {item.label}
                      </span>

                      {itemBadge > 0 && (
                        <span className="bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center leading-none">
                          {itemBadge > 99 ? '99+' : itemBadge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User info + Logout + System status */}
        <div className="p-4 space-y-2.5" style={{ borderTop: '1px solid var(--sidebar-divider)' }}>
          {/* User info */}
          {user && (
            <div className="glass-panel px-3.5 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                background: 'var(--accent-cyan-soft, rgba(0,200,255,0.1))',
                border: '1px solid rgba(0,200,255,0.2)',
              }}>
                <PersonIcon className="w-4 h-4" style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.nombre}</div>
                <div className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{user.rol_nombre || user.rol}</div>
              </div>
              <button
                onClick={logout}
                title="Cerrar sesión"
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                }}
              >
                <LogoutIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="glass-panel px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pulse color={workerOnline ? 'green' : 'amber'} />
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: workerOnline ? 'var(--accent-green)' : '#f59e0b' }}>
                {workerOnline ? 'MOTOR IA ONLINE' : 'MOTOR IA DESCONECTADO'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
