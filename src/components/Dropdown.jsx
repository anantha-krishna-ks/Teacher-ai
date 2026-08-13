import React, { useState, useRef, useEffect } from 'react';

// Custom premium dropdown (native <select> option lists can't be styled).
// Pass `compact` for tight toolbar contexts; `icon` for a leading glyph.
export default function Dropdown({ value, placeholder, options, onChange, disabled, icon, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const size = compact ? 14 : 16;

  return (
    <div className={`pdrop${compact ? ' pdrop--compact' : ''}${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} ref={ref}>
      <button
        type="button"
        className="pdrop-trigger"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon && <span className="pdrop-icon" aria-hidden="true">{icon}</span>}
        <span className={`pdrop-label ${selected ? 'pdrop-value' : 'pdrop-placeholder'}`}>{selected ? selected.label : placeholder}</span>
        <span className="pdrop-chevron-box">
          <svg className="pdrop-chevron" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      {open && (
        <div className="pdrop-panel" role="listbox">
          {options.length === 0 && <div className="pdrop-empty">No options available</div>}
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`pdrop-option${o.value === value ? ' is-active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
