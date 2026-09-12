import { cloneElement, useId } from 'react';

/** Small shared pieces, so screens stay about behaviour rather than classes. */

const BUTTON_VARIANTS = {
  // A rich solid blue with a one-step-darker top edge: depth without a gradient
  // that would smear at small sizes.
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-900/20 ring-1 ring-inset ring-brand-700/60 hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100',
  danger:
    'bg-rose-600 text-white shadow-sm shadow-rose-900/20 ring-1 ring-inset ring-rose-700/60 hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const BUTTON_SIZES = {
  sm: 'h-7 gap-1.5 rounded-md px-2 text-[12px]',
  md: 'h-9 gap-2 rounded-lg px-3 text-[13px]',
};

/**
 * type defaults to "button", not the HTML default of "submit": a Cancel or
 * Delete button placed inside a form would otherwise submit it. Every button
 * that really does submit says so explicitly.
 */
export function Button({ variant = 'primary', size = 'md', type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex select-none items-center justify-center font-medium tracking-tight transition-colors duration-100 disabled:pointer-events-none disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:ring-slate-200 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** A white panel on the slate page: hairline ring plus the faintest lift. */
export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-xl bg-white shadow-sm shadow-slate-900/5 ring-1 ring-slate-200/80 ${className}`}
      {...props}
    />
  );
}

/** Section heading used at the top of every panel. */
export function PanelHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-3">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
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
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, 'data-invalid': error ? '' : undefined })}
      {hint && !error && <span id={hintId} className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span id={errorId} className="mt-1 block text-xs text-rose-600">{error}</span>}
    </div>
  );
}

// Inset ring rather than a border, so the focus ring can thicken without the
// control changing size and nudging the layout.
const CONTROL =
  'w-full rounded-lg border-0 bg-white px-3 text-[13px] text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition placeholder:text-slate-400 ' +
  'hover:ring-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 focus:outline-none ' +
  'disabled:bg-slate-50 disabled:text-slate-400 data-invalid:ring-rose-400';

export function Input({ className = '', ...props }) {
  return <input className={`${CONTROL} h-9 ${className}`} {...props} />;
}

export function Select({ className = '', ...props }) {
  return (
    <select
      className={`${CONTROL} h-9 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${CONTROL} py-2 leading-relaxed ${className}`} rows={3} {...props} />;
}

export function Checkbox({ className = '', ...props }) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border-slate-300 text-brand-600 shadow-sm transition focus:ring-2 focus:ring-brand-500 focus:ring-offset-0 ${className}`}
      {...props}
    />
  );
}

// Pill badges. Stock state uses the semantic set; everything else stays neutral
// so a category can never be mistaken for a warning.
const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  neutral: 'bg-white text-slate-600 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export function Badge({ tone = 'slate', dot = false, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BADGE_TONES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

/** One consistent way to show a failed request. */
export function ErrorMessage({ error, className = '' }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={`rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200 ${className}`}
    >
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

export function EmptyState({ title, children, icon: Icon }) {
  return (
    <div className="px-6 py-14 text-center">
      {Icon && (
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      {children && <p className="mt-1 text-[13px] text-slate-500">{children}</p>}
    </div>
  );
}
