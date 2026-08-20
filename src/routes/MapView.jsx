import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { listReports } from '../lib/api/reports';
import { listTehsils, listZones, listUcs } from '../lib/api/orgHierarchy';

const STATUSES = [
  { value: 'PENDING', label: 'Reported' },
  { value: 'CLOSED', label: 'Resolved' },
];

// Two-state per requirements: red = still open (any pre-CLOSED status),
// green = resolved. Markers always sit at the report's own submission
// coordinates, not the resolution's — the point is where the issue was
// found, not where it was fixed.
const RED = '#DC2626';
const GREEN = '#059669';
function statusColor(status) {
  return status === 'CLOSED' ? GREEN : RED;
}

const DEFAULT_CENTER = [31.48, 74.28];

export default function MapView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tehsils, setTehsils] = useState([]);
  const [zones, setZones] = useState([]);
  const [ucs, setUcs] = useState([]);

  const status = searchParams.get('status') || '';
  const tehsilId = searchParams.get('tehsil') || '';
  const zoneId = searchParams.get('zone') || '';
  const ucId = searchParams.get('uc') || '';
  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';

  useEffect(() => {
    listTehsils({ activeOnly: true }).then(setTehsils);
  }, []);

  useEffect(() => {
    listZones({ tehsilId: tehsilId || undefined, activeOnly: true }).then(setZones);
  }, [tehsilId]);

  useEffect(() => {
    listUcs({ zoneId: zoneId || undefined, tehsilId: tehsilId || undefined, activeOnly: true }).then(setUcs);
  }, [zoneId, tehsilId]);

  useEffect(() => {
    setLoading(true);
    listReports({
      status: status || undefined,
      tehsilId: tehsilId || undefined,
      zoneId: zoneId || undefined,
      ucId: ucId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59` : undefined,
    })
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [status, tehsilId, zoneId, ucId, dateFrom, dateTo]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'tehsil') {
      next.delete('zone');
      next.delete('uc');
    }
    if (key === 'zone') next.delete('uc');
    setSearchParams(next);
  }

  const points = reports.filter((r) => r.latitude != null && r.longitude != null);
  const center = points[0] ? [points[0].latitude, points[0].longitude] : DEFAULT_CENTER;
  const openCount = points.filter((r) => r.status !== 'CLOSED').length;
  const resolvedCount = points.length - openCount;
  const missingLocationCount = reports.length - points.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-900">Map</h2>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-rose-600">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> {openCount} open
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> {resolvedCount} resolved
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-slate-400" />
          <select value={status} onChange={(e) => updateParam('status', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={tehsilId} onChange={(e) => updateParam('tehsil', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            <option value="">All tehsils</option>
            {tehsils.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={zoneId} onChange={(e) => updateParam('zone', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select value={ucId} onChange={(e) => updateParam('uc', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono">
            <option value="">All UCs</option>
            {ucs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateParam('from', e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-slate-400">To</span>
          <input type="date" value={dateTo} onChange={(e) => updateParam('to', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          {(status || tehsilId || zoneId || ucId || dateFrom || dateTo) && (
            <button onClick={() => setSearchParams(new URLSearchParams())} className="text-xs font-medium text-amber-700">
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden relative" style={{ height: '70vh' }}>
        {loading && <div className="absolute inset-0 bg-white/60 z-[1000] flex items-center justify-center text-sm text-slate-400">Loading…</div>}
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((r) => (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={8}
              pathOptions={{
                color: statusColor(r.status),
                fillColor: statusColor(r.status),
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-bold">{r.report_number}</div>
                  <div>
                    {r.issue_type?.name} · {r.uc?.name}
                  </div>
                  <div>{r.status}</div>
                  <button onClick={() => navigate(`/reports/${r.id}`)} className="block text-amber-700 font-medium">
                    View report
                  </button>
                  <a
                    href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-amber-700 font-medium"
                  >
                    Navigate
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {missingLocationCount > 0 && (
        <p className="text-[11px] text-slate-400">{missingLocationCount} matching report(s) have no GPS coordinates and aren't shown on the map.</p>
      )}
    </div>
  );
}
