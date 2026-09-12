import { useState } from 'react';
import { Link } from 'react-router-dom';

import { alerts } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatDateTime } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, ErrorMessage } from '../components/ui.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Low stock alerts</h1>
          <p className="text-sm text-slate-500">
            Items whose total on hand, across every location, is at or below their reorder level
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={includeDismissed}
            onChange={(e) => { setIncludeDismissed(e.target.checked); setPage(1); }}
          />
          Include dismissed
        </label>
      </div>

      <ErrorMessage error={error} />

      <Card className="overflow-hidden">
        {state.loading && !state.data ? (
          <div className="py-12 text-center"><Spinner /></div>
        ) : state.data.total === 0 ? (
          <EmptyState title="Nothing is running low">
            Every active item is above its reorder level.
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`min-w-full divide-y divide-slate-200 text-sm ${state.loading ? 'opacity-40' : ''}`}>
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Item</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Category</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">On hand</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Reorder level</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Short by</th>
                    <th scope="col" className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.data.data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link to={`/items/${row.id}`} className="font-medium text-slate-900 hover:underline">
                          {row.name}
                        </Link>
                        <span className="block font-mono text-xs text-slate-500">{row.sku}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{row.category}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900">{row.onHand}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{row.reorderLevel}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{row.shortfall}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          {row.dismissed && (
                            <Badge tone="slate">
                              Dismissed by {row.dismissed.by} · {formatDateTime(row.dismissed.at)}
                            </Badge>
                          )}
                          {isManager && (
                            <Button
                              variant="secondary"
                              disabled={busyId === row.id}
                              onClick={() => act(row.id, Boolean(row.dismissed))}
                            >
                              {row.dismissed ? 'Restore alert' : 'Dismiss'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...state.data} onChange={setPage} noun="alerts" />
          </>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        Dismissing hides an alert until the item recovers. If its total rises above the reorder
        level and later falls back to it, the alert returns on its own.
      </p>
    </div>
  );
}
