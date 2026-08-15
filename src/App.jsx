import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter,
} from 'recharts';
import {
  Camera as CameraIcon, MapPin, CheckCircle2, Clock, Filter, TrendingUp, X,
  ChevronRight, Navigation, Image as ImageIcon, ClipboardList,
  LayoutDashboard, RefreshCw,
} from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

const ZONES = [
  { id: 'z1', name: 'Zone 1', zo: 'Zonal Officer — Zone 1' },
  { id: 'z2', name: 'Zone 2', zo: 'Zonal Officer — Zone 2' },
];

const UC_NUMBERS = [242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 257];
const UCS = UC_NUMBERS.map((n, idx) => ({
  id: `uc${n}`,
  number: n,
  zoneId: idx % 2 === 0 ? 'z1' : 'z2',
  supervisor: `Supervisor — UC ${n}`,
}));

const ISSUE_TYPES = [
  { id: 'garbage', label: 'Garbage', color: '#B45309' },
  { id: 'manhole', label: 'Manhole Cover', color: '#7C3AED' },
  { id: 'slab', label: 'Slab', color: '#0EA5E9' },
  { id: 'sewer', label: 'Sewer Issue', color: '#DC2626' },
  { id: 'road', label: 'Road Issue', color: '#475569' },
];

const SURVEYORS = ['Field Surveyor — A', 'Field Surveyor — B', 'Field Surveyor — C'];

const BASE_LAT = 31.48;
const BASE_LNG = 74.28;

const STORAGE_KEY = 'nishtar-issues-v1';

function rid() {
  return Math.random().toString(36).slice(2, 9);
}

function nowIso() {
  return new Date().toISOString();
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

async function capturePhoto() {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 70,
    width: 900,
    saveToGallery: false,
  });
  return photo.dataUrl;
}

function seedIssues() {
  const h = 3600 * 1000;
  return [
    { id: 'seed-1', ucId: 'uc244', issueType: 'garbage', note: 'Sample data — heap at collection point, not lifted in 2 days.', address: 'Main Road, UC 244', lat: BASE_LAT + 0.006, lng: BASE_LNG + 0.004, photo: null, submittedBy: SURVEYORS[0], submittedAt: new Date(Date.now() - 5 * h).toISOString(), status: 'pending' },
    { id: 'seed-2', ucId: 'uc249', issueType: 'sewer', note: 'Sample data — open sewer line, waterlogging risk.', address: 'Street 4, UC 249', lat: BASE_LAT - 0.003, lng: BASE_LNG + 0.012, photo: null, submittedBy: SURVEYORS[1], submittedAt: new Date(Date.now() - 28 * h).toISOString(), status: 'resolved', resolvedBy: 'Supervisor — UC 249', resolvedAt: new Date(Date.now() - 20 * h).toISOString(), resolutionNote: 'Sample data — line cleared and desilted.', resolutionPhoto: null },
    { id: 'seed-3', ucId: 'uc247', issueType: 'manhole', note: 'Sample data — cover missing near school entrance.', address: 'School Road, UC 247', lat: BASE_LAT + 0.011, lng: BASE_LNG - 0.005, photo: null, submittedBy: SURVEYORS[0], submittedAt: new Date(Date.now() - 2 * h).toISOString(), status: 'pending' },
    { id: 'seed-4', ucId: 'uc253', issueType: 'road', note: 'Sample data — pothole cluster after rain.', address: 'Link Road, UC 253', lat: BASE_LAT - 0.008, lng: BASE_LNG - 0.009, photo: null, submittedBy: SURVEYORS[2], submittedAt: new Date(Date.now() - 50 * h).toISOString(), status: 'resolved', resolvedBy: 'Supervisor — UC 253', resolvedAt: new Date(Date.now() - 40 * h).toISOString(), resolutionNote: 'Sample data — patched.', resolutionPhoto: null },
    { id: 'seed-5', ucId: 'uc242', issueType: 'slab', note: 'Sample data — broken slab, safety risk.', address: 'Bazaar area, UC 242', lat: BASE_LAT + 0.002, lng: BASE_LNG + 0.017, photo: null, submittedBy: SURVEYORS[1], submittedAt: new Date(Date.now() - 10 * h).toISOString(), status: 'pending' },
    { id: 'seed-6', ucId: 'uc257', issueType: 'garbage', note: 'Sample data — container overflow.', address: 'UC 257', lat: BASE_LAT - 0.014, lng: BASE_LNG + 0.002, photo: null, submittedBy: SURVEYORS[2], submittedAt: new Date(Date.now() - 15 * h).toISOString(), status: 'resolved', resolvedBy: 'Supervisor — UC 257', resolvedAt: new Date(Date.now() - 8 * h).toISOString(), resolutionNote: 'Sample data — cleared, extra container requested.', resolutionPhoto: null },
  ];
}

