import { Button } from './ui.jsx';

/** Page controls that also state the total, which goal 6 asks for. */
export function Pagination({ page, pageSize, total, totalPages, onChange, noun = 'results' }) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-600">
        Showing <span className="font-medium text-slate-900">{first}</span>–
        <span className="font-medium text-slate-900">{last}</span> of{' '}
        <span className="font-medium text-slate-900">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <span className="text-sm text-slate-600">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}
