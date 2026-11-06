import React from 'react';
import { cx } from '../../utils/formatters';

export function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true, isAlert = false, isPrompt = false, promptValue = '', setPromptValue }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--bg-overlay)' }} onClick={onCancel} />
      <div className="relative backdrop-blur-md rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
      }}>
        <h3 className="text-base font-black mb-2" style={{ color: 'var(--text-heading)' }}>{title}</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        
        {isPrompt && (
          <input 
            type="text" 
            value={promptValue} 
            onChange={(e) => setPromptValue(e.target.value)}
            className="w-full mb-6 px-4 py-2 rounded-xl text-sm outline-none transition-all"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            autoFocus
          />
        )}
        {!isPrompt && <div className="mb-6" />}

        <div className="flex gap-3">
          {!isAlert && (
            <button onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors hover:opacity-80"
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
          )}
          <button onClick={isPrompt ? () => onConfirm(promptValue) : onConfirm}
            className={cx('flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-black transition-colors',
              isAlert ? 'bg-blue-600 hover:bg-blue-500' : (danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500')
            )}>
            {isAlert ? 'Aceptar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
