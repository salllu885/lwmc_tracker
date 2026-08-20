import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, Search } from 'lucide-react';
import { listReports } from '../lib/api/reports';
import { listTehsils, listZones, listUcs, listIssueTypes } from '../lib/api/orgHierarchy';
import ReportRow from '../components/ReportRow';

const STATUSES = ['SUBMITTED', 'PENDING', 'IN_PROGRESS', 'CLOSED', 'REOPENED'];

export default function ReportsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tehsils, setTehsils] = useState([]);
  const [zones, setZones] = useState([]);
  const [ucs, setUcs] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [search, setSearch] = useState('');

  const status = searchParams.get('status') || '';
  const tehsilId = searchParams.get('tehsil') || '';
  const zoneId = searchParams.get('zone') || '';
  const ucId = searchParams.get('uc') || '';
  const issueTypeId = searchParams.get('issue') || '';
  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';

  useEffect(() => {
    listTehsils({ activeOnly: true }).then(setTehsils);
    listIssueTypes({ activeOnly: true }).then(setIssueTypes);
  }, []);

  useEffect(() => {
    listZones({ tehsilId: tehsilId || undefined, activeOnly: true }).then(setZones);
  }, [tehsilId]);

  useEffect(() => {
    listUcs({ zoneId: zoneId || undefined, tehsilId: tehsilId || undefined, activeOnly: true }).then(setUcs);
  }, [zoneId, tehsilId]);

  useEffect(() => {
    setLoading(true);
    listReports({
      status: status || undefined,
      tehsilId: tehsilId || undefined,
      zoneId: zoneId || undefined,
      ucId: ucId || undefined,
      issueTypeId: issueTypeId || undefined,
      search: search || undefined,
    })
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [status, tehsilId, zoneId, ucId, issueTypeId, search]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'tehsil') {
      next.delete('zone');
      next.delete('uc');
    }
    if (key === 'zone') next.delete('uc');
    setSearchParams(next);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Reports</h2>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search report ID or address…"
            className="flex-1 text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-slate-400" />
          <select value={status} onChange={(e) => updateParam('status', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <select value={tehsilId} onChange={(e) => updateParam('tehsil', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            <option value="">All tehsils</option>
            {tehsils.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={zoneId} onChange={(e) => updateParam('zone', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select value={ucId} onChange={(e) => updateParam('uc', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono">
            <option value="">All UCs</option>
            {ucs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select value={issueTypeId} onChange={(e) => updateParam('issue', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            <option value="">All issue types</option>
            {issueTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
          No reports match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} onClick={() => navigate(`/reports/${r.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
