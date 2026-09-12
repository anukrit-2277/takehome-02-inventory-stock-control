/**
 * Horizontal bars for one measure across categories.
 *
 * Every bar is the same colour on purpose: there is a single measure here, so
 * colouring each category differently would encode nothing that the bar length
 * does not already say. The value is labelled directly, so nothing depends on
 * hovering.
 */
export function BarList({ rows, emptyText = 'Nothing to show yet' }) {
  if (rows.length === 0) return <p className="py-6 text-[13px] text-slate-500">{emptyText}</p>;

  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="space-y-3.5">
      {rows.map((row) => (
        <li key={row.key} className="group">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-medium text-slate-700">{row.label}</span>
              {row.note && <span className="shrink-0 text-[11px] text-slate-400">{row.note}</span>}
            </span>
            <span className="shrink-0 font-semibold text-slate-900 tnum">{row.value.toLocaleString()}</span>
          </div>
          {/* Thin mark, square where it starts, rounded at the data end. */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                backgroundColor: 'var(--series-1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
