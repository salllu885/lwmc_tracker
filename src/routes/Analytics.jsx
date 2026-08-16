import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchReportsForAnalytics, summarize, groupCount } from '../lib/api/analytics';
import { listTehsils, listZones, listUcs, listIssueTypes } from '../lib/api/orgHierarchy';
import { listUsers } from '../lib/api/users';
import StatCard from '../components/StatCard';
import { exportCsv, exportExcel, exportPdf } from '../lib/export';
import { ClipboardList, CheckCircle2, TrendingUp, Download } from 'lucide-react';

const STATUSES = ['SUBMITTED', 'PENDING', 'IN_PROGRESS', 'CLOSED', 'REOPENED'];

export default function Analytics() {
  const [reports, setReports] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [zones, setZones] = useState([]);
  const [ucs, setUcs] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [zos, setZos] = useState([]);
  const [surveyers, setSurveyers] = useState([]);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    listTehsils({ activeOnly: true }).then(setTehsils);
    listZones({ activeOnly: true }).then(setZones);
    listUcs({ activeOnly: true }).then(setUcs);
    listIssueTypes({ activeOnly: true }).then(setIssueTypes);
    listUsers({ role: 'SUPERVISOR' }).then(setSupervisors);
    listUsers({ role: 'ZO' }).then(setZos);
    listUsers({ role: 'SURVEYER' }).then(setSurveyers);
  }, []);

  useEffect(() => {
    fetchReportsForAnalytics(filters)
      .then(setReports)
      .catch(() => setReports([]));
  }, [filters]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }

  const summary = summarize(reports);

  const lookup = (list, id) => list.find((x) => x.id === id)?.name;
  const userLookup = (list, id) => list.find((u) => u.id === id)?.full_name || id;

  const byUc = groupCount(reports, 'uc_id', (id) => lookup(ucs, id) || id);
  const byZone = groupCount(reports, 'zone_id', (id) => lookup(zones, id) || id);
  const byTehsil = groupCount(reports, 'tehsil_id', (id) => lookup(tehsils, id) || id);
  const byIssueType = groupCount(reports, 'issue_type_id', (id) => lookup(issueTypes, id) || id);
  const bySupervisor = groupCount(reports, 'assigned_supervisor_id', (id) => userLookup(supervisors, id));
  const byZo = groupCount(reports, 'assigned_zo_id', (id) => userLookup(zos, id));
  const bySurveyer = groupCount(reports, 'reported_by', (id) => userLookup(surveyers, id));

  function handleExport(kind) {
    const rows = byUc.map((r) => ({ UC: r.label, Reported: r.total, Closed: r.closed, Pending: r.pending, 'Closure %': r.closureRate }));
    if (!rows.length) return;
    if (kind === 'csv') exportCsv('reports-by-uc.csv', rows);
    if (kind === 'excel') exportExcel('reports-by-uc.xlsx', rows, 'By UC');
    if (kind === 'pdf') {
      exportPdf(
        'reports-by-uc.pdf',
        'Reports by UC',
        ['UC', 'Reported', 'Closed', 'Pending', 'Closure %'],
        rows.map((r) => Object.values(r))
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-900">Analytics</h2>
        <div className="flex gap-3">
          <button onClick={() => handleExport('csv')} className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <Download size={12} /> CSV
          </button>
          <button onClick={() => handleExport('excel')} className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <Download size={12} /> Excel
          </button>
          <button onClick={() => handleExport('pdf')} className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <Download size={12} /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
        <select onChange={(e) => updateFilter('tehsilId', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">All tehsils</option>
          {tehsils.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select onChange={(e) => updateFilter('zoneId', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <select onChange={(e) => updateFilter('ucId', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">All UCs</option>
          {ucs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select onChange={(e) => updateFilter('issueTypeId', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">All issue types</option>
          {issueTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select onChange={(e) => updateFilter('status', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total reports" value={summary.total} icon={<ClipboardList size={16} />} />
        <StatCard label="Pending" value={summary.pending} icon={<ClipboardList size={16} />} tone="amber" />
        <StatCard label="In progress" value={summary.inProgress} icon={<TrendingUp size={16} />} />
        <StatCard label="Closure rate" value={`${summary.closureRate}%`} icon={<CheckCircle2 size={16} />} tone="emerald" />
      </div>

      <ChartCard title="Reports by issue type">
        {byIssueType.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byIssueType} dataKey="total" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {byIssueType.map((d, i) => (
                  <Cell key={i} fill={issueTypes.find((t) => t.id === d.key)?.color || '#64748B'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyNote />
        )}
      </ChartCard>

      <ChartCard title="Reported vs closed by UC">
        {byUc.length ? (
          <ResponsiveContainer width="100%" height={Math.max(180, byUc.length * 28)}>
            <BarChart data={byUc} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" name="Reported" fill="#CBD5E1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="closed" name="Closed" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyNote />
        )}
      </ChartCard>

      <PerformanceTable title="Zone performance" rows={byZone} />
      <PerformanceTable title="Tehsil performance" rows={byTehsil} />
      <PerformanceTable title="Supervisor performance" rows={bySupervisor} />
      <PerformanceTable title="ZO performance" rows={byZo} />
      <PerformanceTable title="Surveyer performance" rows={bySurveyer} />
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyNote() {
  return <p className="text-sm text-slate-400">No data for this filter.</p>;
}

function PerformanceTable({ title, rows }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 uppercase tracking-wide">
              <th className="py-1 pr-2">Name</th>
              <th className="py-1 pr-2 text-right">Assigned</th>
              <th className="py-1 pr-2 text-right">Closed</th>
              <th className="py-1 pr-2 text-right">Pending</th>
              <th className="py-1 text-right">Closure %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-100">
                <td className="py-1.5 pr-2 text-slate-700">{r.label}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.total}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.closed}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.pending}</td>
                <td className="py-1.5 text-right tabular-nums">{r.closureRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
