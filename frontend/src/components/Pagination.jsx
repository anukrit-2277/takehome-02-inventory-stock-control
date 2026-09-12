import { Button } from './ui.jsx';
import { IconChevronLeft, IconChevronRight } from './Icons.jsx';

/** Page controls that also state the total, which goal 6 asks for. */
export function Pagination({ page, pageSize, total, totalPages, onChange, noun = 'results' }) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/50 px-4 py-2.5">
      <p className="text-[12px] text-slate-500">
        <span className="font-medium text-slate-700 tnum">{first}</span>–
        <span className="font-medium text-slate-700 tnum">{last}</span> of{' '}
        <span className="font-medium text-slate-700 tnum">{total.toLocaleString()}</span> {noun}
      </p>

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          <IconChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Button>
        <span className="px-1.5 text-[12px] text-slate-500 tnum">
          {page} / {totalPages}
        </span>
        <Button size="sm" variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next
          <IconChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
