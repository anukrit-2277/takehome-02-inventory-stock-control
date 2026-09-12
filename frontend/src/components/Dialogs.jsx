import { useEffect, useState } from 'react';

import { Modal } from './Modal.jsx';
import { Button, ErrorMessage, Field, Input } from './ui.jsx';
import { IconAlert } from './Icons.jsx';

/**
 * Replacements for window.confirm and window.prompt.
 *
 * The native ones are drawn by the browser, ignore the design entirely, and
 * cannot show a server error — so a failed action would close the dialog and
 * report the problem somewhere else on the page. Both of these keep themselves
 * open on failure and show the reason where the user is already looking.
 */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  onConfirm,
  onClose,
}) {
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function confirm() {
    setError(null);
    setWorking(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose} width="max-w-md">
      <div className="flex gap-3.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          <IconAlert className="h-4.5 w-4.5" />
        </span>
        <p className="pt-1 text-[13px] leading-relaxed text-slate-600">{description}</p>
      </div>

      <ErrorMessage error={error} className="mt-3" />

      <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={confirm} disabled={working}>
          {working ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  maxLength,
  onConfirm,
  onClose,
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);

  // Seed the field each time the dialog opens, so it never shows the previous
  // subject's value.
  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setWorking(true);
    try {
      await onConfirm(value.trim());
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setWorking(false);
    }
  }

  const unchanged = value.trim() === initialValue.trim();

  return (
    <Modal open={open} title={title} onClose={onClose} width="max-w-md">
      <form onSubmit={submit}>
        <Field label={label}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            required
            autoFocus
          />
        </Field>

        <ErrorMessage error={error} className="mt-3" />

        <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={working || !value.trim() || unchanged}>
            {working ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
