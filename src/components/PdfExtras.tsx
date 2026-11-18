import { useRef, useState } from 'react';
import { ChevronDown, ImagePlus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { newId, type InspectionRow, type Photo, type ReportData } from '../types/report';
import { MAX_PHOTOS_PER_GROUP, fileToPhoto, formatBytes, photosSize } from '../lib/photos';
import { FormField } from './ui';
import { DateInput } from './DateInput';
import type { FieldErrors } from '../lib/validation';

type Update = <K extends keyof ReportData>(key: K, value: ReportData[K]) => void;

function PhotoGroup({
  title,
  photos,
  onChange,
}: {
  title: string;
  photos: Photo[];
  onChange: (p: Photo[]) => void;
}) {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const room = MAX_PHOTOS_PER_GROUP - photos.length;
    const list = Array.from(files);
    if (list.length > room) setError(`Only ${MAX_PHOTOS_PER_GROUP} photos are allowed per group; extra files were not added.`);
    setBusy(true);
    const added: Photo[] = [];
    for (const f of list.slice(0, Math.max(0, room))) {
      try {
        added.push(await fileToPhoto(f));
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setBusy(false);
    onChange([...photos, ...added]);
  };

  const replace = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !replaceId) return;
    setError('');
    setBusy(true);
    try {
      const p = await fileToPhoto(f);
      onChange(photos.map((x) => (x.id === replaceId ? { ...p, id: x.id, caption: x.caption } : x)));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
    setReplaceId(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700">
          {title} <span className="font-normal text-slate-400">({photos.length}/{MAX_PHOTOS_PER_GROUP})</span>
        </h4>
        <button type="button" className="btn btn-secondary py-1.5" disabled={busy || photos.length >= MAX_PHOTOS_PER_GROUP} onClick={() => addRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> {busy ? 'Processing…' : 'Add photos'}
        </button>
        <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => { replace(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <p className="mb-2 text-xs font-medium text-red-600" role="alert">{error}</p>}
      {photos.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">No photos added.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {photos.map((p, i) => (
            <li key={p.id} className="rounded-md border border-slate-200 p-2">
              <img src={p.dataUrl} alt={p.caption || `${title} photo ${i + 1}`} className="h-36 w-full rounded bg-slate-50 object-contain" />
              <input
                type="text"
                className="input mt-2 py-1.5"
                placeholder="Caption (optional)"
                aria-label={`Caption for ${title} photo ${i + 1}`}
                value={p.caption}
                onChange={(e) => onChange(photos.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))}
              />
              <div className="mt-2 flex justify-end gap-1">
                <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => { setReplaceId(p.id); replaceRef.current?.click(); }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Replace
                </button>
                <button type="button" className="btn btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => onChange(photos.filter((x) => x.id !== p.id))}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PdfExtras({ report: r, update, errors }: { report: ReportData; update: Update; errors: FieldErrors }) {
  const [open, setOpen] = useState(
    () =>
      [r.reportReference, r.equipmentType, r.serialNumber, r.ratedCapacity, r.location, r.observations, r.recommendations, r.preparedDate].some((v) => v.trim()) ||
      r.inspectionRows.length + r.beforePhotos.length + r.afterPhotos.length > 0,
  );
  const photoBytes = photosSize([...r.beforePhotos, ...r.afterPhotos]);

  const setRow = (id: string, patch: Partial<InspectionRow>) =>
    update('inspectionRows', r.inspectionRows.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="pdf-extras"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-6"
      >
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">Additional PDF Details</h2>
          <p className="mt-0.5 text-xs text-slate-500">Optional · Technical details, test results, photos, recommendations. Not added to the CSV.</p>
        </div>
        <span className="flex items-center gap-1 text-sm text-slate-600">
          {open ? 'Collapse' : 'Expand'}
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div id="pdf-extras" className="space-y-8 border-t border-slate-200 px-4 py-5 sm:px-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Report & equipment details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="reportReference" label="Report Reference" hint="Optional human-readable reference shown in the PDF header.">
                <input id="reportReference" className="input" value={r.reportReference} onChange={(e) => update('reportReference', e.target.value)} />
              </FormField>
              <FormField id="equipmentType" label="Equipment Type / Model">
                <input id="equipmentType" className="input" value={r.equipmentType} onChange={(e) => update('equipmentType', e.target.value)} />
              </FormField>
              <FormField id="serialNumber" label="Serial Number">
                <input id="serialNumber" className="input" value={r.serialNumber} onChange={(e) => update('serialNumber', e.target.value)} />
              </FormField>
              <FormField id="ratedCapacity" label="Rated Capacity">
                <input id="ratedCapacity" className="input" placeholder="e.g. 30 MVA" value={r.ratedCapacity} onChange={(e) => update('ratedCapacity', e.target.value)} />
              </FormField>
              <FormField id="location" label="Location / Bay" className="sm:col-span-2">
                <input id="location" className="input" value={r.location} onChange={(e) => update('location', e.target.value)} />
              </FormField>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Inspection / testing notes</h3>
              <button
                type="button"
                className="btn btn-secondary py-1.5"
                onClick={() => update('inspectionRows', [...r.inspectionRows, { id: newId(), parameter: '', value: '', unit: '', remarks: '' }])}
              >
                <Plus className="h-4 w-4" /> Add row
              </button>
            </div>
            {r.inspectionRows.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">No test entries. Values are recorded as entered — nothing is judged automatically.</p>
            ) : (
              <div className="space-y-3">
                <div className="hidden grid-cols-[3fr_2fr_1fr_4fr_auto] gap-2 text-xs font-medium text-slate-500 sm:grid">
                  <span>Test / Parameter</span><span>Measured Value</span><span>Unit</span><span>Result / Remarks</span><span className="w-8" />
                </div>
                {r.inspectionRows.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[3fr_2fr_1fr_4fr_auto] sm:border-0 sm:p-0">
                    <input className="input col-span-2 sm:col-span-1" placeholder="Test / Parameter" aria-label={`Row ${i + 1} test or parameter`} value={row.parameter} onChange={(e) => setRow(row.id, { parameter: e.target.value })} />
                    <input className="input" placeholder="Measured Value" aria-label={`Row ${i + 1} measured value`} value={row.value} onChange={(e) => setRow(row.id, { value: e.target.value })} />
                    <input className="input" placeholder="Unit" aria-label={`Row ${i + 1} unit`} value={row.unit} onChange={(e) => setRow(row.id, { unit: e.target.value })} />
                    <input className="input col-span-2 sm:col-span-1" placeholder="Result / Remarks" aria-label={`Row ${i + 1} result or remarks`} value={row.remarks} onChange={(e) => setRow(row.id, { remarks: e.target.value })} />
                    <button type="button" aria-label={`Remove row ${i + 1}`} className="btn btn-ghost col-span-2 px-2 text-red-600 hover:bg-red-50 sm:col-span-1" onClick={() => update('inspectionRows', r.inspectionRows.filter((x) => x.id !== row.id))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <FormField id="observations" label="Work Performed / Observations">
            <textarea id="observations" rows={4} className="input" value={r.observations} onChange={(e) => update('observations', e.target.value)} />
          </FormField>

          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Photographs</h3>
            <p className="mb-3 text-xs text-slate-500">
              Photos are resized and compressed in your browser. They are included in the PDF and in saved JSON drafts
              {photoBytes > 0 && <> (currently ≈ {formatBytes(photoBytes)})</>}.
              {photoBytes > 8 * 1024 * 1024 && <span className="font-medium text-amber-700"> Drafts with many photos can be large.</span>}
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PhotoGroup title="Before Repair" photos={r.beforePhotos} onChange={(p) => update('beforePhotos', p)} />
              <PhotoGroup title="After Repair" photos={r.afterPhotos} onChange={(p) => update('afterPhotos', p)} />
            </div>
          </div>

          <FormField id="recommendations" label="Recommendations / Outstanding Work">
            <textarea id="recommendations" rows={3} className="input" value={r.recommendations} onChange={(e) => update('recommendations', e.target.value)} />
          </FormField>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Prepared by</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField id="preparedDate" label="Date" error={errors.preparedDate} hint="Optional. DD/MM/YYYY. If left empty, the PDF shows a blank line to write the date by hand.">
                <DateInput id="preparedDate" value={r.preparedDate} onChange={(v) => update('preparedDate', v)} invalid={!!errors.preparedDate} describedBy={errors.preparedDate ? 'preparedDate-error' : undefined} />
              </FormField>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
