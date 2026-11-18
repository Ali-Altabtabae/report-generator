import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FilePlus2, FileSpreadsheet, FileText, FolderOpen, Info, Loader2, Save, X, Zap } from 'lucide-react';
import { emptyReport, type ReportData, type Substation } from './types/report';
import { loadSubstations } from './lib/substations';
import { validateReport, type FieldErrors } from './lib/validation';
import { buildCsv } from './lib/csvExport';
import { buildDraft, parseDraft, MAX_DRAFT_BYTES } from './lib/draftJson';
import { downloadBlob, draftFilename, reportFilename } from './lib/filenames';
import { formatBytes } from './lib/photos';
import { ReportForm } from './components/ReportForm';
import { PdfExtras } from './components/PdfExtras';
import { ReportPreview } from './components/ReportPreview';

type Notice = { kind: 'success' | 'error' | 'warning'; text: string } | null;

export default function App() {
  const [report, setReport] = useState<ReportData>(emptyReport);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
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

  const update = useCallback(<K extends keyof ReportData>(key: K, value: ReportData[K]) => {
    setReport((r) => ({ ...r, [key]: value }));
    setDirty(true);
  }, []);

  const errors: FieldErrors = validateReport(report);
  const visibleErrors = showErrors ? errors : {};
  const errorCount = Object.keys(errors).length;

  const ensureValid = (): boolean => {
    if (errorCount === 0) return true;
    setShowErrors(true);
    setNotice({ kind: 'error', text: `Please fix ${errorCount} field${errorCount > 1 ? 's' : ''} before exporting.` });
    const first = Object.keys(errors)[0];
    setTimeout(() => {
      const el = document.getElementById(first);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.focus({ preventScroll: true });
    }, 0);
    return false;
  };

  const downloadCsv = () => {
    if (!ensureValid()) return false;
    downloadBlob(new Blob([buildCsv(report)], { type: 'text/csv;charset=utf-8' }), reportFilename(report, 'csv'));
    return true;
  };

  const downloadPdf = async () => {
    if (!ensureValid()) return false;
    setPdfBusy(true);
    try {
      const { generatePdfBlob } = await import('./lib/pdfExport');
      downloadBlob(await generatePdfBlob(report), reportFilename(report, 'pdf'));
      return true;
    } catch (e) {
      setNotice({ kind: 'error', text: `PDF generation failed: ${(e as Error).message}` });
      return false;
    } finally {
      setPdfBusy(false);
    }
  };

  const onCsv = () => downloadCsv() && setNotice({ kind: 'success', text: 'CSV download started.' });
  const onPdf = async () => (await downloadPdf()) && setNotice({ kind: 'success', text: 'PDF download started.' });
  const onBoth = async () => {
    if (!ensureValid()) return;
    downloadCsv();
    if (await downloadPdf()) setNotice({ kind: 'success', text: 'CSV and PDF downloads started.' });
  };

  const saveDraft = () => {
    const json = buildDraft(report);
    downloadBlob(new Blob([json], { type: 'application/json' }), draftFilename(report));
    setDirty(false);
    const size = new Blob([json]).size;
    setNotice({
      kind: size > 10 * 1024 * 1024 ? 'warning' : 'success',
      text: size > 10 * 1024 * 1024
        ? `Draft download started (${formatBytes(size)}). This draft is large because it contains photos.`
        : 'Draft (.json) download started. Keep the file to continue editing later.',
    });
  };

  const loadDraft = async (file: File | undefined) => {
    if (!file) return;
    if (dirty && !window.confirm('Loading a draft will replace the current form. Unsaved changes will be lost. Continue?')) return;
    if (file.size > MAX_DRAFT_BYTES) {
      setNotice({ kind: 'error', text: `This file is too large (${formatBytes(file.size)}) to be a report draft.` });
      return;
    }
    try {
      const { report: loaded, warnings } = parseDraft(await file.text(), substations);
      setReport(loaded);
      setFormKey((k) => k + 1);
      setShowErrors(false);
      setDirty(false);
      setNotice(warnings.length ? { kind: 'warning', text: warnings.join(' ') } : { kind: 'success', text: `Draft "${file.name}" loaded.` });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    }
  };

  const clearForm = () => {
    if (dirty && !window.confirm('Start a new report? All unsaved data in the current form will be discarded.')) return;
    setReport(emptyReport());
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
          <h1 className="text-xl font-semibold text-slate-900">New Maintenance / Repair Report</h1>
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

        <div key={formKey} className="space-y-5">
          <ReportForm report={report} update={update} errors={visibleErrors} substations={substations} substationsLoading={loading} />
          <PdfExtras report={report} update={update} errors={visibleErrors} />
        </div>
        <ReportPreview report={report} />

        <p className="text-center text-xs text-slate-400">
          {substations.length > 0 && <>{substations.length} substations loaded · </>}
          Live / Dead status is recorded as report data only and is not a safety clearance.
        </p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="hidden text-xs text-slate-500 sm:block">
            {showErrors && errorCount > 0 ? <span className="font-medium text-red-600">{errorCount} required field{errorCount > 1 ? 's' : ''} need attention</span> : 'Both files use the same form data.'}
          </p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" className="btn btn-secondary flex-1 sm:flex-none" onClick={onCsv} disabled={exportDisabled}>
              <FileSpreadsheet className="h-4 w-4" /> Download CSV
            </button>
            <button type="button" className="btn btn-secondary flex-1 sm:flex-none" onClick={onPdf} disabled={exportDisabled || pdfBusy}>
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Download PDF
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
