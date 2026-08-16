import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getReport, getReportPhotoSignedUrl, startResolving, resolveReport } from '../lib/api/reports';
import { listAuditLogs } from '../lib/api/audit';
import { captureLocation } from '../lib/media';
import PhotoCapture from '../components/PhotoCapture';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, timeAgo } from '../lib/format';

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [report, setReport] = useState(null);
  const [beforeUrl, setBeforeUrl] = useState(null);
  const [resolutionUrl, setResolutionUrl] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [resolvePhoto, setResolvePhoto] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getReport(id);
      setReport(data);
      const before = data.images.find((i) => i.image_type === 'BEFORE');
      const resolution = data.images.find((i) => i.image_type === 'RESOLUTION');
      setBeforeUrl(before ? await getReportPhotoSignedUrl(before.file_path) : null);
      setResolutionUrl(resolution ? await getReportPhotoSignedUrl(resolution.file_path) : null);
      setAuditLogs(await listAuditLogs(id));
    } catch (e) {
      setError(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canResolve =
    report &&
    ['SUPERVISOR', 'ZO', 'ADMIN'].includes(role) &&
    report.status !== 'CLOSED' &&
    (role === 'ADMIN' || report.assigned_supervisor_id === profile?.id || report.assigned_zo_id === profile?.id);

  async function handleStart() {
    await startResolving(report.id);
    await load();
  }

  async function handleSubmitResolution() {
    setSubmitting(true);
    setError('');
    try {
      let loc = {};
      try {
        loc = await captureLocation();
      } catch (e) {
        // GPS optional at resolve time — fall back to no coordinates.
      }
      await resolveReport(report.id, {
        resolvedBy: profile.id,
        note: resolveNote,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
        accuracy: loc.accuracy ?? null,
        photoDataUrl: resolvePhoto,
      });
      await load();
    } catch (e) {
      setError(e.message || 'Failed to submit resolution');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!report) return <p className="text-sm text-rose-600">{error || 'Report not found'}</p>;

  const mapUrl = report.latitude != null ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}` : null;

  return (
    <div className="space-y-4 pb-8">
      <button onClick={() => navigate(-1)} className="text-xs text-slate-500">
        &larr; Back
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">{report.report_number}</span>
          <span className="text-xs font-medium" style={{ color: report.issue_type?.color }}>
            {report.issue_type?.name}
          </span>
          <StatusBadge status={report.status} />
        </div>
        <div className="text-xs text-slate-400 -mt-2">
          {report.reporter?.full_name} · {timeAgo(report.created_at)}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Before</div>
          {beforeUrl ? <img src={beforeUrl} className="w-full rounded-xl" alt="Reported issue" /> : <div className="text-xs text-slate-400">No photo</div>}
        </div>

        {report.description && <p className="text-sm text-slate-700">{report.description}</p>}
        {report.address && <p className="text-xs text-slate-500">{report.address}</p>}

        <div className="text-xs text-slate-500 grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400">UC:</span> {report.uc?.name}
          </div>
          <div>
            <span className="text-slate-400">Zone:</span> {report.zone?.name}
          </div>
          <div>
            <span className="text-slate-400">Tehsil:</span> {report.tehsil?.name}
          </div>
          <div>
            <span className="text-slate-400">Accuracy:</span> {report.location_accuracy ? `± ${Math.round(report.location_accuracy)}m` : '—'}
          </div>
        </div>

        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <MapPin size={12} /> Locate / Navigate in Google Maps
          </a>
        )}

        {report.status === 'CLOSED' ? (
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={14} /> Closed
            </div>
            {resolutionUrl && <img src={resolutionUrl} className="w-full rounded-xl" alt="Resolution" />}
            {report.resolution?.resolution_note && <p className="text-sm text-slate-700">{report.resolution.resolution_note}</p>}
            <p className="text-xs text-slate-400">{report.resolution?.resolved_at ? formatDateTime(report.resolution.resolved_at) : ''}</p>
          </div>
        ) : canResolve ? (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolve this report</div>
            {report.status === 'PENDING' && (
              <button onClick={handleStart} className="w-full rounded-xl bg-sky-600 text-white font-semibold py-2.5 text-sm hover:bg-sky-700 transition-colors">
                Start (mark in progress)
              </button>
            )}
            <PhotoCapture label="Resolution photo" photo={resolvePhoto} onCapture={setResolvePhoto} />
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={2}
              placeholder="Resolution note…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {error && <div className="text-xs text-rose-600">{error}</div>}
            <button
              disabled={submitting || !resolvePhoto || !resolveNote.trim()}
              onClick={handleSubmitResolution}
              className="w-full rounded-xl bg-emerald-600 disabled:bg-slate-300 text-white font-semibold py-3 text-sm hover:bg-emerald-700 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Mark resolved'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">History</h3>
        <div className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="text-xs">
              <div className="text-slate-700">
                <span className="font-medium">{log.user?.full_name || 'System'}</span> — {log.action.replace('_', ' ').toLowerCase()}
                {log.new_status ? ` → ${log.new_status.replace('_', ' ')}` : ''}
              </div>
              <div className="text-slate-400">{formatDateTime(log.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
