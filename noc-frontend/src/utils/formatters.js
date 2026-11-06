export const cx = (...c) => c.filter(Boolean).join(' ');

export const fmt = d => d ? new Date(d).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtDate = d => d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

export const ACCENT = {
  blue:  { text: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-600',   border: 'border-blue-600/40',  glow: 'shadow-blue-900/50',  ring: 'focus:border-blue-500'  },
  cyan:  { text: 'text-cyan-600 dark:text-cyan-400',  bg: 'bg-cyan-700',   border: 'border-cyan-600/40',  glow: 'shadow-cyan-900/50',  ring: 'focus:border-cyan-500'  },
  amber: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-700',  border: 'border-amber-600/40', glow: 'shadow-amber-900/50', ring: 'focus:border-amber-500' },
  red:   { text: 'text-red-600 dark:text-red-400',   bg: 'bg-red-700',    border: 'border-red-600/40',   glow: 'shadow-red-900/50',   ring: 'focus:border-red-500'   },
  green: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-700', border: 'border-emerald-600/40', glow: '', ring: 'focus:border-emerald-500' },
};

const CAM_COLOR_CYCLE = ['green', 'cyan', 'amber', 'red'];
export const colorCamara = (i) => CAM_COLOR_CYCLE[i % CAM_COLOR_CYCLE.length];

// Input class helper: bg and border are set via CSS variables in index.css
export const INPUT_STYLE = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  color: 'var(--text-primary)',
};

import { API_URL } from './constants';

export const getImagenUrl = (fotoUrl) => {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith('data:image')) return fotoUrl;
  if (fotoUrl.startsWith('/uploads')) return `${API_URL}${fotoUrl}`;
  return fotoUrl;
};

