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

export function draftFilename(r: ReportData): string {
  return `Transformer_Report_Draft_${stationPart(r)}_${todayIso()}.json`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
