import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Navigation } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { createReport } from '../lib/api/reports';
import { listAssignedUcs, listUcs, listIssueTypes } from '../lib/api/orgHierarchy';
import { listAssignments } from '../lib/api/users';
import { captureLocation } from '../lib/media';
import PhotoCapture from '../components/PhotoCapture';

// ADMIN/AREA_MANAGER can file a report for ANY UC (reports_insert RLS has
// no uc_id restriction for them — they can "act as anyone" per the role
// model), so restricting the dropdown to their own uc_id assignment left
// them with an empty, unfileable list — they're never UC-assigned, they're
// Tehsil/district-scoped. ZO is similarly zone-scoped, not UC-assigned, so
// it needs the zone's UC list instead. Supervisor/Surveyor stay on their
// own assigned UC(s) only, since that's the actual RLS-enforced boundary
// for those two roles.
async function resolveReportableUcs(profile) {
  if (profile.role === 'ADMIN' || profile.role === 'AREA_MANAGER') {
    return { ucs: await listUcs({ activeOnly: true }), autoSelect: false };
  }
  const assigned = await listAssignedUcs(profile.id);
  if (assigned.length) return { ucs: assigned, autoSelect: true };
  if (profile.role === 'ZO') {
    const rows = await listAssignments({ userId: profile.id });
    const zoneIds = [...new Set(rows.filter((r) => r.is_active && r.zone_id).map((r) => r.zone_id))];
    const lists = await Promise.all(zoneIds.map((zoneId) => listUcs({ zoneId, activeOnly: true })));
    return { ucs: lists.flat(), autoSelect: false };
  }
  return { ucs: [], autoSelect: false };
}

export default function NewReport() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [ucs, setUcs] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [ucId, setUcId] = useState('');
  const [issueTypeId, setIssueTypeId] = useState('');
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loc, setLoc] = useState(null);
  const [locStatus, setLocStatus] = useState('idle');
  const [locError, setLocError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    resolveReportableUcs(profile).then(({ ucs: data, autoSelect }) => {
      setUcs(data);
      if (autoSelect && data[0]) setUcId(data[0].id);
    });
    listIssueTypes({ activeOnly: true }).then((data) => {
      setIssueTypes(data);
      if (data[0]) setIssueTypeId(data[0].id);
    });
  }, [profile]);

  async function refreshLocation() {
    setLocStatus('locating');
    setLocError('');
    try {
      const result = await captureLocation();
      setLoc(result);
      setLocStatus('ok');
    } catch (e) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('denied') || msg.includes('permission')) {
        setLocStatus('denied');
      } else {
        setLocStatus('error');
        setLocError(e?.message || 'Could not get a GPS fix');
      }
    }
  }

  useEffect(() => {
    refreshLocation();
  }, []);

  const canSubmit = ucId && issueTypeId && photo && loc && locStatus === 'ok' && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const report = await createReport({
        ucId,
        issueTypeId,
        address,
        description: note,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        accuracy: loc?.accuracy ?? null,
        reportedBy: profile.id,
        photoDataUrl: photo,
      });
      navigate(`/reports/${report.id}`, { replace: true });
    } catch (e) {
      setError(e.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">New Issue</h2>
      {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Photo <span className="text-rose-500">*</span>
          </div>
          <PhotoCapture label="Capture photo (required)" photo={photo} onCapture={setPhoto} />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center justify-between">
            <span>
              Location <span className="text-rose-500">*</span>
            </span>
            <button onClick={refreshLocation} className="text-amber-700 flex items-center gap-1 text-xs font-medium">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm flex items-center gap-2">
            <Navigation size={16} className={locStatus === 'ok' ? 'text-emerald-600' : 'text-slate-400'} />
            {locStatus === 'locating' && 'Getting GPS position…'}
            {locStatus === 'ok' && loc && (
              <span className="font-mono tabular-nums">
                {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} {loc.accuracy ? `± ${Math.round(loc.accuracy)}m` : ''}
              </span>
            )}
            {locStatus === 'denied' && 'Location permission denied — enable it in app settings and retry'}
            {locStatus === 'error' && `${locError} — move to open sky and retry`}
            {locStatus === 'idle' && 'Waiting for location…'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">UC</label>
            <select
              value={ucId}
              onChange={(e) => setUcId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            >
              {ucs.length === 0 && <option value="">No UC available — contact an admin</option>}
              {ucs.length > 0 && !ucId && <option value="">Select UC…</option>}
              {ucs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issue</label>
            <select
              value={issueTypeId}
              onChange={(e) => setIssueTypeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {issueTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Describe what you see…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Landmark (optional)</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street / landmark — GPS coordinates are recorded automatically"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {!canSubmit && !submitting && (!photo || !loc || locStatus !== 'ok') && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            A photo and a GPS lock are both required before you can submit — address is not a substitute.
          </p>
        )}

        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full rounded-xl bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm hover:bg-slate-800 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </div>
    </div>
  );
}
