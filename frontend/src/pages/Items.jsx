import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { categories as categoriesApi, items, locations as locationsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useDebounced } from '../hooks/useDebounced.js';
import { useQueryParams } from '../hooks/useQueryParams.js';
import { Badge, Button, Card, Checkbox, EmptyState, ErrorMessage, Input, Select } from '../components/ui.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { SortableTh, TableShell, Td, Th, Tr } from '../components/DataTable.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { ItemFormModal } from '../components/ItemFormModal.jsx';
import { IconPackage, IconPlus, IconSearch } from '../components/Icons.jsx';

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

/** Three states, three colours — the semantic set, never used for anything else. */
function stockTone(item) {
  if (item.totalOnHand === 0) return { tone: 'red', label: 'Out of stock' };
  if (item.belowReorderLevel) return { tone: 'amber', label: 'Low stock' };
  return { tone: 'green', label: 'In stock' };
}

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

  const setFilter = (changes) => update({ ...changes, page: '1' });

  const filtersApplied =
    values.search || values.categoryId || values.locationId ||
    values.belowReorder === 'true' || values.archived !== 'active';

  return (
    <div>
      <PageHeader
        title="Items"
        description={data ? `${data.total.toLocaleString()} matching ${data.total === 1 ? 'item' : 'items'}` : 'Loading…'}
      >
        {loading && data && <Spinner className="h-3.5 w-3.5" />}
        {isManager && (
          <Button onClick={() => setFormOpen(true)}>
            <IconPlus className="h-4 w-4" />
            New item
          </Button>
        )}
      </PageHeader>

      <Card className="mb-3 p-3">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search name or SKU…"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search items"
              className="pl-9"
            />
          </div>

          <Select value={values.categoryId} onChange={(e) => setFilter({ categoryId: e.target.value })} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>

          <Select value={values.locationId} onChange={(e) => setFilter({ locationId: e.target.value })} aria-label="Filter by location">
            <option value="">All locations</option>
            {locations.map((l) => (<option key={l.id} value={l.id}>{l.code} — {l.name}</option>))}
          </Select>

          <Select value={values.archived} onChange={(e) => setFilter({ archived: e.target.value })} aria-label="Filter by archived status">
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">Active and archived</option>
          </Select>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-2.5">
          <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-700">
            <Checkbox
              checked={values.belowReorder === 'true'}
              onChange={(e) => setFilter({ belowReorder: e.target.checked ? 'true' : '' })}
            />
            At or below reorder level
          </label>

          {values.locationId && (
            <span className="text-[11px] text-slate-400">On hand shows stock at the selected location only</span>
          )}

          {filtersApplied && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => update(DEFAULTS)}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <ErrorMessage error={error} className="m-3" />

        <TableShell>
          <thead>
            <tr>
              <SortableTh label="SKU" column="sku" sort={values.sort} direction={values.direction} onSort={sortBy} />
              <SortableTh label="Name" column="name" sort={values.sort} direction={values.direction} onSort={sortBy} />
              <Th>Category</Th>
              <SortableTh label="On hand" column="onHand" sort={values.sort} direction={values.direction} onSort={sortBy} align="right" />
              <SortableTh label="Reorder" column="reorderLevel" sort={values.sort} direction={values.direction} onSort={sortBy} align="right" />
              <Th align="right">Status</Th>
            </tr>
          </thead>

          <tbody className={`transition-opacity ${loading && data ? 'opacity-40' : ''}`}>
            {loading && !data && (
              <tr><td colSpan={6} className="px-4 py-12 text-center"><Spinner /></td></tr>
            )}

            {data?.data.map((item) => {
              const status = stockTone(item);
              return (
                <Tr key={item.id}>
                  <Td className="whitespace-nowrap font-mono text-[12px] text-slate-500">
                    <Link to={`/items/${item.id}`} className="transition hover:text-brand-600">{item.sku}</Link>
                  </Td>
                  <Td className="min-w-52 max-w-80">
                    <Link to={`/items/${item.id}`} className="block truncate font-medium text-slate-900 transition hover:text-brand-600">
                      {item.name}
                    </Link>
                    <span className="-mt-0.5 block text-[11px] leading-tight text-slate-400">per {item.unitOfMeasure}</span>
                  </Td>
                  <Td className="whitespace-nowrap"><Badge tone="neutral">{item.category.name}</Badge></Td>
                  <Td align="right" className="whitespace-nowrap font-semibold text-slate-900 tnum">{item.onHand.toLocaleString()}</Td>
                  <Td align="right" className="whitespace-nowrap text-slate-500 tnum">{item.reorderLevel.toLocaleString()}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5">
                      {item.archivedAt && <Badge tone="slate">Archived</Badge>}
                      <Badge tone={status.tone} dot>{status.label}</Badge>
                    </div>
                  </Td>
                </Tr>
              );
            })}

            {data?.data.length === 0 && (
              <tr><td colSpan={6}>
                <EmptyState title="No items match these filters" icon={IconPackage}>
                  Try a different search, or clear the filters.
                </EmptyState>
              </td></tr>
            )}
          </tbody>
        </TableShell>

        {data && (
          <Pagination {...data} noun="items" onChange={(page) => update({ page: String(page) })} />
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
