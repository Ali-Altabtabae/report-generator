import { useEffect, useState } from 'react';
import { ExternalLink, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { ReportData } from '../types/report';
import { CSV_HEADERS, buildCsv, buildCsvRow } from '../lib/csvExport';

type Tab = 'csv' | 'pdf';

function PdfPreview({ report }: { report: ReportData }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const { generatePdfBlob } = await import('../lib/pdfExport');
        const blob = await generatePdfBlob(report);
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
        setError('');
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Could not generate the PDF preview.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (created) setTimeout(() => URL.revokeObjectURL(created!), 5000);
    };
  }, [report]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? 'Updating preview…' : 'Preview updates automatically as you type.'}
        </span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
            Open in new tab <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-red-600" role="alert">{error}</p>}
      {url ? (
        <iframe title="PDF preview" src={url} className="h-[70vh] min-h-[420px] w-full rounded-md border border-slate-200 bg-slate-50" />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">Generating preview…</div>
      )}
    </div>
  );
}

export function ReportPreview({ reports, activeIndex }: { reports: ReportData[]; activeIndex: number }) {
  const [tab, setTab] = useState<Tab>('csv');
  const report = reports[activeIndex];
  const many = reports.length > 1;
  const row = buildCsvRow(report);
  const tabBtn = (t: Tab, label: string, Icon: typeof FileText) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
        tab === t ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6">
        <h2 className="py-3 text-sm font-semibold tracking-wide text-slate-900 uppercase">Preview</h2>
        <div role="tablist" className="flex">
          {tabBtn('csv', 'CSV Summary', FileSpreadsheet)}
          {tabBtn('pdf', 'PDF Preview', FileText)}
        </div>
      </header>
      <div className="px-4 py-5 sm:px-6">
        {tab === 'csv' ? (
          <div className="space-y-4">
            {many && <p className="text-xs text-slate-500">Showing row {activeIndex + 1} of {reports.length} (the report you are editing).</p>}
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <tbody>
                  {CSV_HEADERS.map((h, i) => (
                    <tr key={h} className="border-b border-slate-100 last:border-0">
                      <th scope="row" className="w-44 bg-slate-50 px-3 py-2 text-left align-top text-xs font-semibold text-slate-600 sm:w-56">{h}</th>
                      <td className={`px-3 py-2 align-top whitespace-pre-wrap break-words ${i === 1 ? 'font-mono font-semibold text-blue-900' : ''}`}>
                        {row[i] || <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-slate-600">Show raw CSV text{many ? ` (all ${reports.length} rows)` : ''}</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{buildCsv(reports).replace(/^\uFEFF/, '')}</pre>
            </details>
          </div>
        ) : (
          <>
            {many && <p className="mb-2 text-xs text-slate-500">Previewing report {activeIndex + 1} of {reports.length}. Each report is downloaded as its own PDF.</p>}
            <PdfPreview report={report} />
          </>
        )}
      </div>
    </section>
  );
}
