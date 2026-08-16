export default function StatCard({ label, value, icon, tone }) {
  const toneClass =
    tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : tone === 'rose' ? 'text-rose-600' : 'text-slate-700';
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
