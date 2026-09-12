import { cloneElement, useId } from 'react';

/** Small shared pieces, so screens stay about behaviour rather than classes. */

/**
 * type defaults to "button", not the HTML default of "submit": a Cancel or
 * Delete button placed inside a form would otherwise submit it. Every button
 * that really does submit says so explicitly.
 */
export function Button({ variant = 'primary', type = 'button', className = '', ...props }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50',
    secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = '', ...props }) {
  return <div className={`rounded-lg bg-white ring-1 ring-slate-200 ${className}`} {...props} />;
}

/**
 * A labelled control with an optional hint and error.
 *
 * The hint and error sit outside the <label> and are attached with
 * aria-describedby instead. Nesting them inside would fold their text into the
 * control's accessible name, so a select would announce as "Kind Receipt Issue
 * Transfer Adjustment Stock arriving at a location" rather than just "Kind".
 */
export function Field({ label, error, hint, children }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint && !error ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="block">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy })}
      {hint && !error && <span id={hintId} className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span id={errorId} className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50';

export function Input({ className = '', ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = '', ...props }) {
  return <select className={`${inputClass} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${inputClass} ${className}`} rows={3} {...props} />;
}

export function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-brand-100 text-brand-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** One consistent way to show a failed request. */
export function ErrorMessage({ error, className = '' }) {
  if (!error) return null;
  return (
    <div className={`rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 ${className}`}>
      {error.message ?? String(error)}
      {error.details?.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-xs">
          {error.details.map((detail, index) => (
            <li key={index}>{detail.field ? `${detail.field}: ${detail.message}` : detail.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  );
}
