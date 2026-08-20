import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../lib/auth';
import { listReports } from '../lib/api/reports';
import { fetchReportsForAnalytics, groupCount } from '../lib/api/analytics';
import { listTehsils, listIssueTypes } from '../lib/api/orgHierarchy';
import { listAssignments } from '../lib/api/users';
import StatCard from '../components/StatCard';
import ReportRow from '../components/ReportRow';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

// Monday-first week start, to match the rest of the app's calendar (see
// Attendance.jsx's buildCells).
function periodStart(key) {
  const now = new Date();
  if (key === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === 'week') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return d;
  }
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

// Roles whose RLS scope already spans multiple Tehsils, so a Home-page
// scope selector is meaningful. ZO/Supervisor/Surveyor/Rectifier are pinned
// to their own Zone/UC by RLS regardless of what this page filters by.
const SCOPE_ROLES = ['ADMIN', 'AREA_MANAGER'];

export default function Home() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('week');
  const [tehsils, setTehsils] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [tehsilId, setTehsilId] = useState('');
  const [statsReports, setStatsReports] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  // AREA_MANAGER (AC/Town Manager) defaults to their own Tehsil even though
  // RLS lets them view the whole district — ADMIN defaults to district-wide.
  useEffect(() => {
    if (role !== 'AREA_MANAGER' || !profile) return;
    listAssignments({ userId: profile.id }).then((rows) => {
      const t = rows.find((r) => r.is_active && r.tehsil_id);
      if (t) setTehsilId(t.tehsil_id);
    });
  }, [role, profile]);

  useEffect(() => {
    listTehsils({ activeOnly: true }).then(setTehsils);
    listIssueTypes({ activeOnly: true }).then(setIssueTypes);
  }, []);

  useEffect(() => {
    setLoading(true);
    const from = periodStart(period);
    const dateFrom = from ? from.toISOString() : undefined;
    Promise.all([
      fetchReportsForAnalytics({ tehsilId: tehsilId || undefined, dateFrom }),
      listReports({ tehsilId: tehsilId || undefined, dateFrom }),
    ])
      .then(([forStats, forFeed]) => {
        setStatsReports(forStats);
        setRecent(forFeed.slice(0, 8));
      })
      .catch(() => {
        setStatsReports([]);
        setRecent([]);
      })
      .finally(() => setLoading(false));
  }, [period, tehsilId]);

  const pending = statsReports.filter((r) => r.status === 'PENDING' || r.status === 'SUBMITTED').length;
  const inProgress = statsReports.filter((r) => r.status === 'IN_PROGRESS').length;
  const closed = statsReports.filter((r) => r.status === 'CLOSED').length;

  const byIssueType = useMemo(
    () => groupCount(statsReports, 'issue_type_id', (id) => issueTypes.find((t) => t.id === id)?.name || id),
    [statsReports, issueTypes]
  );

  // Reported vs resolved per day within the selected window — resolutions
  // of reports created before the window start won't appear here, which is
  // fine for a home-page snapshot (Analytics has the unbounded version).
  const trend = useMemo(() => {
    const byDay = new Map();
    const dayKey = (iso) => iso?.slice(0, 10);
    const bump = (iso, field) => {
      const k = dayKey(iso);
      if (!k) return;
      const e = byDay.get(k) || { day: k, reported: 0, resolved: 0 };
      e[field] += 1;
      byDay.set(k, e);
    };
    for (const r of statsReports) {
      bump(r.created_at, 'reported');
      bump(r.resolution?.resolved_at, 'resolved');
    }
    return Array.from(byDay.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({ ...d, label: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }));
  }, [statsReports]);

  const tehsilName = tehsils.find((t) => t.id === tehsilId)?.name;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hello {profile?.full_name?.split(' ')[0] || ''}</h2>
          <p className="text-xs text-slate-400">
            {role} {tehsilName ? `· ${tehsilName}` : ''}
          </p>
        </div>
        {SCOPE_ROLES.includes(role) && (
          <select
            value={tehsilId}
            onChange={(e) => setTehsilId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
          >
            <option value="">All tehsils (district-wide)</option>
            {tehsils.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              period === p.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={statsReports.length} icon={<ClipboardList size={16} />} />
        <StatCard label="Pending" value={pending} icon={<Clock size={16} />} tone="amber" />
        <StatCard label="In progress" value={inProgress} icon={<TrendingUp size={16} />} />
        <StatCard label="Closed" value={closed} icon={<CheckCircle2 size={16} />} tone="emerald" />
      </div>

      {/* Everyone except a pure Rectifier can file a report — Surveyor
          exclusively, and every "controller" tier (Supervisor/ZO/Area
          Manager/Admin) can act as a Surveyor too. */}
      {role !== 'RECTIFIER' && (
        <button
          onClick={() => navigate('/reports/new')}
          className="w-full rounded-xl bg-slate-900 text-white font-semibold py-3 text-sm hover:bg-slate-800 transition-colors"
        >
          + NEW ISSUE
        </button>
      )}

      {role === 'RECTIFIER' && (
        <button
          onClick={() => navigate('/queue')}
          className="w-full rounded-xl bg-slate-900 text-white font-semibold py-3 text-sm hover:bg-slate-800 transition-colors"
        >
          GO TO RESOLVE QUEUE
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">By category</h3>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : byIssueType.length ? (
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
            <p className="text-sm text-slate-400">No reports in this period.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Reported vs resolved</h3>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : trend.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="reported" name="Reported" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">No reports in this period.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent activity</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : recent.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
            No reports in this period.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <ReportRow key={r.id} report={r} onClick={() => navigate(`/reports/${r.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
