import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { listUsers, createUser, setUserActive } from '../../lib/api/users';

// Role is a permission tier, not a job title — ADMIN covers DC/CO MCL/GM
// LWMC/WASA, AREA_MANAGER covers AC/GM/TM/Manager. The actual title goes in
// the free-text Designation field below, not a separate role value.
const ROLES = ['ADMIN', 'AREA_MANAGER', 'ZO', 'SUPERVISOR', 'SURVEYOR', 'RECTIFIER'];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', fullName: '', phone: '', role: 'SURVEYOR', designation: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setSaving(true);
    setError('');
    try {
      await createUser(form);
      setCreating(false);
      setForm({ username: '', fullName: '', phone: '', role: 'SURVEYOR', designation: '', password: '' });
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(u) {
    await setUserActive(u.id, !u.is_active);
    await refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Users</h3>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-xs font-medium text-amber-700">
          <Plus size={14} /> Add user
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Username</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Designation</th>
                <th className="py-2 px-3">Phone</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2 px-3 text-slate-700">{u.full_name}</td>
                  <td className="py-2 px-3 font-mono">{u.username}</td>
                  <td className="py-2 px-3">{u.role}</td>
                  <td className="py-2 px-3">{u.designation || '—'}</td>
                  <td className="py-2 px-3">{u.phone || '—'}</td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => handleToggle(u)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setCreating(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Add user</h4>
                <button onClick={() => setCreating(false)}>
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
              <Field label="Full name" value={form.fullName} onChange={(v) => setForm((s) => ({ ...s, fullName: v }))} />
              <Field label="Username" value={form.username} onChange={(v) => setForm((s) => ({ ...s, username: v }))} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Designation (e.g. AC, GM LWMC, WASA, Zone Officer)"
                value={form.designation}
                onChange={(v) => setForm((s) => ({ ...s, designation: v }))}
              />
              <Field label="Temporary password" value={form.password} onChange={(v) => setForm((s) => ({ ...s, password: v }))} type="password" />
              <p className="text-[11px] text-slate-400">
                After creating the user, assign them to a UC/Zone/Tehsil under the Assignments tab.
              </p>
              <button
                disabled={saving}
                onClick={handleCreate}
                className="w-full rounded-xl bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-2.5 text-sm hover:bg-slate-800 transition-colors"
              >
                {saving ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </div>
  );
}
