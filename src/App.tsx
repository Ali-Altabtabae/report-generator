import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FilePlus2, FileSpreadsheet, FileText, FolderOpen, Info, Loader2, Save, X, Zap } from 'lucide-react';
import { emptyReport, newId, type ReportData, type Substation } from './types/report';
import { loadSubstations } from './lib/substations';
import { validateReport, type FieldErrors } from './lib/validation';
import { buildCsv } from './lib/csvExport';
import { buildDraft, parseDraft, MAX_DRAFT_BYTES, MAX_REPORTS } from './lib/draftJson';
import { csvFilename, downloadBlob, draftFilename, pdfFilenames } from './lib/filenames';
import { formatBytes } from './lib/photos';
import { ReportForm } from './components/ReportForm';
import { PdfExtras } from './components/PdfExtras';
import { ReportPreview } from './components/ReportPreview';
import { ReportTabs } from './components/ReportTabs';

type Notice = { kind: 'success' | 'error' | 'warning'; text: string } | null;

const isBlank = (r: ReportData) => JSON.stringify(r) === JSON.stringify(emptyReport());

/** Deep copy with fresh ids for photos and test rows. */
function duplicateReport(r: ReportData): ReportData {
  const c: ReportData = structuredClone(r);
  c.inspectionRows = c.inspectionRows.map((x) => ({ ...x, id: newId() }));
  c.beforePhotos = c.beforePhotos.map((x) => ({ ...x, id: newId() }));
  c.afterPhotos = c.afterPhotos.map((x) => ({ ...x, id: newId() }));
  return c;
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function App() {
  const [reports, setReports] = useState<ReportData[]>(() => [emptyReport()]);
  const [active, setActive] = useState(0);
  const report = reports[active];
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [formKey, setFormKey] = useState(0);
  const draftInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSubstations()
      .then(setSubstations)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
    // Pre-load the PDF engine so PDF export also works if the connection drops later.
    const t = setTimeout(() => {
      import('./lib/pdfExport').then((m) => m.preparePdfFonts()).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const update = useCallback(
    <K extends keyof ReportData>(key: K, value: ReportData[K]) => {
      setReports((list) => list.map((r, i) => (i === active ? { ...r, [key]: value } : r)));
      setDirty(true);
    },
    [active],
  );

  const allErrors: FieldErrors[] = reports.map(validateReport);
  const errors = allErrors[active];
  const visibleErrors = showErrors ? errors : {};
  const errorCount = Object.keys(errors).length;
  const invalidTabs = allErrors.map((e) => showErrors && Object.keys(e).length > 0);
  const many = reports.length > 1;

  /** Every report must be complete. Otherwise jump to the first report with problems. */
  const ensureValid = (): boolean => {
    const bad = allErrors.findIndex((e) => Object.keys(e).length > 0);
    if (bad === -1) return true;
    const errs = allErrors[bad];
    const n = Object.keys(errs).length;
    setShowErrors(true);
    setActive(bad);
    setNotice({
      kind: 'error',
      text: many
        ? `Report ${bad + 1} has ${n} field${n > 1 ? 's' : ''} to fix before exporting.`
        : `Please fix ${n} field${n > 1 ? 's' : ''} before exporting.`,
    });
    const first = Object.keys(errs)[0];
    setTimeout(() => {
      const el = document.getElementById(first);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.focus({ preventScroll: true });
    }, 50);
    return false;
  };

  const downloadCsv = () => {
    if (!ensureValid()) return false;
    downloadBlob(new Blob([buildCsv(reports)], { type: 'text/csv;charset=utf-8' }), csvFilename(reports));
    return true;
  };

  const downloadPdf = async () => {
    if (!ensureValid()) return false;
    setPdfBusy(true);
    try {
      const { generatePdfBlob } = await import('./lib/pdfExport');
      const names = pdfFilenames(reports);
      for (let i = 0; i < reports.length; i++) {
        if (many) setPdfProgress(`${i + 1}/${reports.length}`);
        downloadBlob(await generatePdfBlob(reports[i]), names[i]);
        // Small gap so the browser accepts each file as a separate download.
        if (i < reports.length - 1) await wait(400);
      }
      return true;
    } catch (e) {
      setNotice({ kind: 'error', text: `PDF generation failed: ${(e as Error).message}` });
      return false;
    } finally {
      setPdfBusy(false);
      setPdfProgress('');
    }
  };

  const pdfText = many ? `${reports.length} PDF downloads started.` : 'PDF download started.';
  const csvText = many ? `CSV download started (${reports.length} rows).` : 'CSV download started.';
  const onCsv = () => downloadCsv() && setNotice({ kind: 'success', text: csvText });
  const onPdf = async () => (await downloadPdf()) && setNotice({ kind: 'success', text: pdfText });
  const onBoth = async () => {
    if (!ensureValid()) return;
    downloadCsv();
    await wait(400);
    if (await downloadPdf()) setNotice({ kind: 'success', text: `${csvText} ${pdfText}` });
  };

  const addReport = () => {
    if (reports.length >= MAX_REPORTS) return;
    setReports((list) => [...list, emptyReport()]);
    setActive(reports.length);
    setDirty(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicate = () => {
    if (reports.length >= MAX_REPORTS) return;
    setReports((list) => [...list.slice(0, active + 1), duplicateReport(list[active]), ...list.slice(active + 1)]);
    setActive(active + 1);
    setDirty(true);
    setNotice({ kind: 'success', text: `Report ${active + 1} copied to a new report ${active + 2}.` });
  };

  const removeReport = (i: number) => {
    if (reports.length <= 1) return;
    if (!isBlank(reports[i]) && !window.confirm(`Remove report ${i + 1}? Its data will be discarded.`)) return;
    setReports((list) => list.filter((_, j) => j !== i));
    setActive((a) => (i < a ? a - 1 : Math.min(a, reports.length - 2)));
    setDirty(true);
  };

  const saveDraft = () => {
    const json = buildDraft(reports);
    downloadBlob(new Blob([json], { type: 'application/json' }), draftFilename(reports));
    setDirty(false);
    const size = new Blob([json]).size;
    setNotice({
      kind: size > 10 * 1024 * 1024 ? 'warning' : 'success',
      text: size > 10 * 1024 * 1024
        ? `Draft download started (${formatBytes(size)}). This draft is large because it contains photos.`
        : `Draft (.json) download started${many ? ` with ${reports.length} reports` : ''}. Keep the file to continue editing later.`,
    });
  };

  const loadDraft = async (file: File | undefined) => {
    if (!file) return;
    if (dirty && !window.confirm('Loading a draft will replace all current reports. Unsaved changes will be lost. Continue?')) return;
    if (file.size > MAX_DRAFT_BYTES) {
      setNotice({ kind: 'error', text: `This file is too large (${formatBytes(file.size)}) to be a report draft.` });
      return;
    }
    try {
      const { reports: loaded, warnings } = parseDraft(await file.text(), substations);
      setReports(loaded);
      setActive(0);
      setFormKey((k) => k + 1);
      setShowErrors(false);
      setDirty(false);
      setNotice(warnings.length ? { kind: 'warning', text: warnings.join(' ') } : { kind: 'success', text: `Draft "${file.name}" loaded${loaded.length > 1 ? ` (${loaded.length} reports)` : ''}.` });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    }
  };

  const clearForm = () => {
    if (dirty && !window.confirm(`Start over? All unsaved data in ${many ? `all ${reports.length} reports` : 'the current form'} will be discarded.`)) return;
    setReports([emptyReport()]);
    setActive(0);
    setFormKey((k) => k + 1);
    setShowErrors(false);
    setDirty(false);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportDisabled = loading || !!loadError;

  return (
    <div className="min-h-screen pb-28">
      <header className="z-30 sm:sticky sm:top-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-800 text-white">
              <Zap className="h-5 w-5" aria-hidden />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">Transformer Department</p>
              <p className="text-xs text-slate-500">Report Generator</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={clearForm}>
              <FilePlus2 className="h-4 w-4" /> New / Clear
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => draftInput.current?.click()} disabled={loading}>
              <FolderOpen className="h-4 w-4" /> Load Draft
            </button>
            <button type="button" className="btn btn-secondary" onClick={saveDraft}>
              <Save className="h-4 w-4" /> Save Draft
            </button>
            <input ref={draftInput} type="file" accept="application/json,.json" hidden onChange={(e) => { loadDraft(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            New Maintenance / Repair Report{many && <span className="font-normal text-slate-500"> · editing report {active + 1} of {reports.length}</span>}
          </h1>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Your report is processed locally in this browser. Download a JSON draft to keep an editable copy.
          </p>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">The substation list could not be loaded.</p>
              <p>{loadError} Check that <code>data/substations.csv</code> is deployed with the website, then reload the page.</p>
            </div>
          </div>
        )}
        {loading && (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading substation list…</p>
        )}

        <ReportTabs
          reports={reports}
          activeIndex={active}
          invalid={invalidTabs}
          max={MAX_REPORTS}
          onSelect={setActive}
          onAdd={addReport}
          onDuplicate={duplicate}
          onRemove={removeReport}
        />

        <div key={`${formKey}-${active}-${reports.length}`} className="space-y-5">
          <ReportForm report={report} update={update} errors={visibleErrors} substations={substations} substationsLoading={loading} />
          <PdfExtras report={report} update={update} errors={visibleErrors} />
        </div>
        <ReportPreview reports={reports} activeIndex={active} />

        <p className="text-center text-xs text-slate-400">
          {substations.length > 0 && <>{substations.length} substations loaded · </>}
          Live / Dead status is recorded as report data only and is not a safety clearance.
        </p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="hidden text-xs text-slate-500 sm:block">
            {showErrors && invalidTabs.some(Boolean) ? (
              <span className="font-medium text-red-600">
                {many ? `${invalidTabs.filter(Boolean).length} report(s) need attention` : `${errorCount} required field${errorCount > 1 ? 's' : ''} need attention`}
              </span>
            ) : many ? (
              `${reports.length} reports · 1 CSV (${reports.length} rows) · ${reports.length} PDFs`
            ) : (
              'Both files use the same form data.'
            )}
          </p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" className="btn btn-secondary flex-1 sm:flex-none" onClick={onCsv} disabled={exportDisabled}>
              <FileSpreadsheet className="h-4 w-4" /> Download CSV
            </button>
            <button type="button" className="btn btn-secondary flex-1 sm:flex-none" onClick={onPdf} disabled={exportDisabled || pdfBusy}>
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {pdfProgress ? `PDF ${pdfProgress}…` : many ? `Download PDFs (${reports.length})` : 'Download PDF'}
            </button>
            <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={onBoth} disabled={exportDisabled || pdfBusy}>
              <Download className="h-4 w-4" /> Download Both
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`fixed right-4 bottom-36 left-4 z-40 mx-auto flex max-w-lg items-start gap-2 rounded-md border px-4 py-3 text-sm shadow-lg sm:bottom-24 ${
            notice.kind === 'success' ? 'border-green-200 bg-green-50 text-green-800' : notice.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notice.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="flex-1">{notice.text}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="rounded p-0.5 hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