function StatCard({ label, value, icon, tone }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-700';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3">
      <div className={`flex items-center gap-1.5 ${toneClass}`}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function IssueRow({ issue, onClick }) {
  const type = ISSUE_TYPES.find((t) => t.id === issue.issueType);
  const uc = UCS.find((u) => u.id === issue.ucId);
  return (
    <button onClick={onClick} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 hover:border-slate-300 transition-colors">
      <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
        {issue.photo ? <img src={issue.photo} className="w-full h-full object-cover" alt="" /> : <ImageIcon size={18} className="text-slate-300" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">UC {uc?.number}</span>
          <span className="text-xs font-medium" style={{ color: type?.color }}>{type?.label}</span>
        </div>
        <div className="text-sm text-slate-700 truncate mt-0.5">{issue.note || issue.address || 'No note'}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{issue.submittedBy} · {timeAgo(issue.submittedAt)}</div>
      </div>
      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
    </button>
  );
}

function IssueDetail({ issue, onClose, onResolve, resolverName }) {
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const type = ISSUE_TYPES.find((t) => t.id === issue.issueType);
  const uc = UCS.find((u) => u.id === issue.ucId);

  async function handlePhoto() {
    try {
      setPhoto(await capturePhoto());
    } catch (e) {
      // user cancelled the camera
    }
  }

  function submit() {
    onResolve(issue.id, { resolvedBy: resolverName, resolutionNote: note, resolutionPhoto: photo });
    onClose();
  }

  const mapUrl = issue.lat != null ? `https://www.google.com/maps?q=${issue.lat},${issue.lng}` : null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">UC {uc?.number}</span>
                <span className="text-xs font-medium" style={{ color: type?.color }}>{type?.label}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">{issue.submittedBy} · {timeAgo(issue.submittedAt)}</div>
            </div>
            <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
          </div>

          {issue.photo && <img src={issue.photo} className="w-full rounded-xl" alt="Reported issue" />}
          {issue.note && <p className="text-sm text-slate-700">{issue.note}</p>}
          {issue.address && <p className="text-xs text-slate-500">{issue.address}</p>}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
              <MapPin size={12} /> Open location in Maps
            </a>
          )}

          {issue.status === 'pending' ? (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolve this report</div>
              <button onClick={handlePhoto} className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 overflow-hidden bg-slate-50">
                {photo ? <img src={photo} className="w-full h-full object-cover" alt="" /> : (<><CameraIcon size={22} /><span className="text-xs">Resolution photo</span></>)}
              </button>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Resolution note…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button onClick={submit} className="w-full rounded-xl bg-emerald-600 text-white font-semibold py-3 text-sm hover:bg-emerald-700 transition-colors">Mark resolved</button>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Resolved</div>
              {issue.resolutionPhoto && <img src={issue.resolutionPhoto} className="w-full rounded-xl" alt="Resolution" />}
              {issue.resolutionNote && <p className="text-sm text-slate-700">{issue.resolutionNote}</p>}
              <p className="text-xs text-slate-400">{issue.resolvedBy} · {timeAgo(issue.resolvedAt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportView({ onSubmit }) {
  const [surveyor, setSurveyor] = useState(SURVEYORS[0]);
  const [ucId, setUcId] = useState(UCS[0].id);
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0].id);
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loc, setLoc] = useState(null);
  const [locStatus, setLocStatus] = useState('idle');
  const [submitted, setSubmitted] = useState(false);

  async function captureLocation() {
    setLocStatus('locating');
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocStatus('ok');
    } catch (e) {
      setLocStatus('denied');
    }
  }

  useEffect(() => { captureLocation(); }, []);

  async function handlePhoto() {
    try {
      setPhoto(await capturePhoto());
    } catch (e) {
      // user cancelled the camera
    }
  }

  function handleSubmit() {
    onSubmit({
      ucId, issueType, note, address,
      lat: loc?.lat ?? null, lng: loc?.lng ?? null,
      photo, submittedBy: surveyor,
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    setNote('');
    setAddress('');
    setPhoto(null);
    captureLocation();
  }

  const canSubmit = ucId && issueType && (address.trim() || loc);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acting as (demo)</label>
        <select value={surveyor} onChange={(e) => setSurveyor(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {SURVEYORS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Photo</div>
          <button onClick={handlePhoto} className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-400 overflow-hidden bg-slate-50 hover:border-amber-400 hover:text-amber-600 transition-colors">
            {photo ? <img src={photo} alt="Captured issue" className="w-full h-full object-cover" /> : (<><CameraIcon size={28} /><span className="text-sm">Capture photo</span></>)}
          </button>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center justify-between">
            <span>Location</span>
            <button onClick={captureLocation} className="text-amber-700 flex items-center gap-1 text-xs font-medium"><RefreshCw size={12} /> Retry</button>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm flex items-center gap-2">
            <Navigation size={16} className={locStatus === 'ok' ? 'text-emerald-600' : 'text-slate-400'} />
            {locStatus === 'locating' && 'Getting GPS position…'}
            {locStatus === 'ok' && loc && <span className="font-mono tabular-nums">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</span>}
            {locStatus === 'denied' && 'Location permission denied — add address below'}
            {locStatus === 'idle' && 'Waiting for location…'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">UC</label>
            <select value={ucId} onChange={(e) => setUcId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono">
              {UCS.map((u) => <option key={u.id} value={u.id}>UC {u.number}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issue</label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {ISSUE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Describe what you see…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address (manual)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street / landmark" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <button disabled={!canSubmit} onClick={handleSubmit} className="w-full rounded-xl bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm hover:bg-slate-800 transition-colors">
          {submitted ? 'Submitted ✓' : 'Submit report'}
        </button>
      </div>
    </div>
  );
}

function ResolveView({ issues, onResolve }) {
  const [scopeType, setScopeType] = useState('supervisor');
  const [scopeUc, setScopeUc] = useState(UCS[0].id);
  const [scopeZone, setScopeZone] = useState(ZONES[0].id);
  const [active, setActive] = useState(null);

  const scoped = useMemo(() => {
    if (scopeType === 'supervisor') return issues.filter((i) => i.ucId === scopeUc);
    return issues.filter((i) => UCS.find((u) => u.id === i.ucId)?.zoneId === scopeZone);
  }, [issues, scopeType, scopeUc, scopeZone]);

  const pending = scoped.filter((i) => i.status === 'pending');
  const resolved = scoped.filter((i) => i.status === 'resolved');
  const resolverName = scopeType === 'supervisor' ? UCS.find((u) => u.id === scopeUc)?.supervisor : ZONES.find((z) => z.id === scopeZone)?.zo;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
          <button onClick={() => setScopeType('supervisor')} className={`px-3 py-1.5 rounded-md font-medium ${scopeType === 'supervisor' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Supervisor</button>
          <button onClick={() => setScopeType('zo')} className={`px-3 py-1.5 rounded-md font-medium ${scopeType === 'zo' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Zonal Officer</button>
        </div>
        {scopeType === 'supervisor' ? (
          <select value={scopeUc} onChange={(e) => setScopeUc(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-mono">
            {UCS.map((u) => <option key={u.id} value={u.id}>UC {u.number}</option>)}
          </select>
        ) : (
          <select value={scopeZone} onChange={(e) => setScopeZone(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        )}
        <span className="ml-auto text-xs text-slate-400">{resolverName}</span>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-700">Pending ({pending.length})</h3>
        </div>
        {pending.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">Nothing pending in this scope.</div>
        ) : (
          <div className="space-y-2">
            {pending.map((issue) => <IssueRow key={issue.id} issue={issue} onClick={() => setActive(issue)} />)}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-700">Resolved ({resolved.length})</h3>
          </div>
          <div className="space-y-2 opacity-70">
            {resolved.map((issue) => <IssueRow key={issue.id} issue={issue} onClick={() => setActive(issue)} />)}
          </div>
        </div>
      )}

      {active && <IssueDetail issue={active} onClose={() => setActive(null)} onResolve={onResolve} resolverName={resolverName} />}
    </div>
  );
}

function OversightView({ issues }) {
  const [filterZone, setFilterZone] = useState('all');
  const [filterUc, setFilterUc] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const filtered = useMemo(() => issues.filter((i) => {
    const uc = UCS.find((u) => u.id === i.ucId);
    if (filterZone !== 'all' && uc?.zoneId !== filterZone) return false;
    if (filterUc !== 'all' && i.ucId !== filterUc) return false;
    if (filterType !== 'all' && i.issueType !== filterType) return false;
    return true;
  }), [issues, filterZone, filterUc, filterType]);

  const total = filtered.length;
  const resolvedCount = filtered.filter((i) => i.status === 'resolved').length;
  const pct = total ? Math.round((resolvedCount / total) * 100) : 0;

  const byUc = UCS.map((u) => {
    const items = filtered.filter((i) => i.ucId === u.id);
    return { uc: `UC ${u.number}`, Reported: items.length, Resolved: items.filter((i) => i.status === 'resolved').length };
  }).filter((d) => d.Reported > 0);

  const byType = ISSUE_TYPES.map((t) => ({ name: t.label, value: filtered.filter((i) => i.issueType === t.id).length, color: t.color })).filter((d) => d.value > 0);

  const mapPoints = filtered.filter((i) => i.lat != null).map((i) => ({ lat: i.lat, lng: i.lng, status: i.status }));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-slate-400" />
        <select value={filterZone} onChange={(e) => { setFilterZone(e.target.value); setFilterUc('all'); }} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="all">All zones</option>
          {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select value={filterUc} onChange={(e) => setFilterUc(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono">
          <option value="all">All UCs</option>
          {UCS.filter((u) => filterZone === 'all' || u.zoneId === filterZone).map((u) => <option key={u.id} value={u.id}>UC {u.number}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="all">All issue types</option>
          {ISSUE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Reported" value={total} icon={<ClipboardList size={16} />} />
        <StatCard label="Resolved" value={resolvedCount} icon={<CheckCircle2 size={16} />} tone="emerald" />
        <StatCard label="Clearance" value={`${pct}%`} icon={<TrendingUp size={16} />} tone="amber" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Reported vs resolved by UC</h3>
        {byUc.length === 0 ? (
          <p className="text-sm text-slate-400">No data for this filter.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, byUc.length * 28)}>
            <BarChart data={byUc} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="uc" width={56} tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <Tooltip />
              <Bar dataKey="Reported" fill="#CBD5E1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Resolved" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">By issue type</h3>
        {byType.length === 0 ? (
          <p className="text-sm text-slate-400">No data for this filter.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {byType.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Issue locations</h3>
        <p className="text-xs text-slate-400 mb-3">Plotted by reported GPS coordinates — a production build would embed a live map here.</p>
        {mapPoints.length === 0 ? (
          <p className="text-sm text-slate-400">No geo-tagged reports for this filter.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#E2E8F0" />
              <XAxis type="number" dataKey="lng" name="Longitude" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <YAxis type="number" dataKey="lat" name="Latitude" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={mapPoints}>
                {mapPoints.map((p, idx) => <Cell key={idx} fill={p.status === 'resolved' ? '#059669' : '#B45309'} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TopNav({ mode, setMode, pendingCount }) {
  const tabs = [
    { id: 'report', label: 'Report', icon: ClipboardList },
    { id: 'resolve', label: 'Resolve', icon: CheckCircle2, badge: pendingCount },
    { id: 'oversight', label: 'Oversight', icon: LayoutDashboard },
  ];
  return (
    <header className="bg-slate-900 text-white sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight">Field Issue Tracker</h1>
          <span className="text-[11px] text-amber-400 font-mono uppercase tracking-wide">Tehsil Nishtar · Demo</span>
        </div>
      </div>
      <nav className="max-w-5xl mx-auto px-4 flex gap-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const activeTab = mode === t.id;
          return (
            <button key={t.id} onClick={() => setMode(t.id)} className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab ? 'border-amber-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              <Icon size={15} />{t.label}
              {!!t.badge && <span className="ml-1 bg-amber-500 text-slate-900 text-[10px] font-bold rounded-full px-1.5 py-0.5">{t.badge}</span>}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function loadIssues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore corrupt/unavailable storage, fall through to seed data
  }
  const seeded = seedIssues();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch (e) {
    // storage unavailable — seeded data will just stay in-memory this session
  }
  return seeded;
}

export default function App() {
  const [mode, setMode] = useState('report');
  const [issues, setIssues] = useState(() => loadIssues());
  const [storageError, setStorageError] = useState(false);

  function persist(updated) {
    setIssues(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      setStorageError(true);
    }
  }

  function addIssue(issue) {
    const record = { ...issue, id: rid(), status: 'pending', submittedAt: nowIso() };
    persist([record, ...issues]);
  }

  function resolveIssue(id, { resolvedBy, resolutionNote, resolutionPhoto }) {
    const updated = issues.map((it) => it.id === id ? { ...it, status: 'resolved', resolvedBy, resolutionNote, resolutionPhoto, resolvedAt: nowIso() } : it);
    persist(updated);
  }

  const pendingCount = issues.filter((i) => i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <TopNav mode={mode} setMode={setMode} pendingCount={pendingCount} />
      <main className="flex-1 max-w-5xl w-full mx-auto p-4">
        {mode === 'report' ? (
          <ReportView onSubmit={addIssue} />
        ) : mode === 'resolve' ? (
          <ResolveView issues={issues} onResolve={resolveIssue} />
        ) : (
          <OversightView issues={issues} />
        )}
      </main>
      {storageError && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 bg-amber-100 border border-amber-300 text-amber-800 text-xs px-3 py-2 rounded-full shadow">
          Local storage unavailable — data won't persist on this device.
        </div>
      )}
    </div>
  );
}
