import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Radar } from 'lucide-react';
import { listLatestPings } from '../lib/api/tracking';
import { timeAgo } from '../lib/format';

const ROLE_COLOR = {
  SURVEYOR: '#0369A1',
  RECTIFIER: '#C2410C',
  SUPERVISOR: '#0F172A',
  ZO: '#7C3AED',
};

const DEFAULT_CENTER = [31.48, 74.28];
const REFRESH_MS = 60 * 1000;

export default function LiveTracking() {
  const [pings, setPings] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const center = pings[0] ? [pings[0].latitude, pings[0].longitude] : DEFAULT_CENTER;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Live Tracking</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {loading ? 'Loading…' : `${pings.length} on duty in the last 30 minutes`}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1" style={{ height: '65vh' }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pings.map((p) => (
              <CircleMarker
                key={p.user_id}
                center={[p.latitude, p.longitude]}
                radius={9}
                pathOptions={{
                  color: ROLE_COLOR[p.user?.role] || '#475569',
                  fillColor: ROLE_COLOR[p.user?.role] || '#475569',
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-bold">{p.user?.full_name}</div>
                    <div>
                      {p.user?.designation || p.user?.role}
                    </div>
                    <div>Last ping {timeAgo(p.recorded_at)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div className="lg:w-80 shrink-0 space-y-2 lg:max-h-[65vh] lg:overflow-y-auto">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-1">
            {Object.entries(ROLE_COLOR).map(([r, c]) => (
              <span key={r} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                {r === 'AREA_MANAGER' ? 'Manager' : r.charAt(0) + r.slice(1).toLowerCase()}
              </span>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 px-1">Loading…</p>
          ) : pings.length === 0 ? (
            <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center flex flex-col items-center gap-2">
              <Radar size={20} className="text-slate-300" />
              No one has pinged their location in the last 30 minutes.
            </div>
          ) : (
            pings.map((p) => (
              <div key={p.user_id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
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
              </div>
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
