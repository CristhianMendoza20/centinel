import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XIcon } from './Icons';

const TW_WIDTHS = {
  'max-w-xs': '320px',
  'max-w-sm': '384px',
  'max-w-md': '448px',
  'max-w-lg': '520px',
  'max-w-xl': '580px',
  'max-w-2xl': '672px',
  'max-w-3xl': '768px',
  'max-w-4xl': '896px',
};

/**
 * Modal component rendered via React Portal to ensure it always appears
 * above all other content, regardless of parent overflow/z-index.
 */
export default function Modal({ open, onClose, children, maxWidth = '520px' }) {
  const parsedMaxWidth = TW_WIDTHS[maxWidth] || maxWidth || '520px';

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center animate-fade-in"
      style={{ zIndex: 99999, padding: '1rem' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(3, 7, 18, 0.75)' }}
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div
        className="relative w-full animate-scale-up"
        style={{
          maxWidth: parsedMaxWidth,
          background: 'var(--bg-primary, #090e17)',
          border: '1px solid var(--border-accent, rgba(6, 182, 212, 0.25))',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 60px rgba(0,0,0,0.65), 0 0 25px rgba(6, 182, 212, 0.12)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Reusable modal header */
export function ModalHeader({ icon: Icon, iconGradient, title, subtitle, onClose }) {
  return (
    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-primary, rgba(255,255,255,0.08))', flexShrink: 0 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
              style={{ background: iconGradient || 'linear-gradient(135deg, #0284c7, #06b6d4)' }}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight" style={{ color: 'var(--text-heading, #ffffff)' }}>{title}</h3>
            {subtitle && <p className="text-[11px] leading-relaxed line-clamp-1" style={{ color: 'var(--text-tertiary, #94a3b8)' }}>{subtitle}</p>}
          </div>
        </div>
        {onClose && (
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110 flex-shrink-0"
            style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444' }}>
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Reusable modal body (scrollable) */
export function ModalBody({ children, className = '', style = {} }) {
  return (
    <div 
      className={`overflow-y-auto flex-1 ${className}`} 
      style={{ padding: '1.5rem', ...style }}
    >
      {children}
    </div>
  );
}

/** Reusable modal footer supporting both children and declarative props */
export function ModalFooter({ 
  children, 
  onCancel, 
  cancelText = 'Cancelar', 
  confirmText = 'Guardar', 
  confirmColor = 'cyan', 
  confirmDisabled = false, 
  confirmType = 'submit',
  formId,
  onConfirm
}) {
  const getGradient = () => {
    switch (confirmColor) {
      case 'amber':
        return 'linear-gradient(135deg, #d97706, #f59e0b)';
      case 'red':
        return 'linear-gradient(135deg, #dc2626, #ef4444)';
      case 'green':
        return 'linear-gradient(135deg, #059669, #10b981)';
      case 'blue':
        return 'linear-gradient(135deg, #2563eb, #3b82f6)';
      case 'purple':
        return 'linear-gradient(135deg, #7c3aed, #a855f7)';
      case 'cyan':
      default:
        return 'linear-gradient(135deg, #0891b2, #06b6d4)';
    }
  };

  const getGlow = () => {
    switch (confirmColor) {
      case 'amber': return '0 4px 18px rgba(245, 158, 11, 0.35)';
      case 'red': return '0 4px 18px rgba(239, 68, 68, 0.35)';
      case 'green': return '0 4px 18px rgba(16, 185, 129, 0.35)';
      case 'blue': return '0 4px 18px rgba(37, 99, 235, 0.35)';
      case 'cyan':
      default:
        return '0 4px 18px rgba(6, 182, 212, 0.35)';
    }
  };

  return (
    <div style={{ 
      padding: '1rem 1.5rem', 
      borderTop: '1px solid var(--border-primary, rgba(255,255,255,0.08))', 
      background: 'rgba(0,0,0,0.25)', 
      flexShrink: 0 
    }}>
      {children ? children : (
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all border hover:bg-slate-800/80 active:scale-95 text-slate-300"
              style={{
                background: 'var(--bg-secondary, rgba(15, 23, 42, 0.8))',
                borderColor: 'var(--border-primary, rgba(255, 255, 255, 0.1))',
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            type={confirmType}
            form={formId}
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider text-white transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg"
            style={{
              background: getGradient(),
              boxShadow: confirmDisabled ? 'none' : getGlow()
            }}
          >
            {confirmText}
          </button>
        </div>
      )}
    </div>
  );
}

/** Reusable form input with focus highlight */
export function FormInput({ label, accentColor = 'var(--accent-cyan)', required, className = '', ...props }) {
  const inputStyle = {
    background: 'rgba(2, 6, 23, 0.75)',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
    color: 'var(--text-primary, #ffffff)',
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] font-mono uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
          <span style={{ color: accentColor }}>{'>'}</span>
          {label}{required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}
      <input
        required={required}
        className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono outline-none transition-all placeholder:text-slate-500 placeholder:opacity-50 focus:shadow-lg ${className}`}
        style={inputStyle}
        onFocus={e => { 
          e.target.style.borderColor = accentColor; 
          e.target.style.boxShadow = `0 0 15px rgba(6,182,212,0.25) inset 0 2px 8px rgba(0,0,0,0.5)`; 
        }}
        onBlur={e => { 
          e.target.style.borderColor = 'var(--border-primary, rgba(255,255,255,0.12))'; 
          e.target.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.5)'; 
        }}
        {...props}
      />
    </div>
  );
}

/** Reusable form textarea with focus highlight */
export function FormTextarea({ label, accentColor = 'var(--accent-cyan)', required, rows = 3, className = '', ...props }) {
  const inputStyle = {
    background: 'rgba(2, 6, 23, 0.75)',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
    color: 'var(--text-primary, #ffffff)',
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] font-mono uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
          <span style={{ color: accentColor }}>{'>'}</span>
          {label}{required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}
      <textarea
        rows={rows}
        className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono outline-none transition-all resize-none placeholder:text-slate-500 placeholder:opacity-50 focus:shadow-lg ${className}`}
        style={inputStyle}
        onFocus={e => { 
          e.target.style.borderColor = accentColor; 
          e.target.style.boxShadow = `0 0 15px rgba(6,182,212,0.25) inset 0 2px 8px rgba(0,0,0,0.5)`; 
        }}
        onBlur={e => { 
          e.target.style.borderColor = 'var(--border-primary, rgba(255,255,255,0.12))'; 
          e.target.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.5)'; 
        }}
        {...props}
      />
    </div>
  );
}

/** Reusable form select with support for options array or children */
export function FormSelect({ label, accentColor = 'var(--accent-cyan)', required, options, children, className = '', ...props }) {
  const inputStyle = {
    background: 'rgba(2, 6, 23, 0.75)',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
    color: 'var(--text-primary, #ffffff)',
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] font-mono uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
          <span style={{ color: accentColor }}>{'>'}</span>
          {label}{required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}
      <select
        className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono outline-none transition-all focus:shadow-lg cursor-pointer ${className}`}
        style={inputStyle}
        onFocus={e => { 
          e.target.style.borderColor = accentColor; 
          e.target.style.boxShadow = `0 0 15px rgba(6,182,212,0.25) inset 0 2px 8px rgba(0,0,0,0.5)`; 
        }}
        onBlur={e => { 
          e.target.style.borderColor = 'var(--border-primary, rgba(255,255,255,0.12))'; 
          e.target.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.5)'; 
        }}
        {...props}
      >
        {options && options.map((opt, idx) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lab = typeof opt === 'object' ? opt.label : opt;
          return (
            <option 
              key={idx} 
              value={val} 
              style={{ background: '#0b1220', color: '#f8fafc', padding: '8px' }}
            >
              {lab}
            </option>
          );
        })}
        {children}
      </select>
    </div>
  );
}
