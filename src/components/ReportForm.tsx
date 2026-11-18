import { Plus, Trash2 } from 'lucide-react';
import { SECTIONS, STATUSES, type ReportData, type Substation } from '../types/report';
import type { FieldErrors } from '../lib/validation';
import { Card, FormField } from './ui';
import { SubstationCombobox } from './SubstationCombobox';
import { VoltageMultiSelect } from './VoltageMultiSelect';
import { SuggestInput } from './SuggestInput';
import { DateInput } from './DateInput';
import { COMPANY_OPTIONS, CONTRACT_OPTIONS } from '../data/listOptions';

type Update = <K extends keyof ReportData>(key: K, value: ReportData[K]) => void;

export function ReportForm({
  report: r,
  update,
  errors,
  substations,
  substationsLoading,
}: {
  report: ReportData;
  update: Update;
  errors: FieldErrors;
  substations: Substation[];
  substationsLoading: boolean;
}) {
  const cls = (k: keyof ReportData) => `input ${errors[k] ? 'input-error' : ''}`;
  const aria = (k: keyof ReportData) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${k}-error` : undefined,
  });

  return (
    <>
      <Card title="General / Equipment Information">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField id="engineerName" label="Engineer Name" required error={errors.engineerName} className="md:col-start-1 md:row-start-1">
            <input id="engineerName" className={cls('engineerName')} {...aria('engineerName')} value={r.engineerName} onChange={(e) => update('engineerName', e.target.value)} />
          </FormField>

          <div className="md:col-span-2 md:row-start-2">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-slate-700">Foreman Name(s)</span>
                <span className="block text-xs text-slate-500 sm:ml-2 sm:inline">Optional · shown in the PDF only</span>
              </div>
              <button type="button" className="btn btn-secondary shrink-0 py-1.5 whitespace-nowrap" onClick={() => update('foremanNames', [...r.foremanNames, ''])}>
                <Plus className="h-4 w-4" /> Add foreman
              </button>
            </div>
            {r.foremanNames.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-center text-xs text-slate-500">No foreman added.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-6">
                {r.foremanNames.map((name, i) => (
                  <li key={i} className="flex gap-2">
                    <input
                      className="input"
                      aria-label={`Foreman ${i + 1} name`}
                      placeholder={`Foreman ${i + 1}`}
                      value={name}
                      autoFocus={name === '' && i === r.foremanNames.length - 1}
                      onChange={(e) => update('foremanNames', r.foremanNames.map((n, j) => (j === i ? e.target.value : n)))}
                    />
                    <button type="button" aria-label={`Remove foreman ${i + 1}`} className="btn btn-ghost px-2 text-red-600 hover:bg-red-50" onClick={() => update('foremanNames', r.foremanNames.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <FormField id="substation" label="Substation Name" required error={errors.substation} className="md:col-start-2 md:row-start-1">
            <SubstationCombobox
              id="substation"
              substations={substations}
              value={r.substation}
              onChange={(s) => update('substation', s)}
              invalid={!!errors.substation}
              disabled={substationsLoading}
            />
          </FormField>

          <FormField id="equipmentName" label="Equipment ID / Name" required error={errors.equipmentName} hint="e.g. 30MVA TR 1">
            <input id="equipmentName" className={cls('equipmentName')} {...aria('equipmentName')} placeholder="30MVA TR 1" value={r.equipmentName} onChange={(e) => update('equipmentName', e.target.value)} />
          </FormField>

          <FormField id="voltages" label="Voltage" required error={errors.voltages} hint="Select one or more.">
            <VoltageMultiSelect id="voltages" value={r.voltages} onChange={(v) => update('voltages', v)} invalid={!!errors.voltages} />
          </FormField>

          <FormField id="section" label="Section" required error={errors.section}>
            <select id="section" className={cls('section')} {...aria('section')} value={r.section} onChange={(e) => update('section', e.target.value as ReportData['section'])}>
              <option value="" disabled>Select section…</option>
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>

          <FormField id="status" label="Status" required error={errors.status}>
            <select id="status" className={cls('status')} {...aria('status')} value={r.status} onChange={(e) => update('status', e.target.value as ReportData['status'])}>
              <option value="" disabled>Select status…</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>

          <FormField id="startDate" label="Starting Date" required error={errors.startDate} hint="DD/MM/YYYY">
            <DateInput id="startDate" value={r.startDate} onChange={(v) => update('startDate', v)} invalid={!!errors.startDate} describedBy={errors.startDate ? 'startDate-error' : undefined} />
          </FormField>

          <FormField id="finishDate" label="Finishing Date" error={errors.finishDate} hint="DD/MM/YYYY · leave blank if the work is ongoing.">
            <DateInput id="finishDate" value={r.finishDate} onChange={(v) => update('finishDate', v)} invalid={!!errors.finishDate} describedBy={errors.finishDate ? 'finishDate-error' : undefined} />
          </FormField>

          <FormField id="companyName" label="Company Name">
            <SuggestInput id="companyName" value={r.companyName} onChange={(v) => update('companyName', v)} options={COMPANY_OPTIONS} placeholder="Search or type a company..." />
          </FormField>

          <FormField id="contractNumber" label="Contract Number">
            <SuggestInput id="contractNumber" value={r.contractNumber} onChange={(v) => update('contractNumber', v)} options={CONTRACT_OPTIONS} placeholder="Search or type a contract number..." />
          </FormField>
        </div>
      </Card>

      <Card title="Repair Details">
        <div className="space-y-4">
          <FormField id="reasonOfRepair" label="Reason of Repair" required error={errors.reasonOfRepair}>
            <textarea id="reasonOfRepair" rows={3} className={cls('reasonOfRepair')} {...aria('reasonOfRepair')} value={r.reasonOfRepair} onChange={(e) => update('reasonOfRepair', e.target.value)} />
          </FormField>
          <FormField id="jobDescription" label="Job Description" required error={errors.jobDescription}>
            <textarea id="jobDescription" rows={5} className={cls('jobDescription')} {...aria('jobDescription')} value={r.jobDescription} onChange={(e) => update('jobDescription', e.target.value)} />
          </FormField>
          <FormField id="materialsUsed" label="Materials Used">
            <textarea id="materialsUsed" rows={3} className="input" value={r.materialsUsed} onChange={(e) => update('materialsUsed', e.target.value)} />
          </FormField>
        </div>
      </Card>
    </>
  );
}
