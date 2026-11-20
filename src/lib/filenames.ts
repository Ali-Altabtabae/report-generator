import type { ReportData } from '../types/report';
import { todayIso } from './dates';

export function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Report';
}

function stationPart(r: ReportData): string {
  return sanitizeFilenamePart(r.substation?.code ?? 'Unassigned');
}

export function reportFilename(r: ReportData, ext: 'csv' | 'pdf'): string {
  return `Transformer_Report_${stationPart(r)}_${todayIso()}.${ext}`;
}

/** One CSV for all reports. A single report keeps the original name. */
export function csvFilename(reports: ReportData[]): string {
  if (reports.length === 1) return reportFilename(reports[0], 'csv');
  return `Transformer_Reports_${reports.length}_reports_${todayIso()}.csv`;
}

/**
 * One PDF per report. With several reports the equipment name is added so every
 * file name is different, and any remaining clash gets a _2, _3 … suffix.
 */
export function pdfFilenames(reports: ReportData[]): string[] {
  if (reports.length === 1) return [reportFilename(reports[0], 'pdf')];
  const used = new Map<string, number>();
  return reports.map((r) => {
    const equipment = r.equipmentName.trim() ? `_${sanitizeFilenamePart(r.equipmentName)}` : '';
    const base = `Transformer_Report_${stationPart(r)}${equipment}_${todayIso()}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return `${base}${n > 1 ? `_${n}` : ''}.pdf`;
  });
}

export function draftFilename(reports: ReportData[]): string {
  if (reports.length === 1) return `Transformer_Report_Draft_${stationPart(reports[0])}_${todayIso()}.json`;
  return `Transformer_Reports_Draft_${reports.length}_reports_${todayIso()}.json`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
