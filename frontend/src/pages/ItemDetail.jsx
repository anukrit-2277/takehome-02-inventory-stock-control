import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { categories as categoriesApi, units as unitsApi, items, locations as locationsApi, movements } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatDateTime } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, ErrorMessage, Input, PanelHeader } from '../components/ui.jsx';
import { FullPageSpinner, Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { ItemFormModal } from '../components/ItemFormModal.jsx';
import { MovementFormModal } from '../components/MovementFormModal.jsx';
import {
  IconArchive, IconChevronLeft, IconEdit, IconMovements, IconNote, IconPlus,
} from '../components/Icons.jsx';

const KINDS = {
  RECEIPT: { tone: 'green', label: 'Receipt' },
  ISSUE: { tone: 'amber', label: 'Issue' },
  TRANSFER: { tone: 'blue', label: 'Transfer' },
  ADJUSTMENT: { tone: 'red', label: 'Adjustment' },
};

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
  const { data: unitData } = useFetch(() => unitsApi.list(), []);

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
  const total = stock.data?.totalOnHand ?? 0;
  const critical = stock.data && total === 0;
  const low = stock.data?.belowReorderLevel && !critical;

  return (
    <div>
      <Link
        to="/items"
        className="mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 transition hover:text-slate-900"
      >
        <IconChevronLeft className="h-3.5 w-3.5" />
        Back to items
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{current.sku}</span>
              <Badge tone="neutral">{current.category.name}</Badge>
              {archived && <Badge tone="slate">Archived</Badge>}
              {critical && <Badge tone="red" dot>Out of stock</Badge>}
              {low && <Badge tone="amber" dot>At or below reorder level</Badge>}
            </div>

            <h1 className="mt-2 text-[19px] font-semibold tracking-tight text-slate-900">{current.name}</h1>
            {current.description && <p className="mt-1 max-w-2xl text-[13px] text-slate-500">{current.description}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {!archived && (
              <Button onClick={() => setRecording(true)}>
                <IconPlus className="h-4 w-4" />
                Record movement
              </Button>
            )}
            {isManager && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <IconEdit className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="secondary" onClick={toggleArchive} disabled={busy}>
                  <IconArchive className="h-4 w-4" />
                  {archived ? 'Restore' : 'Archive'}
                </Button>
              </>
            )}
          </div>
        </div>

        {actionError && <div className="px-5 pb-4"><ErrorMessage error={actionError} /></div>}

        {archived && (
          <p className="border-t border-slate-200/80 bg-slate-50 px-5 py-2.5 text-[12px] text-slate-600">
            This item is archived. Its history is kept, but no new movements can be recorded
            against it until it is restored.
          </p>
        )}

        {/* Stock strip: the total, then the same figure split by location. */}
        <div className="flex flex-wrap items-stretch gap-px border-t border-slate-200/80 bg-slate-200/80">
          <div className="flex min-w-44 flex-col justify-center bg-white px-5 py-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total on hand</span>
            {stock.loading && !stock.data ? (
              <Spinner className="mt-2 h-5 w-5" />
            ) : (
              <span className={`mt-1 text-[28px] font-semibold leading-none tracking-tight ${critical ? 'text-rose-600' : low ? 'text-amber-600' : 'text-slate-900'}`}>
                {total.toLocaleString()}
                <span className="ml-1.5 text-[12px] font-normal text-slate-400">{current.unit.code}</span>
              </span>
            )}
            <span className="mt-1.5 text-[11px] text-slate-400">Reorder at {current.reorderLevel.toLocaleString()}</span>
          </div>

          {(stock.data?.byLocation ?? []).map((row) => (
            <div key={row.location.id} className="flex min-w-32 flex-1 flex-col justify-center bg-white px-4 py-4">
              <span className="font-mono text-[11px] text-slate-400">{row.location.code}</span>
              <span className="mt-1 text-[18px] font-semibold leading-none text-slate-800 tnum">
                {row.onHand.toLocaleString()}
              </span>
              <span className="mt-1.5 truncate text-[11px] text-slate-400">{row.location.name}</span>
            </div>
          ))}

          {stock.data?.byLocation.length === 0 && (
            <div className="flex flex-1 items-center bg-white px-5 py-4 text-[13px] text-slate-400">
              No movements recorded yet.
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="flex gap-6 border-b border-slate-200/80 px-4">
          {[
            ['movements', `Movements${history.data ? ` (${history.data.total})` : ''}`],
            ['timeline', `Timeline${timeline.data ? ` (${timeline.data.total})` : ''}`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 py-2.5 text-[13px] font-medium transition ${
                tab === key
                  ? 'border-brand-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
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
        units={unitData?.units ?? []}
        onClose={() => setEditing(false)}
        onSaved={() => { item.reload(); timeline.reload(); stock.reload(); refreshBadge(); }}
      />
    </div>
  );
}

/** Full movement history for the item, newest first (goal 3). */
function MovementList({ state, onPage }) {
  if (state.loading && !state.data) return <div className="py-12 text-center"><Spinner /></div>;
  if (state.error) return <ErrorMessage error={state.error} className="m-4" />;
  if (state.data.total === 0) {
    return <EmptyState title="No movements yet" icon={IconMovements}>Record a receipt to start this item's ledger.</EmptyState>;
  }

  return (
    <>
      <ul className={`divide-y divide-slate-100 transition-opacity ${state.loading ? 'opacity-40' : ''}`}>
        {state.data.data.map((movement) => {
          const kind = KINDS[movement.kind];
          const delta = movement.kind === 'ISSUE' ? -movement.quantity : movement.quantity;
          return (
            <li key={movement.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[13px] transition-colors hover:bg-slate-50">
              <Badge tone={kind.tone}>{kind.label}</Badge>

              <span className={`w-16 text-right font-semibold tnum ${delta < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {delta > 0 ? '+' : ''}{delta.toLocaleString()}
              </span>

              <span className="font-mono text-[12px] text-slate-600">
                {movement.kind === 'TRANSFER' ? (
                  <span className="inline-flex items-center gap-1.5">
                    {movement.sourceLocation.code}
                    <span className="text-slate-300">→</span>
                    {movement.destinationLocation.code}
                  </span>
                ) : movement.location.code}
              </span>

              {movement.reason && <span className="italic text-slate-500">“{movement.reason}”</span>}
              {movement.note && <span className="text-slate-500">{movement.note}</span>}

              <span className="ml-auto text-right">
                <span className="block text-[12px] text-slate-600">{movement.recordedBy.name}</span>
                <span className="block text-[11px] text-slate-400 tnum">{formatDateTime(movement.occurredAt)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <Pagination {...state.data} onChange={onPage} noun="movements" />
    </>
  );
}

const EVENT_LABEL = {
  CREATED: 'Created',
  ARCHIVED: 'Archived',
  RESTORED: 'Restored',
  NOTE: 'Note',
  FIELD_CHANGED: 'Changed',
};
const EVENT_TONE = {
  CREATED: 'green', ARCHIVED: 'slate', RESTORED: 'blue', NOTE: 'neutral', FIELD_CHANGED: 'neutral',
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
      <form onSubmit={addNote} className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leave a note about this item…"
          className="flex-1"
          maxLength={2000}
          required
        />
        <Button type="submit" disabled={saving || !note.trim()}>
          <IconNote className="h-4 w-4" />
          {saving ? 'Adding…' : 'Add note'}
        </Button>
      </form>
      <ErrorMessage error={error} className="m-4" />

      {state.loading && !state.data ? (
        <div className="py-12 text-center"><Spinner /></div>
      ) : (
        <>
          <ul className={`divide-y divide-slate-100 transition-opacity ${state.loading ? 'opacity-40' : ''}`}>
            {state.data.data.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-[13px] transition-colors hover:bg-slate-50">
                <span className="w-24 shrink-0">
                  <Badge tone={EVENT_TONE[event.type]}>{EVENT_LABEL[event.type]}</Badge>
                </span>

                <span className="flex-1 text-slate-700">
                  {event.type === 'NOTE' && event.note}
                  {event.type === 'FIELD_CHANGED' && (
                    <>
                      <span className="font-medium text-slate-900">{event.field}</span>{' '}
                      <span className="text-slate-400 line-through">{event.oldValue || '—'}</span>
                      <span className="mx-1 text-slate-300">→</span>
                      <span className="font-medium text-slate-900">{event.newValue || '—'}</span>
                    </>
                  )}
                  {event.type === 'CREATED' && <span className="font-mono text-[12px] text-slate-500">{event.newValue}</span>}
                </span>

                <span className="text-right">
                  <span className="block text-[12px] text-slate-600">{event.actor?.name ?? 'Unknown'}</span>
                  <span className="block text-[11px] text-slate-400 tnum">{formatDateTime(event.createdAt)}</span>
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
