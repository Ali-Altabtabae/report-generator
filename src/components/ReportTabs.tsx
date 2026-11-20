import { AlertCircle, Copy, Plus, X } from 'lucide-react';
import type { ReportData } from '../types/report';

export function reportLabel(r: ReportData): string {
  const parts = [r.substation?.code, r.equipmentName.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'New report';
}

export function ReportTabs({
  reports,
  activeIndex,
  invalid,
  max,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
}: {
  reports: ReportData[];
  activeIndex: number;
  /** Per report: true when it has fields to fix (only shown after an export attempt). */
  invalid: boolean[];
  max: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: (i: number) => void;
}) {
  const full = reports.length >= max;
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
          Reports <span className="font-normal text-slate-500 normal-case">({reports.length})</span>
        </h2>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary py-1.5" onClick={onDuplicate} disabled={full} title="Copy the current report into a new one">
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button type="button" className="btn btn-secondary py-1.5" onClick={onAdd} disabled={full}>
            <Plus className="h-4 w-4" /> Add report
          </button>
        </div>
      </div>
      <div role="tablist" aria-label="Reports" className="mt-3 flex flex-wrap gap-2">
        {reports.map((r, i) => {
          const active = i === activeIndex;
          return (
            <div
              key={i}
              className={`flex items-center rounded-md border text-sm ${
                active ? 'border-blue-700 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'
              } ${invalid[i] ? 'border-red-400' : ''}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(i)}
                className="flex max-w-[16rem] items-center gap-1.5 truncate py-1.5 pr-1 pl-3 font-medium"
              >
                <span className="text-slate-400">{i + 1}.</span>
                <span className="truncate">{reportLabel(r)}</span>
                {invalid[i] && <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-label="has fields to fix" />}
              </button>
              {reports.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove report ${i + 1}`}
                  onClick={() => onRemove(i)}
                  className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {reports.length > 1 && (
        <p className="mt-2 text-xs text-slate-500">
          Downloads include all {reports.length} reports: one CSV with a row per report, and a separate PDF for each report.
        </p>
      )}
    </section>
  );
}
