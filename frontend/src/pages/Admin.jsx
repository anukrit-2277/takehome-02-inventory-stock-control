import { useState } from 'react';

import {
  categories as categoriesApi,
  locations as locationsApi,
  units as unitsApi,
  users as usersApi,
} from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { Badge, Button, Card, Checkbox, ErrorMessage, Field, Input, PanelHeader, Select } from '../components/ui.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { IconPlus } from '../components/Icons.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { Modal } from '../components/Modal.jsx';
import { ConfirmDialog, PromptDialog } from '../components/Dialogs.jsx';

const TABS = [
  ['categories', 'Categories'],
  ['units', 'Units'],
  ['locations', 'Locations'],
  ['users', 'People'],
];

export function Admin() {
  const [tab, setTab] = useState('categories');

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Categories, locations, and who is allowed to record movements where"
      />

      <div className="mb-4 flex gap-6 border-b border-slate-200">
        {TABS.map(([key, label]) => (
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

      {tab === 'categories' && <Categories />}
      {tab === 'units' && <Units />}
      {tab === 'locations' && <Locations />}
      {tab === 'users' && <Users />}
    </div>
  );
}

/**
 * Loading and error states for the small panels below.
 *
 * `children` is a function, not markup. Passed as plain JSX children the markup
 * would be built before this component could run its guards — reading
 * state.data while it is still null — so the panel takes a function and calls
 * it only once there is data.
 */
function Panel({ state, children }) {
  if (state.loading && !state.data) return <Card className="p-12 text-center"><Spinner /></Card>;
  if (state.error) return <ErrorMessage error={state.error} />;
  return children(state.data);
}

function Categories() {
  const state = useFetch(() => categoriesApi.list(), []);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // The category each dialog is acting on, or null when it is closed.
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try { await fn(); state.reload(); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Panel state={state}>
      {(data) => (
      <div className="space-y-4">
        <Card>
          <PanelHeader title="Add a category" description="Items must belong to one of these" />
          <form
            className="flex flex-wrap items-end gap-2 p-4"
            onSubmit={(e) => { e.preventDefault(); run(async () => { await categoriesApi.create({ name }); setName(''); }); }}
          >
            <div className="min-w-56 flex-1">
              <Field label="New category">
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="e.g. Plumbing" />
              </Field>
            </div>
            <Button type="submit" disabled={busy || !name.trim()}>
              <IconPlus className="h-4 w-4" />
              Add category
            </Button>
            <ErrorMessage error={error} className="w-full" />
          </form>
        </Card>

        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.categories.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50">
                <span className="flex-1 font-medium text-slate-900">{category.name}</span>
                <Badge tone="neutral">{category._count.items} item{category._count.items === 1 ? '' : 's'}</Badge>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRenaming(category)}>
                  Rename
                </Button>
                {/* The server refuses to delete a category still in use, and
                    says how many items are blocking it — the dialog stays open
                    to show that reason. */}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  className="hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setDeleting(category)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        {renaming && (
        <PromptDialog
          open
          title="Rename category"
          label="Category name"
          initialValue={renaming.name}
          maxLength={80}
          confirmLabel="Rename"
          onClose={() => setRenaming(null)}
          onConfirm={async (next) => {
            await categoriesApi.update(renaming.id, { name: next });
            state.reload();
          }}
        />
        )}

        {deleting && (
        <ConfirmDialog
          open
          title="Delete category"
          description={`Delete "${deleting.name}"? This cannot be undone. A category still used by any item cannot be deleted.`}
          confirmLabel="Delete category"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await categoriesApi.remove(deleting.id);
            state.reload();
          }}
        />
        )}
      </div>
      )}
    </Panel>
  );
}

