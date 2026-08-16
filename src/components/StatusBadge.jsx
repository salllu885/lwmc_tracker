const STATUS_STYLES = {
  SUBMITTED: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
  REOPENED: 'bg-rose-100 text-rose-700',
};

export default function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.SUBMITTED;
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}
