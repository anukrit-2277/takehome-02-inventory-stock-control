import { Link } from 'react-router-dom';

import { locations as locationsApi, movements } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { useQueryParams } from '../hooks/useQueryParams.js';
import { formatDateTime, signed } from '../lib/format.js';
import { Badge, Card, EmptyState, ErrorMessage, Select } from '../components/ui.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';

const DEFAULTS = { kind: '', locationId: '', page: '1', pageSize: '25' };
const TONE = { RECEIPT: 'green', ISSUE: 'amber', TRANSFER: 'blue', ADJUSTMENT: 'red' };

export function Movements() {
  const { values, update, key } = useQueryParams(DEFAULTS);
  const state = useFetch(() => movements.list(values), [key]);
  const { data: locationData } = useFetch(() => locationsApi.list(), []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Movements</h1>
        <p className="text-sm text-slate-500">
          Every receipt, issue, transfer and adjustment, newest first. Nothing here can be edited
          or removed.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={values.kind}
            onChange={(e) => update({ kind: e.target.value, page: '1' })}
            aria-label="Filter by kind"
          >
            <option value="">All kinds</option>
            {Object.keys(TONE).map((kind) => (
              <option key={kind} value={kind}>{kind[0] + kind.slice(1).toLowerCase()}</option>
            ))}
          </Select>

          <Select
            value={values.locationId}
            onChange={(e) => update({ locationId: e.target.value, page: '1' })}
            aria-label="Filter by location"
          >
            <option value="">All locations</option>
            {(locationData?.locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <ErrorMessage error={state.error} className="m-4" />

        {state.loading && !state.data ? (
          <div className="py-12 text-center"><Spinner /></div>
        ) : state.data.total === 0 ? (
          <EmptyState title="No movements match these filters" />
        ) : (
          <>
            <ul className={`divide-y divide-slate-100 ${state.loading ? 'opacity-40' : ''}`}>
              {state.data.data.map((movement) => (
                <li key={movement.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <Badge tone={TONE[movement.kind]}>{movement.kind.toLowerCase()}</Badge>

                  <span className="w-16 text-right font-medium tabular-nums text-slate-900">
                    {movement.kind === 'ISSUE' ? signed(-movement.quantity) : signed(movement.quantity)}
                  </span>

                  <Link to={`/items/${movement.item?.id ?? movement.itemId}`} className="min-w-40 text-brand-600 hover:underline">
                    {movement.item?.sku ?? `Item ${movement.itemId}`}
                  </Link>

                  <span className="text-slate-700">
                    {movement.kind === 'TRANSFER'
                      ? `${movement.sourceLocation.code} → ${movement.destinationLocation.code}`
                      : movement.location.code}
                  </span>

                  {movement.reason && <span className="text-slate-500">“{movement.reason}”</span>}

                  <span className="ml-auto text-right text-xs text-slate-500">
                    {movement.recordedBy.name}
                    <span className="block">{formatDateTime(movement.occurredAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Pagination {...state.data} onChange={(page) => update({ page: String(page) })} noun="movements" />
          </>
        )}
      </Card>
    </div>
  );
}
