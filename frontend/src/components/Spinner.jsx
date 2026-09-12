export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 ${className}`}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}
