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
  const allowed = useMemo(
    () => (isManager ? locations : locations.filter((l) => user.locationIds.includes(l.id))),
    [locations, isManager, user.locationIds],
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

  return (
    <Modal open={open} title={`Record a movement — ${item.sku}`} onClose={onClose}>
      {allowed.length === 0 ? (
        <p className="text-sm text-slate-600">
          You are not assigned to any location yet, so you cannot record movements. Ask a manager to
          assign you.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Kind" hint={selectedKind?.help}>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </Select>
          </Field>

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
            label={`Quantity${kind === 'ADJUSTMENT' ? '' : ` (${item.unitOfMeasure})`}`}
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Recording…' : 'Record movement'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
