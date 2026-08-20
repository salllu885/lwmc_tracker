import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Radar, X, MapPin, Flag, Route, Activity } from 'lucide-react';
import { listLatestPings, listPingsForUser, listAttendance, listDailyDistance } from '../lib/api/tracking';
import { timeAgo, formatDateTime } from '../lib/format';

const ROLE_COLOR = {
  SURVEYOR: '#0369A1',
  RECTIFIER: '#C2410C',
  SUPERVISOR: '#0F172A',
  ZO: '#7C3AED',
};

const DEFAULT_CENTER = [31.48, 74.28];
const REFRESH_MS = 60 * 1000;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function LiveTracking() {
  const [pings, setPings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [trail, setTrail] = useState([]);
  const [trailLoading, setTrailLoading] = useState(false);
  const [todayStats, setTodayStats] = useState({ activityCount: 0, distanceKm: 0 });

  async function refresh() {
    try {
      setPings(await listLatestPings());
    } catch {
      setPings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const selected = pings.find((p) => p.user_id === selectedId) || null;

  useEffect(() => {
    if (!selectedId) {
      setTrail([]);
      setTodayStats({ activityCount: 0, distanceKm: 0 });
      return;
    }
    setTrailLoading(true);
    const today = isoDate(new Date());
    Promise.all([
      listPingsForUser(selectedId, { sinceHours: 12 }),
      listAttendance({ dateFrom: today, dateTo: today }),
      listDailyDistance({ dateFrom: today, dateTo: today }),
    ])
      .then(([pingHistory, attendance, distance]) => {
        setTrail(pingHistory);
        const a = attendance.find((r) => r.user_id === selectedId);
        const d = distance.find((r) => r.user_id === selectedId);
        setTodayStats({ activityCount: a?.activity_count || 0, distanceKm: Number(d?.distance_km || 0) });
      })
      .catch(() => {
        setTrail([]);
        setTodayStats({ activityCount: 0, distanceKm: 0 });
      })
      .finally(() => setTrailLoading(false));
  }, [selectedId]);

  // Re-select the same person's freshest ping after each refresh cycle so
  // the trail keeps growing instead of pointing at a stale entry.
  useEffect(() => {
    if (selectedId && !pings.some((p) => p.user_id === selectedId)) setSelectedId(null);
  }, [pings, selectedId]);

  const center = selected ? [selected.latitude, selected.longitude] : pings[0] ? [pings[0].latitude, pings[0].longitude] : DEFAULT_CENTER;
  const trailPositions = useMemo(() => trail.map((t) => [t.latitude, t.longitude]), [trail]);
  const startPoint = trail[0];
  const endPoint = trail[trail.length - 1];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Live Tracking</h2>
        <p className="text-xs text-slate-400 mt-0.5">{loading ? 'Loading…' : `${pings.length} on duty in the last 30 minutes`}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1" style={{ height: '65vh' }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {trailPositions.length > 1 && (
              <Polyline positions={trailPositions} pathOptions={{ color: ROLE_COLOR[selected?.user?.role] || '#475569', weight: 3, opacity: 0.7, dashArray: '6 6' }} />
            )}
            {pings.map((p) => (
              <CircleMarker
                key={p.user_id}
                center={[p.latitude, p.longitude]}
                radius={p.user_id === selectedId ? 11 : 9}
                eventHandlers={{ click: () => setSelectedId(p.user_id) }}
                pathOptions={{
                  color: ROLE_COLOR[p.user?.role] || '#475569',
                  fillColor: ROLE_COLOR[p.user?.role] || '#475569',
                  fillOpacity: 0.85,
                  weight: p.user_id === selectedId ? 3 : 1,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-bold">{p.user?.full_name}</div>
                    <div>{p.user?.designation || p.user?.role}</div>
                    <div>Last ping {timeAgo(p.recorded_at)}</div>
                    <button onClick={() => setSelectedId(p.user_id)} className="text-amber-700 font-medium">
                      View trail
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div className="lg:w-80 shrink-0 space-y-2 lg:max-h-[65vh] lg:overflow-y-auto">
          {selected ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 sticky top-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: ROLE_COLOR[selected.user?.role] || '#475569' }}
                  >
                    {initials(selected.user?.full_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{selected.user?.full_name}</div>
                    <div className="text-[11px] text-slate-400">{selected.user?.designation || selected.user?.role}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-slate-300 hover:text-slate-600 shrink-0">
                  <X size={18} />
                </button>
              </div>

              {trailLoading ? (
                <p className="text-xs text-slate-400">Loading trail…</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {startPoint && (
                    <div className="flex items-start gap-2">
                      <Flag size={13} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-slate-500">Start ({formatDateTime(startPoint.recorded_at)})</div>
                        <div className="font-mono text-slate-700">
                          {startPoint.latitude.toFixed(5)}, {startPoint.longitude.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  )}
                  {endPoint && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-slate-500">Current ({timeAgo(endPoint.recorded_at)})</div>
                        <div className="font-mono text-slate-700">
                          {endPoint.latitude.toFixed(5)}, {endPoint.longitude.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                      <Route size={14} className="text-slate-400" />
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Distance today</div>
                        <div className="font-bold text-slate-900">{todayStats.distanceKm.toFixed(1)} km</div>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                      <Activity size={14} className="text-slate-400" />
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Activity today</div>
                        <div className="font-bold text-slate-900">{todayStats.activityCount}</div>
                      </div>
                    </div>
                  </div>
                  {!startPoint && <p className="text-slate-400">No ping history in the last 12 hours yet.</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-1">
              {Object.entries(ROLE_COLOR).map(([r, c]) => (
                <span key={r} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                  {r === 'AREA_MANAGER' ? 'Manager' : r.charAt(0) + r.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-400 px-1">Loading…</p>
          ) : pings.length === 0 ? (
            <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center flex flex-col items-center gap-2">
              <Radar size={20} className="text-slate-300" />
              No one has pinged their location in the last 30 minutes.
            </div>
          ) : (
            pings.map((p) => (
              <button
                key={p.user_id}
                onClick={() => setSelectedId(p.user_id)}
                className={`w-full text-left bg-white rounded-xl border p-3 flex items-center gap-3 transition-colors ${
                  p.user_id === selectedId ? 'border-slate-900' : 'border-slate-200'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: ROLE_COLOR[p.user?.role] || '#475569' }}
                >
                  {initials(p.user?.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">{p.user?.full_name}</div>
                  <div className="text-[11px] text-slate-400">{p.user?.designation || p.user?.role}</div>
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold shrink-0">{timeAgo(p.recorded_at)}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}
