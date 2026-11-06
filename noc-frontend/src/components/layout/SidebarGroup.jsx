import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cx } from '../../utils/formatters';
import { ChevronRightIcon } from '../ui/Icons';

export default function SidebarGroup({
  grupo,
  isOpen,
  onToggle,
  onCloseMobile,
  user,
  badges = {},
  workerOnline = false
}) {
  const location = useLocation();
  const Icon = grupo.icon;

  // Filtrar subitems según rol de usuario
  const subitemsVisibles = (grupo.subitems || []).filter(sub => {
    if (sub.adminOnly && user?.rol_nombre !== 'admin') return false;
    return true;
  });

  if (subitemsVisibles.length === 0) return null;

  // Calcular si alguno de los subitems está activo en la ruta actual
  const tieneRutaActiva = subitemsVisibles.some(sub => location.pathname === sub.path);

  // Calcular badge acumulado para cuando el grupo está cerrado
  const badgeTotal = subitemsVisibles.reduce((acc, sub) => {
    if (sub.badgeKey && badges[sub.badgeKey]) {
      return acc + (parseInt(badges[sub.badgeKey]) || 0);
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-1">
      {/* ── Encabezado del Módulo (Botón Desplegable) ── */}
      <button
        type="button"
        onClick={onToggle}
        className={cx(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 text-left group relative',
          tieneRutaActiva
            ? 'bg-slate-800/80 text-white font-bold border border-slate-700/60 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/40 border border-transparent'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Icono con color de módulo */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
            style={{
              background: `${grupo.color}15`,
              border: `1px solid ${grupo.color}40`,
              color: grupo.color
            }}
          >
            <Icon className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <span className="text-[12px] font-bold tracking-wide truncate block">
              {grupo.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Indicador de estado del motor (●) */}
          <div
            className={cx(
              'w-2 h-2 rounded-full',
              workerOnline ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
            )}
            title={workerOnline ? 'Motor IA activo y conectado' : 'Módulo activo (Worker desconectado)'}
          />

          {/* Badge acumulado cuando está colapsado */}
          {!isOpen && badgeTotal > 0 && (
            <span
              className="text-[10px] font-black px-1.5 py-0.2 rounded-full leading-none"
              style={{
                background: `${grupo.color}25`,
                color: grupo.color,
                border: `1px solid ${grupo.color}60`
              }}
            >
              {badgeTotal > 99 ? '99+' : badgeTotal}
            </span>
          )}

          {/* Flecha Chevron */}
          <div className={cx('transform transition-transform duration-200 text-slate-400 group-hover:text-white', isOpen ? 'rotate-90' : 'rotate-0')}>
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </div>
        </div>
      </button>

      {/* ── Subitems Desplegables con Guía Visual de Árbol ── */}
      {isOpen && (
        <div className="ml-5 pl-3 border-l-2 border-slate-750 space-y-0.5 pt-0.5 animate-fade-in" style={{ borderColor: `${grupo.color}30` }}>
          {subitemsVisibles.map((sub, idx) => {
            const isSubActive = location.pathname === sub.path;
            const subBadge = sub.badgeKey && badges[sub.badgeKey] ? badges[sub.badgeKey] : 0;
            const isLast = idx === subitemsVisibles.length - 1;

            return (
              <Link
                key={sub.path}
                to={sub.path}
                onClick={onCloseMobile}
                className={cx(
                  'flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all group relative',
                  isSubActive
                    ? 'text-white font-bold bg-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                )}
              >
                {/* Indicador de activo a la izquierda */}
                {isSubActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 rounded-r-full"
                    style={{ background: grupo.color, boxShadow: `0 0 8px ${grupo.color}` }}
                  />
                )}

                <span className="truncate pr-2">{sub.label}</span>

                {/* Badge por subitem */}
                {subBadge > 0 && (
                  <span
                    className="text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none flex-shrink-0"
                    style={{
                      background: `${grupo.color}25`,
                      color: grupo.color,
                      border: `1px solid ${grupo.color}50`
                    }}
                  >
                    {subBadge > 99 ? '99+' : subBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
