import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className="relative w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-300 overflow-hidden group"
      style={{
        borderColor: isDark ? 'rgba(100, 116, 139, 0.3)' : 'rgba(15, 23, 42, 0.12)',
        background: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.8)',
      }}
    >
      {/* Sun icon */}
      <svg
        className="absolute transition-all duration-500 ease-out"
        style={{
          width: '16px',
          height: '16px',
          color: isDark ? '#94a3b8' : '#f59e0b',
          transform: isDark ? 'rotate(-90deg) scale(0)' : 'rotate(0deg) scale(1)',
          opacity: isDark ? 0 : 1,
        }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      {/* Moon icon */}
      <svg
        className="absolute transition-all duration-500 ease-out"
        style={{
          width: '16px',
          height: '16px',
          color: isDark ? '#818cf8' : '#475569',
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
          opacity: isDark ? 1 : 0,
        }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
}
