import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { categories as categoriesApi, items, locations as locationsApi, movements } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatDateTime, signed } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, ErrorMessage, Input } from '../components/ui.jsx';
import { FullPageSpinner, Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { ItemFormModal } from '../components/ItemFormModal.jsx';
import { MovementFormModal } from '../components/MovementFormModal.jsx';

const MOVEMENT_TONE = { RECEIPT: 'green', ISSUE: 'amber', TRANSFER: 'blue', ADJUSTMENT: 'red' };

export function ItemDetail() {
  const { id } = useParams();
  const { isManager } = useAuth();
  const { refresh: refreshBadge } = useAlerts();

  const [tab, setTab] = useState('movements');
  const [movementPage, setMovementPage] = useState(1);
  const [timelinePage, setTimelinePage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const item = useFetch(() => items.get(id), [id]);
  const stock = useFetch(() => items.stock(id), [id]);
  const history = useFetch(() => movements.list({ itemId: id, page: movementPage, pageSize: 10 }), [id, movementPage]);
  const timeline = useFetch(() => items.timeline(id, { page: timelinePage, pageSize: 10 }), [id, timelinePage]);
  const { data: locationData } = useFetch(() => locationsApi.list(), []);
  const { data: categoryData } = useFetch(() => categoriesApi.list(), []);

  // Going straight from one item to another reuses this component, so its
  // paging and tab would otherwise carry over to an item they do not belong to.
  useEffect(() => {
    setMovementPage(1);
    setTimelinePage(1);
    setTab('movements');
  }, [id]);

  /** A movement changes the item's stock, its history and its standing at once. */
  function reloadAfterMovement() {
    stock.reload();
    history.reload();
    item.reload();
    refreshBadge();
  }

  async function toggleArchive() {
    setActionError(null);
    setBusy(true);
    try {
      await (item.data.item.archivedAt ? items.restore(id) : items.archive(id));
      item.reload();
      timeline.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  if (item.loading && !item.data) return <FullPageSpinner />;
  if (item.error) return <ErrorMessage error={item.error} />;

  const current = item.data.item;
  const archived = Boolean(current.archivedAt);

  return (
    <div className="space-y-4">
      <Link to="/items" className="text-sm text-brand-600 hover:underline">← Back to items</Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{current.sku}</span>
              {archived && <Badge tone="slate">Archived</Badge>}
              {stock.data?.belowReorderLevel && <Badge tone="red">At or below reorder level</Badge>}
            </div>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">{current.name}</h1>
            {current.description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{current.description}</p>}
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div><dt className="inline text-slate-500">Category: </dt><dd className="inline text-slate-800">{current.category.name}</dd></div>
              <div><dt className="inline text-slate-500">Unit: </dt><dd className="inline text-slate-800">{current.unitOfMeasure}</dd></div>
              <div><dt className="inline text-slate-500">Reorder level: </dt><dd className="inline text-slate-800">{current.reorderLevel}</dd></div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            {!archived && <Button onClick={() => setRecording(true)}>Record movement</Button>}
            {isManager && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="secondary" onClick={toggleArchive} disabled={busy}>
                  {archived ? 'Restore' : 'Archive'}
                </Button>
              </>
            )}
          </div>
        </div>

        <ErrorMessage error={actionError} className="mt-3" />
        {archived && (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
            This item is archived. Its history is kept, but no new movements can be recorded
            against it until it is restored.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Stock on hand</h2>
          <span className="text-xs text-slate-500">Summed from the ledger, never stored</span>
        </div>

        {stock.loading && !stock.data ? (
          <div className="py-6 text-center"><Spinner /></div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-slate-900">{stock.data.totalOnHand}</p>
              <p className="text-xs text-slate-500">total {current.unitOfMeasure}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              {stock.data.byLocation.map((row) => (
                <div key={row.location.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-lg font-medium tabular-nums text-slate-900">{row.onHand}</p>
                  <p className="text-xs text-slate-500">{row.location.code}</p>
                </div>
              ))}
              {stock.data.byLocation.length === 0 && (
                <p className="text-sm text-slate-500">No movements recorded yet.</p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
          {[
            ['movements', `Movements${history.data ? ` (${history.data.total})` : ''}`],
            ['timeline', `Timeline${timeline.data ? ` (${timeline.data.total})` : ''}`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                tab === key ? 'bg-white text-brand-700 ring-1 ring-slate-200 ring-b-0' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'movements'
          ? <MovementList state={history} onPage={setMovementPage} />
          : <TimelineList state={timeline} itemId={id} onPage={setTimelinePage} onAdded={timeline.reload} />}
      </Card>

      <MovementFormModal
        open={recording}
        item={current}
        locations={locationData?.locations ?? []}
        onClose={() => setRecording(false)}
        onRecorded={reloadAfterMovement}
      />
      <ItemFormModal
        open={editing}
        item={current}
        categories={categoryData?.categories ?? []}
        onClose={() => setEditing(false)}
        onSaved={() => { item.reload(); timeline.reload(); stock.reload(); refreshBadge(); }}
      />
    </div>
  );
}

/** Full movement history for the item, newest first (goal 3). */
function MovementList({ state, onPage }) {
  if (state.loading && !state.data) return <div className="py-10 text-center"><Spinner /></div>;
  if (state.error) return <ErrorMessage error={state.error} className="m-4" />;
  if (state.data.total === 0) {
    return <EmptyState title="No movements yet">Record a receipt to start this item's ledger.</EmptyState>;
  }

  return (
    <>
      <ul className={`divide-y divide-slate-100 ${state.loading ? 'opacity-40' : ''}`}>
        {state.data.data.map((movement) => (
          <li key={movement.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <Badge tone={MOVEMENT_TONE[movement.kind]}>{movement.kind.toLowerCase()}</Badge>

            <span className="font-medium tabular-nums text-slate-900">
              {movement.kind === 'ISSUE' ? signed(-movement.quantity) : signed(movement.quantity)}
            </span>

            <span className="text-slate-700">
              {movement.kind === 'TRANSFER'
                ? `${movement.sourceLocation.code} → ${movement.destinationLocation.code}`
                : movement.location.code}
            </span>

            {movement.reason && <span className="text-slate-500">“{movement.reason}”</span>}
            {movement.note && <span className="text-slate-500">{movement.note}</span>}

            <span className="ml-auto text-right text-xs text-slate-500">
              {movement.recordedBy.name}
              <span className="block">{formatDateTime(movement.occurredAt)}</span>
            </span>
          </li>
        ))}
      </ul>
      <Pagination {...state.data} onChange={onPage} noun="movements" />
    </>
  );
}

const EVENT_LABEL = {
  CREATED: 'Item created',
  ARCHIVED: 'Archived',
  RESTORED: 'Restored',
  NOTE: 'Note',
  FIELD_CHANGED: 'Changed',
};

/** Creation, field changes and notes, all on one record nobody can edit (goal 9). */
function TimelineList({ state, itemId, onPage, onAdded }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function addNote(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await items.addNote(itemId, note);
      setNote('');
      onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={addNote} className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leave a note about this item…"
          className="flex-1"
          maxLength={2000}
          required
        />
        <Button type="submit" disabled={saving || !note.trim()}>
          {saving ? 'Adding…' : 'Add note'}
        </Button>
      </form>
      <ErrorMessage error={error} className="m-4" />

      {state.loading && !state.data ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : (
        <>
          <ul className={`divide-y divide-slate-100 ${state.loading ? 'opacity-40' : ''}`}>
            {state.data.data.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {EVENT_LABEL[event.type]}
                </span>

                <span className="flex-1 text-slate-700">
                  {event.type === 'NOTE' && event.note}
                  {event.type === 'FIELD_CHANGED' && (
                    <>
                      <span className="font-medium text-slate-900">{event.field}</span>{' '}
                      <span className="text-slate-500 line-through">{event.oldValue || '—'}</span>{' '}
                      → <span className="text-slate-900">{event.newValue || '—'}</span>
                    </>
                  )}
                  {event.type === 'CREATED' && <span className="font-mono text-xs">{event.newValue}</span>}
                </span>

                <span className="text-right text-xs text-slate-500">
                  {event.actor?.name ?? 'Unknown'}
                  <span className="block">{formatDateTime(event.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
          <Pagination {...state.data} onChange={onPage} noun="entries" />
        </>
      )}
    </>
  );
}
