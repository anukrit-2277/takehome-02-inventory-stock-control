export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 ${className}`}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
