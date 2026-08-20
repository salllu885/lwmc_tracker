import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { getUser, listAssignments, createAssignment, endAssignment, setDefaultUc, setUserActive, setUserAuthority } from '../../lib/api/users';
import { listTehsils, listZones, listUcs, listAuthorityLevels } from '../../lib/api/orgHierarchy';
import { formatDateTime } from '../../lib/format';

// Point B: managing a user's UC/Zone/Tehsil assignments used to live only
// on the flat Admin → Assignments tab, disconnected from the user record
// itself. This gives GM LWMC/AC/DC the same add/remove/default controls
// directly on the person's own profile — same underlying API calls as
// Assignments.jsx, just scoped to one user_id.
export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [zones, setZones] = useState([]);
  const [ucs, setUcs] = useState([]);
  const [authorityLevels, setAuthorityLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tehsil_id: '', zone_id: '', uc_id: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([getUser(id), listAssignments({ userId: id })]);
      setUser(u);
      setAssignments(a);
    } catch (e) {
      setError(e.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    listTehsils().then(setTehsils);
    listZones().then(setZones);
    listUcs().then(setUcs);
  }, [id]);

  // Only meaningful for AREA_MANAGER/ZO-tier users — see 0008_authority_levels.sql.
  useEffect(() => {
    if (!user || (user.role !== 'AREA_MANAGER' && user.role !== 'ZO')) {
      setAuthorityLevels([]);
      return;
    }
    listAuthorityLevels({ roleTier: user.role }).then(setAuthorityLevels);
  }, [user?.role]);

  async function handleToggleActive() {
    await setUserActive(user.id, !user.is_active);
    await refresh();
  }

  async function handleChangeAuthority(authorityId) {
    setError('');
    try {
      await setUserAuthority(user.id, authorityId);
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to change authority level — only an Admin can do this');
    }
  }

  async function handleAdd() {
    setSaving(true);
    setError('');
    try {
      await createAssignment({
        user_id: id,
        tehsil_id: form.tehsil_id || null,
        zone_id: form.zone_id || null,
        uc_id: form.uc_id || null,
      });
      setAdding(false);
      setForm({ tehsil_id: '', zone_id: '', uc_id: '' });
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to add assignment');
    } finally {
      setSaving(false);
    }
  }

  async function handleEnd(a) {
    await endAssignment(a.id);
    await refresh();
  }

  async function handleSetDefault(a) {
    await setDefaultUc(id, a.id);
    await refresh();
  }

  if (loading && !user) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!user) return <p className="text-sm text-rose-600">User not found.</p>;

  return (
    <div className="space-y-4">
      <Link to="/admin/users" className="flex items-center gap-1 text-xs font-medium text-slate-500">
        <ArrowLeft size={14} /> Back to Users
      </Link>

      {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{user.full_name}</h2>
          <button
            onClick={handleToggleActive}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {user.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div>
            <span className="text-slate-400">Username:</span> {user.username}
          </div>
          <div>
            <span className="text-slate-400">Role:</span> {user.role}
          </div>
          <div>
            <span className="text-slate-400">Designation:</span> {user.designation || '—'}
          </div>
          <div>
            <span className="text-slate-400">Phone:</span> {user.phone || '—'}
          </div>
        </div>

        {authorityLevels.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Authority level (controls who they can create)</label>
            <select
              value={user.authority_id || ''}
              onChange={(e) => handleChangeAuthority(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">None (uses default set)</option>
              {authorityLevels.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — can create: {(a.creatable_roles || []).join(', ') || 'nothing'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Assignments</h3>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <Plus size={14} /> Add assignment
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          {assignments.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No assignments yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="py-2 px-3">Scope</th>
                  <th className="py-2 px-3">Since</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Default UC</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="py-2 px-3 text-slate-700">{a.uc?.name || a.zone?.name || a.tehsil?.name}</td>
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
                      {a.uc_id && a.is_active ? (
                        a.is_default ? (
                          <span className="text-[10px] font-semibold text-amber-700">★ Default</span>
                        ) : (
                          <button onClick={() => handleSetDefault(a)} className="text-[10px] font-medium text-slate-400 hover:text-amber-700">
                            Set default
                          </button>
                        )
                      ) : (
                        '—'
                      )}
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
      </div>

      {adding && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setAdding(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 space-y-4">
              <h4 className="text-sm font-semibold text-slate-700">Add assignment for {user.full_name}</h4>
              <p className="text-[11px] text-slate-400">
                Fill in only the level that matches this user's role — UC for Surveyor/Supervisor/Rectifier, Zone for ZO, Tehsil for Area Manager.
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
              <div className="flex gap-2">
                <button onClick={() => setAdding(false)} className="flex-1 rounded-xl border border-slate-300 text-slate-600 font-semibold py-2.5 text-sm">
                  Cancel
                </button>
                <button
                  disabled={saving}
                  onClick={handleAdd}
                  className="flex-1 rounded-xl bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-2.5 text-sm hover:bg-slate-800 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