/** Units are a maintained list for the same reason categories are (goal 2). */
function Units() {
  const state = useFetch(() => unitsApi.list(), []);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try { await fn(); state.reload(); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Panel state={state}>
      {(data) => (
      <div className="space-y-4">
        <Card>
          <PanelHeader
            title="Add a unit"
            description="What item quantities are counted in — each, box, metre"
          />
          <form
            className="flex flex-wrap items-end gap-2 p-4"
            onSubmit={(e) => { e.preventDefault(); run(async () => { await unitsApi.create({ code }); setCode(''); }); }}
          >
            <div className="min-w-56 flex-1">
              <Field label="New unit">
                <Input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={32} placeholder="e.g. pallet" />
              </Field>
            </div>
            <Button type="submit" disabled={busy || !code.trim()}>
              <IconPlus className="h-4 w-4" />
              Add unit
            </Button>
            <ErrorMessage error={error} className="w-full" />
          </form>
        </Card>

        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.units.map((unit) => (
              <li key={unit.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50">
                <span className="flex-1 font-medium text-slate-900">{unit.code}</span>
                <Badge tone="neutral">{unit._count.items} item{unit._count.items === 1 ? '' : 's'}</Badge>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRenaming(unit)}>
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  className="hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setDeleting(unit)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[12px] text-slate-500">
            Renaming a unit changes how it reads everywhere it is used. An item's unit cannot be
            changed once movements have been recorded against it.
          </p>
        </Card>

        {renaming && (
        <PromptDialog
          open
          title="Rename unit"
          label="Unit"
          initialValue={renaming.code}
          maxLength={32}
          confirmLabel="Rename"
          onClose={() => setRenaming(null)}
          onConfirm={async (next) => { await unitsApi.update(renaming.id, { code: next }); state.reload(); }}
        />
        )}

        {deleting && (
        <ConfirmDialog
          open
          title="Delete unit"
          description={`Delete "${deleting.code}"? This cannot be undone. A unit still used by any item cannot be deleted.`}
          confirmLabel="Delete unit"
          onClose={() => setDeleting(null)}
          onConfirm={async () => { await unitsApi.remove(deleting.id); state.reload(); }}
        />
        )}
      </div>
      )}
    </Panel>
  );
}

function Locations() {
  const state = useFetch(() => locationsApi.list(), []);
  const [form, setForm] = useState({ code: '', name: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try { await fn(); state.reload(); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Panel state={state}>
      {(data) => (
      <div className="space-y-4">
        <Card>
          <PanelHeader title="Add a location" description="Locations are never deleted, only deactivated" />
          <form
            className="flex flex-wrap items-end gap-2 p-4"
            onSubmit={(e) => { e.preventDefault(); run(async () => { await locationsApi.create(form); setForm({ code: '', name: '' }); }); }}
          >
            <div className="w-40">
              <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={32} placeholder="SITE-B" /></Field>
            </div>
            <div className="flex-1 min-w-56">
              <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} placeholder="Project Site B" /></Field>
            </div>
            <Button type="submit" disabled={busy}>
              <IconPlus className="h-4 w-4" />
              Add location
            </Button>
            <ErrorMessage error={error} className="w-full" />
          </form>
        </Card>

        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.locations.map((location) => (
              <li key={location.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50">
                <span className="w-28 font-mono text-[12px] text-slate-500">{location.code}</span>
                <span className="flex-1 font-medium text-slate-900">{location.name}</span>
                {location.isActive ? <Badge tone="green" dot>Active</Badge> : <Badge tone="slate" dot>Inactive</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => locationsApi.update(location.id, { isActive: !location.isActive }))}
                >
                  {location.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[12px] text-slate-500">
            Locations are never deleted — they appear in movements that must keep their meaning.
            A deactivated location takes no new stock but can still be emptied.
          </p>
        </Card>
      </div>
      )}
    </Panel>
  );
}

function Users() {
  const { user: me } = useAuth();
  const state = useFetch(() => usersApi.list(), []);
  const { data: locationData } = useFetch(() => locationsApi.list(), []);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try { await fn(); state.reload(); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Panel state={state}>
      {(data) => (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <IconPlus className="h-4 w-4" />
            Add person
          </Button>
        </div>
        <ErrorMessage error={error} />

        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.users.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">
                  {person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </span>
                <span className="min-w-40">
                  <span className="font-medium text-slate-900">{person.name}</span>
                  <span className="block text-[11px] text-slate-500">{person.email}</span>
                </span>

                <Badge tone={person.role === 'MANAGER' ? 'blue' : 'slate'}>
                  {person.role === 'MANAGER' ? 'Manager' : 'Staff'}
                </Badge>
                {!person.isActive && <Badge tone="red">Deactivated</Badge>}

                <span className="flex-1 font-mono text-[11px] text-slate-500">
                  {person.role === 'MANAGER'
                    ? 'Acts at every location'
                    : person.locations.length > 0
                      ? person.locations.map((l) => l.code).join(', ')
                      : 'No locations assigned'}
                </span>

                {person.role !== 'MANAGER' && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAssigning(person)}>Locations</Button>
                )}

                {/* A manager cannot change their own role or active flag — the
                    server refuses it, so the buttons are not offered either. */}
                {person.id !== me.id && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => usersApi.update(person.id, { role: person.role === 'MANAGER' ? 'STAFF' : 'MANAGER' }))}
                    >
                      Make {person.role === 'MANAGER' ? 'staff' : 'manager'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => usersApi.update(person.id, { isActive: !person.isActive }))}
                    >
                      {person.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <NewUserModal open={creating} onClose={() => setCreating(false)} onSaved={state.reload} />
        <AssignmentsModal
          person={assigning}
          locations={locationData?.locations ?? []}
          onClose={() => setAssigning(null)}
          onSaved={state.reload}
        />
      </div>
      )}
    </Panel>
  );
}

// Mirrors the server's rules in users.schemas.js. Shown live so the person
// filling the form can see what is still missing, instead of submitting and
// being told afterwards. The server remains the thing that actually decides.
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
  { label: 'A symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function NewUserModal({ open, onClose, onSaved }) {
  const blank = { email: '', name: '', password: '', confirmPassword: '', role: 'STAFF' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const met = PASSWORD_RULES.map((rule) => rule.test(form.password));
  const passwordStrong = met.every(Boolean);
  const retyped = form.confirmPassword.length > 0;
  const passwordsMatch = form.password === form.confirmPassword;
  // Mirrors personName in users.schemas.js: starts with a letter, then letters,
  // spaces, hyphens, apostrophes and full stops only. No digits.
  const trimmedName = form.name.trim();
  const nameValid = trimmedName.length >= 2 && /^\p{L}[\p{L}\p{M}\s'.-]*$/u.test(trimmedName);
  const nameError = form.name.length === 0
    ? undefined
    : !/^\p{L}/u.test(trimmedName)
      ? 'Name must start with a letter'
      : !/^[\p{L}\p{M}\s'.-]+$/u.test(trimmedName)
        ? 'Name can only contain letters, spaces, hyphens and apostrophes'
        : trimmedName.length < 2
          ? 'Name must be at least 2 characters'
          : undefined;

  const canSubmit = passwordStrong && retyped && passwordsMatch && nameValid;

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // confirmPassword is a form-only field; the API never receives it.
      const { confirmPassword, ...payload } = form;
      await usersApi.create(payload);
      setForm(blank);
      onSaved();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Add a person" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Name"
          error={nameError}
          hint={nameError ? undefined : 'Letters, spaces, hyphens and apostrophes'}
        >
          <Input value={form.name} onChange={set('name')} required maxLength={120} placeholder="Priya Raman" />
        </Field>

        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} required placeholder="person@company.com" />
        </Field>

        <div>
          <Field label="Password">
            <Input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
          </Field>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {PASSWORD_RULES.map((rule, index) => (
              <li
                key={rule.label}
                className={`flex items-center gap-1.5 text-[11px] ${met[index] ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] ${
                    met[index] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-transparent'
                  }`}
                >
                  ✓
                </span>
                {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <Field
          label="Retype password"
          error={retyped && !passwordsMatch ? 'Passwords do not match' : undefined}
        >
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            required
            autoComplete="new-password"
          />
        </Field>

        <Field label="Role">
          <Select value={form.role} onChange={set('role')}>
            <option value="STAFF">Warehouse staff</option>
            <option value="MANAGER">Inventory manager</option>
          </Select>
        </Field>

        <ErrorMessage error={error} />

        <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !canSubmit}>
            {saving ? 'Adding…' : 'Add person'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Goal 5: a manager decides which locations a staff member covers. */
function AssignmentsModal({ person, locations, onClose, onSaved }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  // Seed the checkboxes the first time this person's dialog opens.
  if (person && loadedFor !== person.id) {
    setLoadedFor(person.id);
    setSelected(person.locations.map((l) => l.id));
  }

  const toggle = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await usersApi.setLocations(person.id, selected);
      onSaved();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (!person) return null;

  return (
    <Modal open title={`Locations for ${person.name}`} onClose={onClose}>
      <p className="text-[13px] text-slate-600">
        {person.name} can record movements only at the locations ticked here.
      </p>

      <ul className="mt-3 space-y-1">
        {locations.map((location) => (
          <li key={location.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-slate-800 transition hover:bg-slate-50">
              <Checkbox checked={selected.includes(location.id)} onChange={() => toggle(location.id)} />
              <span className="font-mono text-[11px] text-slate-500">{location.code}</span>
              <span className="font-medium">{location.name}</span>
              {!location.isActive && <Badge tone="slate">Inactive</Badge>}
            </label>
          </li>
        ))}
      </ul>

      <ErrorMessage error={error} className="mt-3" />

      <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save assignments'}</Button>
      </div>
    </Modal>
  );
}
