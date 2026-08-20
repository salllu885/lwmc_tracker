// Two states only, per the amendment — "just reported and closed/resolved".
// Any legacy non-CLOSED value (SUBMITTED/IN_PROGRESS/REOPENED from before
// this simplification) still displays as "Reported" rather than a raw enum
// name.
export default function StatusBadge({ status }) {
  const isClosed = status === 'CLOSED';
  const cls = isClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>
      {isClosed ? 'Resolved' : 'Reported'}
    </span>
  );
}
