import React from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { ShieldIcon, LayersIcon, DashIcon } from './ui/Icons';

export default function ModuloRoute({
  clave,
  nombreModulo = 'Módulo de IA',
  enPreparacion = false,
  adminOnly = false,
  children
}) {
  const { modulos, user } = useAppStore();

  if (adminOnly && user?.rol_nombre !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 text-red-500">
          <ShieldIcon className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-red-400 mb-1">Acceso Restringido</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-4">
          Esta sección requiere privilegios de Administrador del sistema.
        </p>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all">
          Volver al Inicio
        </Link>
      </div>
    );
  }

  if (enPreparacion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
          <LayersIcon className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">{nombreModulo}</h2>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
          Próximamente / En Preparación
        </span>
        <p className="text-xs text-slate-400 max-w-md mb-5 leading-relaxed">
          Este módulo está registrado en la arquitectura del sistema y su interfaz de dibujo de polígonos sobre cámaras en vivo se encuentra en desarrollo.
        </p>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all flex items-center gap-2">
          <DashIcon className="w-4 h-4" /> Volver al Dashboard
        </Link>
      </div>
    );
  }

  // Verificar si el módulo está activo
  if (clave) {
    const mod = modulos.find(m => m.clave === clave);
    const estaActivo = mod ? mod.activo : true; // Por defecto true si aún cargando

    if (!estaActivo) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-750 flex items-center justify-center mb-3 text-slate-400">
            <LayersIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Módulo Desactivado</h2>
          <p className="text-xs text-slate-400 max-w-md mb-2">
            El módulo <strong className="text-cyan-400">{nombreModulo}</strong> se encuentra inhabilitado actualmente por el Administrador.
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm mb-5">
            Los procesos de IA asociados a esta función están pausados para optimizar el rendimiento del servidor.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all">
              Volver al Inicio
            </Link>
            {user?.rol_nombre === 'admin' && (
              <Link
                to="/modulos"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all">
                Activar en Módulos
              </Link>
            )}
          </div>
        </div>
      );
    }
  }

  return children;
}
