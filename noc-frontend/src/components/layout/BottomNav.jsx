import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cx } from '../../utils/formatters';
import { NAV } from '../../utils/constants';
import useAppStore from '../../store/useAppStore';

export default function BottomNav() {
  const { alertas } = useAppStore();
  const location = useLocation();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md flex transition-colors duration-300"
      style={{
        background: 'var(--bg-bottomnav)',
        borderTop: '1px solid var(--border-primary)',
      }}>
      {NAV.map(item => {
        const Icon = item.icon;
        const active = location.pathname === (item.id === 'dashboard' ? '/' : `/${item.id}`);
        return (
          <Link key={item.id} to={item.id === 'dashboard' ? '/' : `/${item.id}`}
            className={cx(
              'flex-1 flex flex-col items-center justify-center pt-2 pb-2.5 gap-1 transition-colors relative',
            )}
            style={{ color: active ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: 'var(--accent-blue)' }} />}
            <Icon className="w-5 h-5" />
            <span className="text-[9px] font-bold">{item.short}</span>
            {item.id === 'alertas' && alertas.length > 0 && (
              <span className="absolute top-1.5 right-1/2 translate-x-3 w-4 h-4 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                {alertas.length > 9 ? '9+' : alertas.length}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
