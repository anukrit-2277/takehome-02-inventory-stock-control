import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { categories as categoriesApi, items, locations as locationsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useDebounced } from '../hooks/useDebounced.js';
import { useQueryParams } from '../hooks/useQueryParams.js';
import { Badge, Button, Card, EmptyState, ErrorMessage, Input, Select } from '../components/ui.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { ItemFormModal } from '../components/ItemFormModal.jsx';

// Also the shape of the URL: anything left at its default is not in the query
// string, so a plain /items link stays clean.
const DEFAULTS = {
  search: '',
  categoryId: '',
  locationId: '',
  archived: 'active',
  belowReorder: '',
  sort: 'name',
  direction: 'asc',
  page: '1',
  pageSize: '25',
};

const COLUMNS = [
  { key: 'sku', label: 'SKU', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'category', label: 'Category' },
  { key: 'onHand', label: 'On hand', sortable: true, numeric: true },
  { key: 'reorderLevel', label: 'Reorder level', sortable: true, numeric: true },
  { key: 'status', label: '' },
];

export function Items() {
  const { isManager } = useAuth();
  const { refresh: refreshBadge } = useAlerts();
  const { values, update, key } = useQueryParams(DEFAULTS);

  // The box is local state so typing feels instant; the URL only catches up
  // once the user pauses.
  const [searchInput, setSearchInput] = useState(values.search);
  const debouncedSearch = useDebounced(searchInput, 300);

  // Mirrors the box's current value. State updates are applied after the whole
  // effect pass, so within it setSearchInput has not taken effect yet and the
  // state variable still reads stale — a ref is updated straight away and can
  // be trusted here.
  const latestSearch = useRef(values.search);

  function onSearchChange(value) {
    latestSearch.current = value;
    setSearchInput(value);
  }

  // Follows the URL when it changes from outside the box: the back button, or
  // Clear filters.
  useEffect(() => {
    latestSearch.current = values.search;
    setSearchInput(values.search);
  }, [values.search]);

  useEffect(() => {
    // The timer can land after the box has already moved on — Clear filters
    // empties it mid-debounce. Publishing the old term then would silently undo
    // the clear, so only publish a term the box still holds.
    if (debouncedSearch !== latestSearch.current) return;
    if (debouncedSearch === values.search) return;

    update({ search: debouncedSearch, page: '1' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, values.search]);

  // Every filter, sort and page is sent to the server — nothing is filtered in
  // the browser (goal 6).
  const { data, loading, error, reload } = useFetch(() => items.list(values), [key]);
  const { data: categoryData } = useFetch(() => categoriesApi.list(), []);
  const { data: locationData } = useFetch(() => locationsApi.list(), []);

  const [formOpen, setFormOpen] = useState(false);
  const categories = categoryData?.categories ?? [];
  const locations = locationData?.locations ?? [];

  function sortBy(column) {
    const direction = values.sort === column && values.direction === 'asc' ? 'desc' : 'asc';
    update({ sort: column, direction, page: '1' });
  }

  function setFilter(changes) {
    update({ ...changes, page: '1' });
  }

  const filtersApplied =
    values.search || values.categoryId || values.locationId ||
    values.belowReorder === 'true' || values.archived !== 'active';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Items</h1>
          <p className="flex items-center gap-2 text-sm text-slate-500">
            {data ? `${data.total} matching ${data.total === 1 ? 'item' : 'items'}` : 'Loading…'}
            {/* Rows stay on screen while a new page loads, so say so rather
                than showing stale numbers as if they were current. */}
            {loading && data && <Spinner className="h-3.5 w-3.5" />}
          </p>
        </div>
        {isManager && <Button onClick={() => setFormOpen(true)}>New item</Button>}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="search"
            placeholder="Search name or SKU…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search items"
          />

          <Select
            value={values.categoryId}
            onChange={(e) => setFilter({ categoryId: e.target.value })}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select
            value={values.locationId}
            onChange={(e) => setFilter({ locationId: e.target.value })}
            aria-label="Filter by location"
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
            ))}
          </Select>

          <Select
            value={values.archived}
            onChange={(e) => setFilter({ archived: e.target.value })}
            aria-label="Filter by archived status"
          >
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">Active and archived</option>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={values.belowReorder === 'true'}
              onChange={(e) => setFilter({ belowReorder: e.target.checked ? 'true' : '' })}
            />
            At or below reorder level
          </label>

          {values.locationId && (
            <span className="text-xs text-slate-500">
              On hand shows stock at the selected location only
            </span>
          )}

          {filtersApplied && (
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => update(DEFAULTS)}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <ErrorMessage error={error} className="m-4" />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-4 py-2.5 font-medium text-slate-600 ${column.numeric ? 'text-right' : 'text-left'}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => sortBy(column.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        {column.label}
                        <span className="text-xs text-slate-400">
                          {values.sort === column.key ? (values.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody
              className={`divide-y divide-slate-100 transition-opacity ${loading && data ? 'opacity-40' : ''}`}
            >
              {loading && !data && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-10 text-center">
                    <Spinner />
                  </td>
                </tr>
              )}

              {data?.data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                    <Link to={`/items/${item.id}`} className="text-brand-600 hover:underline">
                      {item.sku}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/items/${item.id}`} className="font-medium text-slate-900 hover:underline">
                      {item.name}
                    </Link>
                    <span className="block text-xs text-slate-500">per {item.unitOfMeasure}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{item.category.name}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900">
                    {item.onHand}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {item.reorderLevel}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {item.archivedAt && <Badge tone="slate">Archived</Badge>}
                      {item.belowReorderLevel && <Badge tone="red">Low stock</Badge>}
                    </div>
                  </td>
                </tr>
              ))}

              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState title="No items match these filters">
                      Try a different search, or clear the filters.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            noun="items"
            onChange={(page) => update({ page: String(page) })}
          />
        )}
      </Card>

      <ItemFormModal
        open={formOpen}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={() => { reload(); refreshBadge(); }}
      />
    </div>
  );
}
