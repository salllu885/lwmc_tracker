import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Clock } from 'lucide-react';
import { listReports, listReportImages, getReportPhotoSignedUrl } from '../lib/api/reports';
import { timeAgo } from '../lib/format';

// Rectifier's landing screen: pending reports scoped to their assigned
// UC(s) by RLS (reports_select in 0005_hierarchy_v2.sql) — no client-side
// filtering needed beyond status. They pick which one to work from this
// list, then resolve it on ReportDetail; there's no single pre-assigned
// report the way Supervisor/ZO get stamped on creation.
export default function RectifierQueue() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await listReports({ status: 'PENDING' });
        if (cancelled) return;
        setReports(data);

        const images = await listReportImages(data.map((r) => r.id));
        const beforeByReport = new Map(images.filter((i) => i.image_type === 'BEFORE').map((i) => [i.report_id, i]));
        const urls = await Promise.all(
          data.map(async (r) => {
            const img = beforeByReport.get(r.id);
            if (!img) return [r.id, null];
            try {
              return [r.id, await getReportPhotoSignedUrl(img.file_path)];
            } catch {
              return [r.id, null];
            }
          })
        );
        if (!cancelled) setThumbnails(Object.fromEntries(urls));
      } catch {
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Resolve Queue</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {loading ? 'Loading…' : `${reports.length} pending in your area`}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
          Nothing pending right now — you're caught up.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/reports/${r.id}`)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex gap-3 items-start hover:border-slate-300 transition-colors"
            >
              <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {thumbnails[r.id] ? (
                  <img src={thumbnails[r.id]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={18} className="text-slate-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                    {r.uc?.name || r.uc?.code}
                  </span>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${r.issue_type?.color || '#64748B'}22`, color: r.issue_type?.color || '#64748B' }}
                  >
                    {r.issue_type?.name}
                  </span>
                </div>
                <div className="text-sm text-slate-700 truncate mt-1">{r.address || r.description || 'No address'}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={11} className="text-slate-400" />
                  <span className="text-[11px] text-slate-400">Pending {timeAgo(r.created_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
