import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

// One reusable list+modal CRUD component for Tehsils/Zones/UCs/Issue Types —
// they all share the same admin shape (requirements doc §25): a list with
// an active/inactive toggle, and an add/edit form.
export default function EntityTable({ title, columns, fields, list, onCreate, onUpdate, onToggleActive }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    const initial = {};
    fields.forEach((f) => {
      initial[f.key] = f.default ?? '';
    });
    setForm(initial);
    setError('');
    setEditing({});
  }

  function openEdit(row) {
    setForm({ ...row });
    setError('');
    setEditing(row);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (editing && editing.id) {
        await onUpdate(editing.id, form);
      } else {
        await onCreate(form);
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(row) {
    await onToggleActive(row.id, !row.is_active);
    await refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <button onClick={openCreate} className="flex items-center gap-1 text-xs font-medium text-amber-700">
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No records yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wide border-b border-slate-100">
                {columns.map((c) => (
                  <th key={c.key} className="py-2 px-3">
                    {c.label}
                  </th>
                ))}
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className="py-2 px-3 text-slate-700">
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                  <td className="py-2 px-3">
                    <button
                      onClick={() => handleToggle(row)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => openEdit(row)} className="text-amber-700 font-medium">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">
                  {editing.id ? 'Edit' : 'Add'} {title}
                </h4>
                <button onClick={() => setEditing(null)}>
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select…</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  )}
                </div>
              ))}
              <button
                disabled={saving}
                onClick={handleSave}
                className="w-full rounded-xl bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-2.5 text-sm hover:bg-slate-800 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
