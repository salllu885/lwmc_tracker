import { ChevronRight, Image as ImageIcon } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { timeAgo } from '../lib/format';

export default function ReportRow({ report, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 hover:border-slate-300 transition-colors"
    >
      <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
        <ImageIcon size={18} className="text-slate-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
            {report.uc?.name || report.uc?.code}
          </span>
          <span className="text-xs font-medium" style={{ color: report.issue_type?.color }}>
            {report.issue_type?.name}
          </span>
          <StatusBadge status={report.status} />
        </div>
        <div className="text-sm text-slate-700 truncate mt-0.5">{report.description || report.address || 'No note'}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {report.report_number} · {report.reporter?.full_name} · {timeAgo(report.created_at)}
        </div>
      </div>
      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
    </button>
  );
}
