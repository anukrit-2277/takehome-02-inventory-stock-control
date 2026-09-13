import { useEffect, useMemo, useState } from 'react';

import { movements } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Modal } from './Modal.jsx';
import { Button, ErrorMessage, Field, Input, Select, Textarea } from './ui.jsx';

const KINDS = [
  { value: 'RECEIPT', label: 'Receipt', help: 'Stock arriving at a location' },
  { value: 'ISSUE', label: 'Issue', help: 'Stock leaving a location' },
  { value: 'TRANSFER', label: 'Transfer', help: 'Stock moving between two locations' },
  { value: 'ADJUSTMENT', label: 'Adjustment', help: 'Correcting a count, with a reason', managerOnly: true },
];

export function MovementFormModal({ open, item, locations, onClose, onRecorded }) {
  const { user, isManager } = useAuth();

  const [kind, setKind] = useState('RECEIPT');
  const [form, setForm] = useState({ quantity: '', locationId: '', sourceLocationId: '', destinationLocationId: '', reason: '', note: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Staff may only record at the locations assigned to them, which the server
  // enforces; offering the rest would just invite a 403.
  //
  // Defaulted because this runs on every render, including while the dialog is
  // closed: a user object missing locationIds would otherwise take the whole
  // item page down rather than merely showing an empty list.
  const assigned = user.locationIds ?? [];
  const allowed = useMemo(
    () => (isManager ? locations : locations.filter((l) => assigned.includes(l.id))),
    [locations, isManager, assigned],
  );
  // A retired location cannot take new stock, so it is only offered as a source.
  const canReceive = allowed.filter((l) => l.isActive);

  const kinds = KINDS.filter((k) => !k.managerOnly || isManager);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setKind('RECEIPT');
    setForm({
      quantity: '',
      locationId: String(canReceive[0]?.id ?? allowed[0]?.id ?? ''),
      sourceLocationId: String(allowed[0]?.id ?? ''),
      destinationLocationId: String(canReceive[1]?.id ?? canReceive[0]?.id ?? ''),
      reason: '',
      note: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    // Each kind carries only the fields it needs — the same shape the API's
    // discriminated union expects.
    const base = { itemId: item.id, kind, quantity: Number(form.quantity), ...(form.note.trim() ? { note: form.note } : {}) };
    const payload =
      kind === 'TRANSFER'
        ? { ...base, sourceLocationId: Number(form.sourceLocationId), destinationLocationId: Number(form.destinationLocationId) }
        : kind === 'ADJUSTMENT'
          ? { ...base, locationId: Number(form.locationId), reason: form.reason }
          : { ...base, locationId: Number(form.locationId) };

    try {
      await movements.create(payload);
      onRecorded();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const locationOptions = (list) =>
    list.map((l) => (
      <option key={l.id} value={l.id}>
        {l.code} — {l.name}{l.isActive ? '' : ' (inactive)'}
      </option>
    ));

  const selectedKind = kinds.find((k) => k.value === kind);

  // A segmented control reads faster than a dropdown for four fixed choices,
  // and shows all of them at once so staff can see Adjustment is not offered.
  const kindPicker = (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-4">
      {kinds.map((k) => (
        <button
          key={k.value}
          type="button"
          onClick={() => setKind(k.value)}
          aria-pressed={kind === k.value}
          className={`h-7 rounded-md text-[12px] font-medium transition ${
            kind === k.value ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {k.label}
        </button>
      ))}
    </div>
  );

  return (
    <Modal open={open} title={`Record a movement — ${item.sku}`} onClose={onClose}>
      {allowed.length === 0 ? (
        <p className="text-[13px] text-slate-600">
          You are not assigned to any location yet, so you cannot record movements. Ask a manager to
          assign you.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kind</span>
            {kindPicker}
            <span className="mt-1.5 block text-xs text-slate-500">{selectedKind?.help}</span>
            {/* Kept for assistive technology and for the existing tests, which
                address this control by its label. */}
            <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind" className="sr-only">
              {kinds.map((k) => (<option key={k.value} value={k.value}>{k.label}</option>))}
            </Select>
          </div>

          {kind === 'TRANSFER' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From">
                <Select value={form.sourceLocationId} onChange={set('sourceLocationId')} required>
                  {locationOptions(allowed)}
                </Select>
              </Field>
              <Field label="To">
                <Select value={form.destinationLocationId} onChange={set('destinationLocationId')} required>
                  {locationOptions(canReceive)}
                </Select>
              </Field>
            </div>
          ) : (
            <Field label="Location">
              <Select value={form.locationId} onChange={set('locationId')} required>
                {locationOptions(kind === 'RECEIPT' ? canReceive : allowed)}
              </Select>
            </Field>
          )}

          <Field
            label={`Quantity${kind === 'ADJUSTMENT' ? '' : ` (${item.unit.code})`}`}
            hint={kind === 'ADJUSTMENT' ? 'Negative to reduce the count, positive to increase it' : undefined}
          >
            <Input
              type="number"
              value={form.quantity}
              onChange={set('quantity')}
              required
              step="1"
              min={kind === 'ADJUSTMENT' ? undefined : 1}
              placeholder={kind === 'ADJUSTMENT' ? 'e.g. -2' : 'e.g. 25'}
            />
          </Field>

          {kind === 'ADJUSTMENT' && (
            <Field label="Reason" hint="Required — this is the record of why the count changed">
              <Input value={form.reason} onChange={set('reason')} required maxLength={500} placeholder="Cycle count variance" />
            </Field>
          )}

          <Field label="Note (optional)">
            <Textarea value={form.note} onChange={set('note')} rows={2} maxLength={2000} />
          </Field>

          <ErrorMessage error={error} />

          <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Recording…' : 'Record movement'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
