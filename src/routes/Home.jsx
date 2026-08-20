import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { listReports } from '../lib/api/reports';
import StatCard from '../components/StatCard';
import ReportRow from '../components/ReportRow';

export default function Home() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listReports()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const pending = reports.filter((r) => r.status === 'PENDING').length;
  const inProgress = reports.filter((r) => r.status === 'IN_PROGRESS').length;
  const closed = reports.filter((r) => r.status === 'CLOSED').length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Hello {profile?.full_name?.split(' ')[0] || ''}</h2>
        <p className="text-xs text-slate-400">{role}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={reports.length} icon={<ClipboardList size={16} />} />
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

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent reports</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : reports.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
            No reports yet.
          </div>
        ) : (
          <div className="space-y-2">
            {reports.slice(0, 8).map((r) => (
              <ReportRow key={r.id} report={r} onClick={() => navigate(`/reports/${r.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
