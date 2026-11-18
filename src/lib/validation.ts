import { SECTIONS, STATUSES, type ReportData } from '../types/report';
import { isValidIso } from './dates';

export type FieldErrors = Partial<Record<keyof ReportData, string>>;

export function validateReport(r: ReportData): FieldErrors {
  const e: FieldErrors = {};
  if (!r.engineerName.trim()) e.engineerName = 'Engineer Name is required.';
  if (!r.substation) e.substation = 'Select a substation from the list.';
  if (!r.equipmentName.trim()) e.equipmentName = 'Equipment ID / Name is required.';
  if (r.voltages.length === 0) e.voltages = 'Select at least one voltage.';
  if (!SECTIONS.includes(r.section as never)) e.section = 'Select a section.';
  if (!STATUSES.includes(r.status as never)) e.status = 'Select Live or Dead.';
  if (!r.startDate) e.startDate = 'Starting Date is required.';
  else if (!isValidIso(r.startDate)) e.startDate = 'Enter a valid date as DD/MM/YYYY.';
  if (r.finishDate) {
    if (!isValidIso(r.finishDate)) e.finishDate = 'Enter a valid date as DD/MM/YYYY.';
    else if (r.startDate && r.finishDate < r.startDate)
      e.finishDate = 'Finishing Date cannot be earlier than Starting Date.';
  }
  if (r.preparedDate && !isValidIso(r.preparedDate)) e.preparedDate = 'Enter a valid date as DD/MM/YYYY, or leave it empty.';
  if (!r.reasonOfRepair.trim()) e.reasonOfRepair = 'Reason of Repair is required.';
  if (!r.jobDescription.trim()) e.jobDescription = 'Job Description is required.';
  return e;
}
