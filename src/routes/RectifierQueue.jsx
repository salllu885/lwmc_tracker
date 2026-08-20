import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Clock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { listReports, listReportImages, getReportPhotoSignedUrl } from '../lib/api/reports';
import { listAssignedUcs, listUcs } from '../lib/api/orgHierarchy';
import { timeAgo } from '../lib/format';

// Rectifier's landing screen: open (not-yet-closed) reports scoped to their
// own Tehsil by RLS (0009_tehsil_wide_scope_and_geofencing.sql) — no longer
// pinned to a single assigned UC. They can browse any UC in their Tehsil,
// defaulting to their own assigned UC, then pick which report to work from
// the list; there's no single pre-assigned report the way Supervisor/ZO
// get stamped on creation.
export default function RectifierQueue() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [loading, setLoading] = useState(true);
  const [ucs, setUcs] = useState([]);
  const [ucId, setUcId] = useState('');

  useEffect(() => {
    if (!profile) return;
    listAssignedUcs(profile.id).then(async (assigned) => {
      const tehsilIds = [...new Set(assigned.map((u) => u.tehsil_id).filter(Boolean))];
      if (tehsilIds.length === 0) {
        setUcs(assigned);
        if (assigned[0]) setUcId(assigned[0].id);
        return;
      }
      const lists = await Promise.all(tehsilIds.map((tehsilId) => listUcs({ tehsilId, activeOnly: true })));
      const defaultId = assigned.find((u) => u.is_default)?.id || assigned[0]?.id;
      const merged = lists.flat().map((u) => ({ ...u, is_default: u.id === defaultId }));
      setUcs(merged);
      setUcId(defaultId || '');
    });
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await listReports({ open: true, ucId: ucId || undefined });
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
  }, [ucId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Resolve Queue</h2>
          <p className="text-xs text-slate-400 mt-0.5">{loading ? 'Loading…' : `${reports.length} pending`}</p>
        </div>
        {ucs.length > 1 && (
          <select value={ucId} onChange={(e) => setUcId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono bg-white">
            <option value="">All UCs in Tehsil</option>
            {ucs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
        )}
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
