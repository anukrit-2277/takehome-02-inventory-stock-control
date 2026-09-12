/**
 * The shell every table shares: a scroll container with a sticky header.
 *
 * Sticky is applied to the cells rather than the row, because a <thead> cannot
 * itself be a positioning context in most browsers.
 */
export function TableShell({ children, maxHeight = 'max-h-[calc(100vh-19rem)]' }) {
  return (
    <div className={`overflow-auto scrollbar-slim ${maxHeight}`}>
      <table className="min-w-full border-separate border-spacing-0 text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ children, align = 'left', className = '', ...rest }) {
  return (
    <th
      scope="col"
      className={`sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

/** A sortable header: the arrow shows both the active column and its direction. */
export function SortableTh({ label, column, sort, direction, onSort, align = 'left' }) {
  const active = sort === column;
  return (
    <Th align={align}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex items-center gap-1 transition hover:text-slate-900 ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <span className={`text-[9px] leading-none transition ${active ? 'text-brand-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
          {active ? (direction === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </button>
    </Th>
  );
}

export function Td({ children, align = 'left', className = '', ...rest }) {
  return (
    <td
      className={`border-b border-slate-100 px-3 py-1.5 ${align === 'right' ? 'text-right' : ''} ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className = '', ...rest }) {
  return (
    <tr className={`transition-colors hover:bg-slate-50 ${className}`} {...rest}>
      {children}
    </tr>
  );
}
