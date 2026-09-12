import { Link } from 'react-router-dom';

import { locations as locationsApi, movements } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { useQueryParams } from '../hooks/useQueryParams.js';
import { formatDateTime } from '../lib/format.js';
import { Badge, Card, EmptyState, ErrorMessage, Select } from '../components/ui.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { TableShell, Td, Th, Tr } from '../components/DataTable.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { IconMovements } from '../components/Icons.jsx';

const DEFAULTS = { kind: '', locationId: '', page: '1', pageSize: '25' };

// Receipts add, issues remove, transfers relocate, adjustments correct.
const KINDS = {
  RECEIPT: { tone: 'green', label: 'Receipt' },
  ISSUE: { tone: 'amber', label: 'Issue' },
  TRANSFER: { tone: 'blue', label: 'Transfer' },
  ADJUSTMENT: { tone: 'red', label: 'Adjustment' },
};

export function Movements() {
  const { values, update, key } = useQueryParams(DEFAULTS);
  const state = useFetch(() => movements.list(values), [key]);
  const { data: locationData } = useFetch(() => locationsApi.list(), []);

  return (
    <div>
      <PageHeader
        title="Movements"
        description="Every receipt, issue, transfer and adjustment. Nothing here can be edited or removed."
      >
        {state.loading && state.data && <Spinner className="h-3.5 w-3.5" />}
      </PageHeader>

      <Card className="mb-3 p-3">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={values.kind} onChange={(e) => update({ kind: e.target.value, page: '1' })} aria-label="Filter by kind">
            <option value="">All kinds</option>
            {Object.entries(KINDS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>

          <Select value={values.locationId} onChange={(e) => update({ locationId: e.target.value, page: '1' })} aria-label="Filter by location">
            <option value="">All locations</option>
            {(locationData?.locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <ErrorMessage error={state.error} className="m-3" />

        {state.loading && !state.data ? (
          <div className="py-14 text-center"><Spinner /></div>
        ) : state.data.total === 0 ? (
          <EmptyState title="No movements match these filters" icon={IconMovements} />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Kind</Th>
                  <Th align="right">Qty</Th>
                  <Th>Item</Th>
                  <Th>Location</Th>
                  <Th>Reason / note</Th>
                  <Th align="right">Recorded</Th>
                </tr>
              </thead>
              <tbody className={`transition-opacity ${state.loading ? 'opacity-40' : ''}`}>
                {state.data.data.map((movement) => {
                  const kind = KINDS[movement.kind];
                  const delta = movement.kind === 'ISSUE' ? -movement.quantity : movement.quantity;
                  return (
                    <Tr key={movement.id}>
                      <Td className="whitespace-nowrap"><Badge tone={kind.tone}>{kind.label}</Badge></Td>
                      <Td align="right" className={`whitespace-nowrap font-semibold tnum ${delta < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                      </Td>
                      <Td className="min-w-44 max-w-64">
                        <Link to={`/items/${movement.item.id}`} className="font-medium text-slate-900 transition hover:text-brand-600">
                          {movement.item.sku}
                        </Link>
                        <span className="block truncate text-[11px] text-slate-400">{movement.item.name}</span>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-[12px] text-slate-600">
                        {movement.kind === 'TRANSFER' ? (
                          <span className="inline-flex items-center gap-1.5">
                            {movement.sourceLocation.code}
                            <span className="text-slate-300">→</span>
                            {movement.destinationLocation.code}
                          </span>
                        ) : movement.location.code}
                      </Td>
                      <Td className="max-w-xs truncate text-slate-500">
                        {movement.reason && <span className="italic">“{movement.reason}”</span>}
                        {movement.note && <span className="ml-1">{movement.note}</span>}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        <span className="block text-[12px] text-slate-700">{movement.recordedBy.name}</span>
                        <span className="block text-[11px] text-slate-400 tnum">{formatDateTime(movement.occurredAt)}</span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableShell>
            <Pagination {...state.data} noun="movements" onChange={(page) => update({ page: String(page) })} />
          </>
        )}
      </Card>
    </div>
  );
}
