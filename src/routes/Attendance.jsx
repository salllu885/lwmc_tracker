import { useEffect, useMemo, useState } from 'react';
import { listUsers } from '../lib/api/users';
import { listAttendance, listDailyDistance } from '../lib/api/tracking';

const FIELD_ROLES = ['SURVEYOR', 'RECTIFIER', 'SUPERVISOR', 'ZO'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthBounds(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { first, last };
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Calendar cells for the given month, Monday-first, with leading/trailing
// blanks so the grid always lines up under the DOW header.
function buildCells(monthDate) {
  const { first, last } = monthBounds(monthDate);
  const leading = (first.getDay() + 6) % 7; // Mon=0..Sun=6
  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
  }
  return cells;
}

export default function Attendance() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [attendance, setAttendance] = useState([]);
  const [distance, setDistance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(FIELD_ROLES.map((role) => listUsers({ role })))
      .then((lists) => {
        const all = lists.flat();
        setUsers(all);
        if (all[0]) setUserId(all[0].id);
        else setLoading(false); // no field workers yet — nothing to load
      })
      .catch(() => {
        setUsers([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const { first, last } = monthBounds(monthDate);
    const dateFrom = isoDate(first);
    const dateTo = isoDate(last);
    Promise.all([listAttendance({ dateFrom, dateTo }), listDailyDistance({ dateFrom, dateTo })])
      .then(([a, d]) => {
        setAttendance(a.filter((r) => r.user_id === userId));
        setDistance(d.filter((r) => r.user_id === userId));
      })
      .catch(() => {
        setAttendance([]);
        setDistance([]);
      })
      .finally(() => setLoading(false));
  }, [userId, monthDate]);

  const presentDates = useMemo(() => new Set(attendance.map((r) => r.activity_date)), [attendance]);
  const distanceByDate = useMemo(() => new Map(distance.map((r) => [r.activity_date, r.distance_km])), [distance]);
  const totalDistance = useMemo(() => distance.reduce((sum, r) => sum + Number(r.distance_km || 0), 0), [distance]);

  const cells = useMemo(() => buildCells(monthDate), [monthDate]);
  const today = isoDate(new Date());
  const presentCount = presentDates.size;
  const pastCellCount = cells.filter((c) => c && isoDate(c) <= today).length;
  const absentCount = Math.max(0, pastCellCount - presentCount);
  const rate = pastCellCount ? Math.round((presentCount / pastCellCount) * 100) : 0;

  const selectedUser = users.find((u) => u.id === userId);
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (!loading && users.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Attendance</h2>
        <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
          No Surveyors, Rectifiers, Supervisors, or ZOs yet — add field staff under Admin → Users to see attendance here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance</h2>
          <p className="text-xs text-slate-400 mt-0.5">Derived from activity — present on any day with ≥1 filed or resolved report.</p>
        </div>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} · {u.designation || u.role}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Present" value={`${presentCount} days`} tone="emerald" />
        <StatCard label="Absent" value={`${absentCount} days`} tone="rose" />
        <StatCard label="Attendance Rate" value={`${rate}%`} />
        <StatCard label="Distance This Month" value={`${totalDistance.toFixed(1)} km`} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="text-xs font-medium text-amber-700 px-2 py-1"
          >
            ← Prev
          </button>
          <div className="text-sm font-semibold text-slate-700">{monthLabel}</div>
          <button
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="text-xs font-medium text-amber-700 px-2 py-1"
          >
            Next →
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {DOW.map((d) => (
              <div key={d} className="text-[10px] font-bold text-slate-400 uppercase text-center pb-1">
                {d}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const iso = isoDate(cell);
              const isFuture = iso > today;
              const isPresent = presentDates.has(iso);
              const isToday = iso === today;
              const km = distanceByDate.get(iso);
              const tone = isFuture ? 'bg-slate-50 text-slate-300 border-dashed' : isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-1.5 h-16 flex flex-col justify-between text-[10px] font-semibold ${tone} ${
                    isFuture ? 'border-slate-200' : 'border-transparent'
                  } ${isToday ? 'ring-2 ring-slate-900' : ''}`}
                >
                  <span>{cell.getDate()}</span>
                  {!isFuture && <span className="font-normal">{isPresent ? (km ? `${km} km` : 'Present') : 'Absent'}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedUser && <p className="text-[11px] text-slate-400">{selectedUser.full_name}'s assigned area determines which reports count toward attendance.</p>}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-slate-700';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3">
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${toneClass}`}>{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{value}</div>
    </div>
  );
}
