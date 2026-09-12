import { useEffect, useState } from 'react';

import { items } from '../api/endpoints.js';
import { Modal } from './Modal.jsx';
import { Button, ErrorMessage, Field, Input, Select, Textarea } from './ui.jsx';

const EMPTY = { sku: '', name: '', description: '', unitOfMeasure: 'each', reorderLevel: 0, categoryId: '' };

/** Creates a new item, or edits an existing one when `item` is given. */
export function ItemFormModal({ open, item, categories, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? {
            sku: item.sku,
            name: item.name,
            description: item.description ?? '',
            unitOfMeasure: item.unitOfMeasure,
            reorderLevel: item.reorderLevel,
            categoryId: String(item.category?.id ?? item.categoryId ?? ''),
          }
        : { ...EMPTY, categoryId: String(categories[0]?.id ?? '') },
    );
  }, [open, item, categories]);

  const set = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    // The API wants numbers and no empty description, so tidy up here rather
    // than loosening the validation on the server.
    const payload = {
      sku: form.sku,
      name: form.name,
      unitOfMeasure: form.unitOfMeasure,
      reorderLevel: Number(form.reorderLevel),
      categoryId: Number(form.categoryId),
      ...(form.description.trim() ? { description: form.description } : {}),
    };

    try {
      const saved = item ? await items.update(item.id, payload) : await items.create(payload);
      onSaved(saved.item);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={item ? `Edit ${item.sku}` : 'New item'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" hint="Stored upper-case">
            <Input value={form.sku} onChange={set('sku')} required maxLength={64} />
          </Field>
          <Field label="Unit of measure">
            <Input value={form.unitOfMeasure} onChange={set('unitOfMeasure')} required maxLength={32} />
          </Field>
        </div>

        <Field label="Name">
          <Input value={form.name} onChange={set('name')} required maxLength={200} />
        </Field>

        <Field label="Description">
          <Textarea value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={form.categoryId} onChange={set('categoryId')} required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reorder level" hint="Alerts below this total">
            <Input type="number" min="0" value={form.reorderLevel} onChange={set('reorderLevel')} required />
          </Field>
        </div>

        <ErrorMessage error={error} />

        <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : item ? 'Save changes' : 'Create item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
