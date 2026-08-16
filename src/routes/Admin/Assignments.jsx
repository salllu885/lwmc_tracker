import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { listAssignments, createAssignment, endAssignment, listUsers } from '../../lib/api/users';
import { listTehsils, listZones, listUcs } from '../../lib/api/orgHierarchy';
import { formatDateTime } from '../../lib/format';

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [zones, setZones] = useState([]);
  const [ucs, setUcs] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ user_id: '', tehsil_id: '', zone_id: '', uc_id: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setAssignments(await listAssignments());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    listUsers().then(setUsers);
    listTehsils().then(setTehsils);
    listZones().then(setZones);
    listUcs().then(setUcs);
  }, []);

  async function handleCreate() {
    setSaving(true);
    setError('');
    try {
      await createAssignment({
        user_id: form.user_id,
        tehsil_id: form.tehsil_id || null,
        zone_id: form.zone_id || null,
        uc_id: form.uc_id || null,
      });
      setCreating(false);
      setForm({ user_id: '', tehsil_id: '', zone_id: '', uc_id: '' });
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  }

  async function handleEnd(a) {
    await endAssignment(a.id);
    await refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Assignments</h3>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-xs font-medium text-amber-700">
          <Plus size={14} /> Add assignment
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No assignments yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="py-2 px-3">User</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Scope</th>
                <th className="py-2 px-3">Since</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="py-2 px-3 text-slate-700">{a.user?.full_name}</td>
                  <td className="py-2 px-3">{a.user?.role}</td>
                  <td className="py-2 px-3">{a.uc?.name || a.zone?.name || a.tehsil?.name}</td>
                  <td className="py-2 px-3">{formatDateTime(a.created_at)}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {a.is_active ? 'Active' : 'Ended'}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {a.is_active && (
                      <button onClick={() => handleEnd(a)} className="text-rose-600 font-medium">
                        End
                      </button>
                    )}
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
                <h4 className="text-sm font-semibold text-slate-700">Add assignment</h4>
                <button onClick={() => setCreating(false)}>
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">User</label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm((s) => ({ ...s, user_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400">
                Fill in only the level that matches the user's role — UC for Surveyer/Supervisor, Zone for ZO, Zone or Tehsil for
                Manager, Tehsil for AC/GM.
              </p>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tehsil</label>
                <select
                  value={form.tehsil_id}
                  onChange={(e) => setForm((s) => ({ ...s, tehsil_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {tehsils.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zone</label>
                <select
                  value={form.zone_id}
                  onChange={(e) => setForm((s) => ({ ...s, zone_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">UC</label>
                <select
                  value={form.uc_id}
                  onChange={(e) => setForm((s) => ({ ...s, uc_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {ucs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                disabled={saving || !form.user_id}
                onClick={handleCreate}
                className="w-full rounded-xl bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-2.5 text-sm hover:bg-slate-800 transition-colors"
              >
                {saving ? 'Saving…' : 'Save assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
