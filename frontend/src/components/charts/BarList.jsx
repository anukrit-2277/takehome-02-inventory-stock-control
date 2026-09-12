/**
 * Horizontal bars for one measure across categories.
 *
 * Every bar is the same colour on purpose: there is a single measure here, so
 * colouring each category differently would encode nothing that the bar length
 * does not already say. The value is labelled directly, so nothing depends on
 * hovering.
 */
export function BarList({ rows, emptyText = 'Nothing to show yet' }) {
  if (rows.length === 0) return <p className="py-6 text-sm text-slate-500">{emptyText}</p>;

  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="mt-3 space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">
              {row.label}
              {row.note && <span className="ml-1.5 text-xs text-slate-400">{row.note}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">
              {row.value.toLocaleString()}
            </span>
          </div>
          {/* Thin mark, square where it starts, 4px rounded at the data end. */}
          <div className="mt-1 h-2 w-full rounded-r-[4px] bg-slate-100">
            <div
              className="h-2 rounded-r-[4px]"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0)}%`,
                backgroundColor: 'var(--series-1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
