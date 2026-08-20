import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchReportsForAnalytics, summarize, groupCount } from '../lib/api/analytics';
import { listTehsils, listZones, listUcs, listIssueTypes } from '../lib/api/orgHierarchy';
import { listUsers } from '../lib/api/users';
import { listAttendance, listDailyDistance } from '../lib/api/tracking';
import { listReports, listReportImages, listResolutions, getReportPhotoSignedUrl } from '../lib/api/reports';
import StatCard from '../components/StatCard';
import { exportCsv, exportExcel, exportPdf, exportReportsPdf, urlToDataUrl } from '../lib/export';
import { ClipboardList, CheckCircle2, TrendingUp, Download, FileImage } from 'lucide-react';

const DETAILED_PDF_LIMIT = 150;

const STATUSES = ['SUBMITTED', 'PENDING', 'IN_PROGRESS', 'CLOSED', 'REOPENED'];

export default function Analytics() {
  const [reports, setReports] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [zones, setZones] = useState([]);
  const [ucs, setUcs] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [zos, setZos] = useState([]);
  const [surveyors, setSurveyors] = useState([]);
  const [rectifiers, setRectifiers] = useState([]);
  const [fieldActivity, setFieldActivity] = useState([]);
  const [filters, setFilters] = useState({});
  const [exportingDetailed, setExportingDetailed] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    listTehsils({ activeOnly: true }).then(setTehsils);
    listZones({ activeOnly: true }).then(setZones);
    listUcs({ activeOnly: true }).then(setUcs);
    listIssueTypes({ activeOnly: true }).then(setIssueTypes);
    listUsers({ role: 'SUPERVISOR' }).then(setSupervisors);
    listUsers({ role: 'ZO' }).then(setZos);
    listUsers({ role: 'SURVEYOR' }).then(setSurveyors);
    listUsers({ role: 'RECTIFIER' }).then(setRectifiers);
  }, []);

  // Field activity (last 30 days): attendance + distance covered, combined
  // per user — a quick "who's actually out there working" cross-check
  // alongside the report-count performance tables above.
  useEffect(() => {
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    Promise.all([listAttendance({ dateFrom }), listDailyDistance({ dateFrom })])
      .then(([attendance, distance]) => {
        const byUser = new Map();
        for (const a of attendance) {
          const entry = byUser.get(a.user_id) || { userId: a.user_id, presentDays: 0, km: 0 };
          entry.presentDays += 1;
          byUser.set(a.user_id, entry);
        }
        for (const d of distance) {
          const entry = byUser.get(d.user_id) || { userId: d.user_id, presentDays: 0, km: 0 };
          entry.km += Number(d.distance_km || 0);
          byUser.set(d.user_id, entry);
        }
        setFieldActivity(Array.from(byUser.values()));
      })
      .catch(() => setFieldActivity([]));
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
  const bySurveyor = groupCount(reports, 'reported_by', (id) => userLookup(surveyors, id));
  const byRectifier = groupCount(
    reports.map((r) => ({ ...r, resolved_by: r.resolution?.resolved_by, status: r.resolution ? 'CLOSED' : r.status })),
    'resolved_by',
    (id) => userLookup(rectifiers, id)
  );

  const allFieldUsers = [...supervisors, ...zos, ...surveyors, ...rectifiers];
  const fieldActivityRows = fieldActivity
    .map((r) => ({ ...r, name: userLookup(allFieldUsers, r.userId) }))
    .sort((a, b) => b.km - a.km);

  // The one place the app produces a photo-carrying PDF: fetches the full
  // (filtered) report rows plus their before/after photos, resolves each
  // storage path to a short-lived signed URL, converts those to data: URLs
  // (jsPDF can't fetch cross-origin itself), then hands it all to
  // exportReportsPdf. Capped so a wide-open filter can't hang the browser
  // downloading hundreds of full-size photos.
  async function handleExportDetailedPdf() {
    setExportError('');
    setExportingDetailed(true);
    try {
      const detailed = await listReports(filters);
      if (detailed.length > DETAILED_PDF_LIMIT) {
        setExportError(`${detailed.length} reports match — narrow the filters to ${DETAILED_PDF_LIMIT} or fewer for a photo PDF.`);
        return;
      }
      const reportIds = detailed.map((r) => r.id);
      const [images, resolutions] = await Promise.all([listReportImages(reportIds), listResolutions(reportIds)]);

      const imagesByReport = new Map();
      for (const img of images) {
        const list = imagesByReport.get(img.report_id) || [];
        list.push(img);
        imagesByReport.set(img.report_id, list);
      }
      const resolutionByReport = new Map(resolutions.map((r) => [r.report_id, r]));

      const rows = await Promise.all(
        detailed.map(async (r) => {
          const reportImages = imagesByReport.get(r.id) || [];
          const before = reportImages.find((i) => i.image_type === 'BEFORE');
          const after = reportImages.find((i) => i.image_type === 'RESOLUTION');
          const resolution = resolutionByReport.get(r.id);
          const [beforeUrl, afterUrl] = await Promise.all([
            before ? getReportPhotoSignedUrl(before.file_path) : null,
            after ? getReportPhotoSignedUrl(after.file_path) : null,
          ]);
          const [beforeDataUrl, afterDataUrl] = await Promise.all([urlToDataUrl(beforeUrl), urlToDataUrl(afterUrl)]);
          return {
            reportNumber: r.report_number,
            issueType: r.issue_type?.name,
            uc: r.uc?.name,
            address: r.address,
            status: r.status,
            resolvedBy: resolution?.resolver?.full_name,
            resolvedAt: resolution?.resolved_at ? new Date(resolution.resolved_at).toLocaleDateString() : null,
            beforeDataUrl,
            afterDataUrl,
          };
        })
      );

      exportReportsPdf('reports-detailed.pdf', 'Field Issue Reports', rows);
    } catch (e) {
      setExportError(e.message || 'Failed to build the PDF');
    } finally {
      setExportingDetailed(false);
    }
  }

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
            <Download size={12} /> PDF (summary)
          </button>
          <button
            onClick={handleExportDetailedPdf}
            disabled={exportingDetailed}
            className="text-xs font-medium text-amber-700 flex items-center gap-1 disabled:text-slate-300"
          >
            <FileImage size={12} /> {exportingDetailed ? 'Building…' : 'PDF with photos'}
          </button>
        </div>
      </div>

      {exportError && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{exportError}</div>}

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
      <PerformanceTable title="Surveyor performance" rows={bySurveyor} />
      <PerformanceTable title="Rectifier performance" rows={byRectifier} />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Field activity — last 30 days</h3>
        <p className="text-[11px] text-slate-400 mb-3">Attendance (days with ≥1 report filed/resolved) and distance covered, from live location pings.</p>
        {fieldActivityRows.length === 0 ? (
          <EmptyNote />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wide">
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 pr-2 text-right">Present Days</th>
                <th className="py-1 text-right">Distance Covered</th>
              </tr>
            </thead>
            <tbody>
              {fieldActivityRows.map((r) => (
                <tr key={r.userId} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-700">{r.name}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.presentDays}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.km.toFixed(1)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
