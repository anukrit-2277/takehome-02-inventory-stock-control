import { useState } from 'react';
import { Link } from 'react-router-dom';

import { alerts } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatDateTime } from '../lib/format.js';
import { Badge, Button, Card, Checkbox, EmptyState, ErrorMessage } from '../components/ui.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { TableShell, Td, Th, Tr } from '../components/DataTable.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { IconCheck } from '../components/Icons.jsx';

export function Alerts() {
  const { isManager } = useAuth();
  const { refresh: refreshBadge } = useAlerts();
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const state = useFetch(
    () => alerts.lowStock({ page, pageSize: 25, includeDismissed: includeDismissed ? 'true' : '' }),
    [page, includeDismissed],
  );

  async function act(itemId, dismissed) {
    setError(null);
    setBusyId(itemId);
    try {
      await (dismissed ? alerts.restore(itemId) : alerts.dismiss(itemId));
      state.reload();
      refreshBadge();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Low stock alerts"
        description="Items whose total on hand, across every location, is at or below their reorder level"
      >
        <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-700">
          <Checkbox
            checked={includeDismissed}
            onChange={(e) => { setIncludeDismissed(e.target.checked); setPage(1); }}
          />
          Include dismissed
        </label>
      </PageHeader>

      <ErrorMessage error={error} className="mb-3" />

      <Card className="overflow-hidden">
        {state.loading && !state.data ? (
          <div className="py-14 text-center"><Spinner /></div>
        ) : state.data.total === 0 ? (
          <EmptyState title="Nothing is running low" icon={IconCheck}>
            Every active item is above its reorder level.
          </EmptyState>
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Category</Th>
                  <Th align="right">On hand</Th>
                  <Th align="right">Reorder</Th>
                  <Th align="right">Short by</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody className={`transition-opacity ${state.loading ? 'opacity-40' : ''}`}>
                {state.data.data.map((row) => (
                  <Tr key={row.id}>
                    <Td className="min-w-52 max-w-80">
                      <Link to={`/items/${row.id}`} className="block truncate font-medium text-slate-900 transition hover:text-brand-600">
                        {row.name}
                      </Link>
                      <span className="block font-mono text-[11px] text-slate-400">{row.sku}</span>
                    </Td>
                    <Td className="whitespace-nowrap"><Badge tone="neutral">{row.category}</Badge></Td>
                    <Td align="right" className={`font-semibold tnum ${row.onHand === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {row.onHand.toLocaleString()}
                    </Td>
                    <Td align="right" className="text-slate-500 tnum">{row.reorderLevel.toLocaleString()}</Td>
                    <Td align="right">
                      <Badge tone={row.onHand === 0 ? 'red' : 'amber'} dot>
                        {row.shortfall.toLocaleString()} short
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        {row.dismissed && (
                          <span className="text-[11px] text-slate-400">
                            Dismissed by {row.dismissed.by} · {formatDateTime(row.dismissed.at)}
                          </span>
                        )}
                        {isManager && (
                          <Button size="sm" variant="secondary" disabled={busyId === row.id} onClick={() => act(row.id, Boolean(row.dismissed))}>
                            {row.dismissed ? 'Restore alert' : 'Dismiss'}
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableShell>
            <Pagination {...state.data} noun="alerts" onChange={setPage} />
          </>
        )}
      </Card>

      <p className="mt-3 text-[12px] text-slate-500">
        Dismissing hides an alert until the item recovers. If its total rises above the reorder
        level and later falls back to it, the alert returns on its own.
      </p>
    </div>
  );
}
