import { useEffect } from 'react';

import { IconClose } from './Icons.jsx';

export function Modal({ open, title, onClose, children, width = 'max-w-lg' }) {
  // Escape closes the dialog, which people expect and screen readers rely on.
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width} animate-in overflow-hidden rounded-xl bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/10`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-3">
          <h2 className="text-[13px] font-semibold tracking-tight text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
