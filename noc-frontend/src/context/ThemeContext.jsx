import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function getInitialTheme() {
  // 1. Check localStorage
  const stored = localStorage.getItem('centinel-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  // 2. Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  // 3. Default to dark (CENTINEL aesthetic)
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  const isDark = theme === 'dark';

  // Apply class to <html> and update meta theme-color
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#050d1a' : '#f0f4f8');
    }

    // Persist
    localStorage.setItem('centinel-theme', theme);
  }, [theme, isDark]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
