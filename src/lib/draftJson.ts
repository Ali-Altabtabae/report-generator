import {
  SECTIONS,
  STATUSES,
  emptyReport,
  newId,
  type InspectionRow,
  type Photo,
  type ReportData,
  type Substation,
} from '../types/report';
import { isValidIso } from './dates';
import { MAX_PHOTOS_PER_GROUP } from './photos';

export const APP_NAME = 'Transformer Department Report Generator';
/** Version 2 stores a list of reports. Version 1 files (a single report) still load. */
export const SCHEMA_VERSION = 2;
export const MAX_DRAFT_BYTES = 80 * 1024 * 1024;
export const MAX_REPORTS = 30;

export interface DraftFile {
  appName: string;
  schemaVersion: number;
  savedAt: string;
  reports: ReportData[];
}

export function buildDraft(reports: ReportData[]): string {
  const draft: DraftFile = {
    appName: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    // Half-typed dates are not saved; only complete, valid dates are kept.
    reports: reports.map((report) => ({
      ...report,
      startDate: isValidIso(report.startDate) ? report.startDate : '',
      finishDate: isValidIso(report.finishDate) ? report.finishDate : '',
      preparedDate: isValidIso(report.preparedDate) ? report.preparedDate : '',
    })),
  };
  return JSON.stringify(draft, null, 2);
}

export interface LoadedDraft {
  reports: ReportData[];
  savedAt: string;
  warnings: string[];
}

class DraftError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function str(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw new DraftError(`Field "${key}" must be text.`);
  return v;
}

function parsePhotos(v: unknown, key: string): Photo[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new DraftError(`Field "${key}" must be a list.`);
  if (v.length > MAX_PHOTOS_PER_GROUP) throw new DraftError(`Field "${key}" has too many photos.`);
  return v.map((p, i) => {
    if (!isObj(p)) throw new DraftError(`Photo ${i + 1} in "${key}" is invalid.`);
    const dataUrl = str(p, 'dataUrl');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl))
      throw new DraftError(`Photo ${i + 1} in "${key}" is not a valid embedded image.`);
    const width = Number(p.width) || 0;
    const height = Number(p.height) || 0;
    return { id: newId(), dataUrl, caption: str(p, 'caption'), width, height };
  });
}

function parseRows(v: unknown): InspectionRow[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new DraftError('Field "inspectionRows" must be a list.');
  return v.map((r, i) => {
    if (!isObj(r)) throw new DraftError(`Inspection row ${i + 1} is invalid.`);
    return {
      id: newId(),
      parameter: str(r, 'parameter'),
      value: str(r, 'value'),
      unit: str(r, 'unit'),
      remarks: str(r, 'remarks'),
    };
  });
}

/** Validate one report object. `label` (e.g. "Report 2: ") prefixes messages when a draft has several. */
function parseReport(r: unknown, substations: Substation[], label: string): { report: ReportData; warnings: string[] } {
  try {
    if (!isObj(r)) throw new DraftError('The report data is missing or invalid.');
    const warnings: string[] = [];
    const report = emptyReport();

    for (const key of [
      'engineerName', 'equipmentName', 'companyName', 'contractNumber', 'reasonOfRepair',
      'jobDescription', 'materialsUsed', 'reportReference', 'equipmentType', 'serialNumber',
      'ratedCapacity', 'location', 'observations', 'recommendations',
    ] as const) {
      report[key] = str(r, key);
    }

    const section = str(r, 'section');
    if (section && !SECTIONS.includes(section as never)) throw new DraftError(`Invalid Section value "${section}".`);
    report.section = section as ReportData['section'];

    const status = str(r, 'status');
    if (status && !STATUSES.includes(status as never)) throw new DraftError(`Invalid Status value "${status}".`);
    report.status = status as ReportData['status'];

    for (const key of ['startDate', 'finishDate', 'preparedDate'] as const) {
      const v = str(r, key);
      if (v && !isValidIso(v)) throw new DraftError(`Field "${key}" is not a valid date.`);
      report[key] = v;
    }

    if (r.voltages !== undefined) {
      if (!Array.isArray(r.voltages) || r.voltages.some((v) => typeof v !== 'string' || !v.trim()))
        throw new DraftError('Field "voltages" must be a list of text values.');
      report.voltages = [...new Set(r.voltages as string[])];
    }

    if (r.foremanNames !== undefined) {
      if (!Array.isArray(r.foremanNames) || r.foremanNames.some((v) => typeof v !== 'string'))
        throw new DraftError('Field "foremanNames" must be a list of text values.');
      report.foremanNames = r.foremanNames as string[];
    }

    report.inspectionRows = parseRows(r.inspectionRows);
    report.beforePhotos = parsePhotos(r.beforePhotos, 'beforePhotos');
    report.afterPhotos = parsePhotos(r.afterPhotos, 'afterPhotos');

    if (r.substation !== undefined && r.substation !== null) {
      const s = r.substation;
      if (!isObj(s) || typeof s.no !== 'number')
        throw new DraftError('The saved substation is invalid.');
      const saved = { no: s.no as number, code: String(s.code ?? ''), fullName: String(s.fullName ?? '') };
      const current = substations.find((x) => x.no === saved.no);
      if (!current) {
        warnings.push(
          `${label}The saved substation (NO ${saved.no}: ${saved.code} — ${saved.fullName}) no longer exists in the current substation list. Please select the substation again.`,
        );
      } else if (current.code !== saved.code || current.fullName !== saved.fullName) {
        warnings.push(
          `${label}The saved substation (NO ${saved.no}: ${saved.code} — ${saved.fullName}) has changed in the current list to ${current.code} — ${current.fullName}. Please confirm or select the substation again.`,
        );
      } else {
        report.substation = current;
      }
    }

    return { report, warnings };
  } catch (err) {
    if (err instanceof DraftError) throw new DraftError(label + err.message);
    throw err;
  }
}

/**
 * Validate and parse a draft file. Never executes content — only JSON.parse plus strict
 * type checks. Saved stations are matched by NO against the current list; they are never
 * substituted with a different record.
 */
export function parseDraft(text: string, substations: Substation[]): LoadedDraft {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. It may be corrupted or not a report draft.');
  }
  try {
    if (!isObj(data) || data.appName !== APP_NAME)
      throw new DraftError('This file is not a Transformer Report Generator draft.');

    let rawReports: unknown[];
    if (data.schemaVersion === 1) {
      rawReports = [data.report];
    } else if (data.schemaVersion === SCHEMA_VERSION) {
      if (!Array.isArray(data.reports) || data.reports.length === 0) throw new DraftError('The draft has no reports.');
      rawReports = data.reports;
    } else {
      throw new DraftError(
        `Unsupported draft version (${String(data.schemaVersion)}). This app supports versions 1 and ${SCHEMA_VERSION}.`,
      );
    }
    if (rawReports.length > MAX_REPORTS) throw new DraftError(`The draft has more than ${MAX_REPORTS} reports.`);

    const reports: ReportData[] = [];
    const warnings: string[] = [];
    rawReports.forEach((raw, i) => {
      const res = parseReport(raw, substations, rawReports.length > 1 ? `Report ${i + 1}: ` : '');
      reports.push(res.report);
      warnings.push(...res.warnings);
    });
    return { reports, savedAt: typeof data.savedAt === 'string' ? data.savedAt : '', warnings };
  } catch (err) {
    if (err instanceof DraftError) throw new Error(`Could not load draft: ${err.message}`);
    throw err;
  }
}
