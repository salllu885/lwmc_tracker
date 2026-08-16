import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Navigation } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { createReport } from '../lib/api/reports';
import { listAssignedUcs, listIssueTypes } from '../lib/api/orgHierarchy';
import { captureLocation } from '../lib/media';
import PhotoCapture from '../components/PhotoCapture';

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    listAssignedUcs(profile.id).then((data) => {
      setUcs(data);
      if (data[0]) setUcId(data[0].id);
    });
    listIssueTypes({ activeOnly: true }).then((data) => {
      setIssueTypes(data);
      if (data[0]) setIssueTypeId(data[0].id);
    });
  }, [profile]);

  async function refreshLocation() {
    setLocStatus('locating');
    try {
      const result = await captureLocation();
      setLoc(result);
      setLocStatus('ok');
    } catch (e) {
      setLocStatus('denied');
    }
  }

  useEffect(() => {
    refreshLocation();
  }, []);

  const canSubmit = ucId && issueTypeId && (address.trim() || loc) && !submitting;

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
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Photo</div>
          <PhotoCapture label="Capture photo" photo={photo} onCapture={setPhoto} />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center justify-between">
            <span>Location</span>
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
            {locStatus === 'denied' && 'Location permission denied — add address below'}
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
              {ucs.length === 0 && <option value="">No UC assigned</option>}
              {ucs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address (manual)</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street / landmark"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

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
