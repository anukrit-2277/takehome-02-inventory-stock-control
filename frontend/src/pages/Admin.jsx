import { useState } from 'react';

import { categories as categoriesApi, locations as locationsApi, users as usersApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { Badge, Button, Card, ErrorMessage, Field, Input, Select } from '../components/ui.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { Modal } from '../components/Modal.jsx';

const TABS = [
  ['categories', 'Categories'],
  ['locations', 'Locations'],
  ['users', 'People'],
];

export function Admin() {
  const [tab, setTab] = useState('categories');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">
          Categories, locations, and who is allowed to record movements where
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'categories' && <Categories />}
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
  if (state.loading && !state.data) return <Card className="p-10 text-center"><Spinner /></Card>;
  if (state.error) return <ErrorMessage error={state.error} />;
  return children(state.data);
}

function Categories() {
  const state = useFetch(() => categoriesApi.list(), []);
  const [name, setName] = useState('');
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
        <Card className="p-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); run(async () => { await categoriesApi.create({ name }); setName(''); }); }}
          >
            <div className="flex-1 min-w-56">
              <Field label="New category">
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="e.g. Plumbing" />
              </Field>
            </div>
            <Button type="submit" disabled={busy || !name.trim()}>Add category</Button>
          </form>
          <ErrorMessage error={error} className="mt-3" />
        </Card>

        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.categories.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 font-medium text-slate-900">{category.name}</span>
                <span className="text-slate-500">{category._count.items} item{category._count.items === 1 ? '' : 's'}</span>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    const next = window.prompt('Rename category', category.name);
                    if (next && next !== category.name) run(() => categoriesApi.update(category.id, { name: next }));
                  }}
                >
                  Rename
                </Button>
                {/* The server refuses to delete a category still in use, and
                    says how many items are blocking it. */}
                <Button variant="ghost" disabled={busy} onClick={() => run(() => categoriesApi.remove(category.id))}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </Card>
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
        <Card className="p-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); run(async () => { await locationsApi.create(form); setForm({ code: '', name: '' }); }); }}
          >
            <div className="w-40">
              <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={32} placeholder="SITE-B" /></Field>
            </div>
            <div className="flex-1 min-w-56">
              <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} placeholder="Project Site B" /></Field>
            </div>
            <Button type="submit" disabled={busy}>Add location</Button>
          </form>
          <ErrorMessage error={error} className="mt-3" />
        </Card>

        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.locations.map((location) => (
              <li key={location.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-28 font-mono text-xs text-slate-600">{location.code}</span>
                <span className="flex-1 text-slate-900">{location.name}</span>
                {location.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => locationsApi.update(location.id, { isActive: !location.isActive }))}
                >
                  {location.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
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
          <Button onClick={() => setCreating(true)}>Add person</Button>
        </div>
        <ErrorMessage error={error} />

        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.users.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-40">
                  <span className="font-medium text-slate-900">{person.name}</span>
                  <span className="block text-xs text-slate-500">{person.email}</span>
                </span>

                <Badge tone={person.role === 'MANAGER' ? 'blue' : 'slate'}>
                  {person.role === 'MANAGER' ? 'Manager' : 'Staff'}
                </Badge>
                {!person.isActive && <Badge tone="red">Deactivated</Badge>}

                <span className="flex-1 text-xs text-slate-600">
                  {person.role === 'MANAGER'
                    ? 'Acts at every location'
                    : person.locations.length > 0
                      ? person.locations.map((l) => l.code).join(', ')
                      : 'No locations assigned'}
                </span>

                {person.role !== 'MANAGER' && (
                  <Button variant="ghost" disabled={busy} onClick={() => setAssigning(person)}>Locations</Button>
                )}

                {/* A manager cannot change their own role or active flag — the
                    server refuses it, so the buttons are not offered either. */}
                {person.id !== me.id && (
                  <>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => usersApi.update(person.id, { role: person.role === 'MANAGER' ? 'STAFF' : 'MANAGER' }))}
                    >
                      Make {person.role === 'MANAGER' ? 'staff' : 'manager'}
                    </Button>
                    <Button
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

function NewUserModal({ open, onClose, onSaved }) {
  const blank = { email: '', name: '', password: '', role: 'STAFF' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await usersApi.create(form);
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
        <Field label="Name"><Input value={form.name} onChange={set('name')} required maxLength={120} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Password" hint="At least 8 characters">
          <Input type="password" value={form.password} onChange={set('password')} required minLength={8} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={set('role')}>
            <option value="STAFF">Warehouse staff</option>
            <option value="MANAGER">Inventory manager</option>
          </Select>
        </Field>
        <ErrorMessage error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add person'}</Button>
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
      <p className="text-sm text-slate-600">
        {person.name} can record movements only at the locations ticked here.
      </p>

      <ul className="mt-3 space-y-2">
        {locations.map((location) => (
          <li key={location.id}>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={selected.includes(location.id)}
                onChange={() => toggle(location.id)}
              />
              <span className="font-mono text-xs text-slate-600">{location.code}</span>
              <span>{location.name}</span>
              {!location.isActive && <Badge tone="slate">Inactive</Badge>}
            </label>
          </li>
        ))}
      </ul>

      <ErrorMessage error={error} className="mt-3" />

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save assignments'}</Button>
      </div>
    </Modal>
  );
}
