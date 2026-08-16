import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { listReports } from '../lib/api/reports';

// Red/yellow/green per requirements doc §19.
const STATUS_COLOR = {
  SUBMITTED: '#DC2626',
  PENDING: '#DC2626',
  IN_PROGRESS: '#D97706',
  CLOSED: '#059669',
  REOPENED: '#DC2626',
};

const DEFAULT_CENTER = [31.48, 74.28];

export default function MapView() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);

  useEffect(() => {
    listReports()
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  const points = reports.filter((r) => r.latitude != null && r.longitude != null);
  const center = points[0] ? [points[0].latitude, points[0].longitude] : DEFAULT_CENTER;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Map</h2>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ height: '70vh' }}>
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
                color: STATUS_COLOR[r.status] || '#475569',
                fillColor: STATUS_COLOR[r.status] || '#475569',
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
    </div>
  );
}
