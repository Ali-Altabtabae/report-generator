import type { ReportData, Substation } from '../types/report';
import { isoToDisplay } from './dates';

/** The department's existing template — exactly 12 columns, in this order. */
export const CSV_HEADERS = [
  'Engineer Name',
  'Circuit/Transformer Name',
  'Voltage',
  'Section',
  'Status',
  'Starting Date',
  'Finishing Date',
  'Reason of Repair',
  'Job Description',
  'Materials Used',
  'Company Name',
  'Contract Number',
] as const;

/**
 * Combine the selected substation and the typed equipment name into one cell.
 * Simple "PREFIX-SUFFIX" codes become: PREFIX "SUFFIX" <equipment>
 *   e.g. MISH-A + "30MVA TR 1" -> MISH "A" 30MVA TR 1
 * Any other code shape (e.g. "SNPS", "MINB-W/C") is kept verbatim: <code> <equipment>
 */
export function formatCsvEquipmentName(station: Substation | null, equipmentName: string): string {
  const equipment = equipmentName.trim();
  if (!station) return equipment;
  const m = /^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/.exec(station.code.trim());
  const stationPart = m ? `${m[1]} "${m[2]}"` : station.code.trim();
  return equipment ? `${stationPart} ${equipment}` : stationPart;
}

/**
 * Formula-injection guard: if a free-text value starts (after leading whitespace)
 * with = + - @ (or a tab / carriage return), prefix it with a single apostrophe so
 * spreadsheet apps treat it as text. Only applied in the CSV; PDF/JSON keep the
 * original value.
 */
export function neutralizeFormula(value: string): string {
  return /^\s*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** RFC 4180 quoting: wrap in quotes when needed and double internal quotes. */
export function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The 12 cell values (unescaped, but formula-guarded) — used for the preview and the file. */
export function buildCsvRow(r: ReportData): string[] {
  const freeText = (v: string) => neutralizeFormula(v.replace(/\r\n?/g, '\n'));
  return [
    freeText(r.engineerName.trim()),
    freeText(formatCsvEquipmentName(r.substation, r.equipmentName)),
    r.voltages.join(', '),
    r.section,
    r.status,
    isoToDisplay(r.startDate),
    isoToDisplay(r.finishDate),
    freeText(r.reasonOfRepair.trim()),
    freeText(r.jobDescription.trim()),
    freeText(r.materialsUsed.trim()),
    freeText(r.companyName.trim()),
    freeText(r.contractNumber.trim()),
  ];
}

/** Full CSV text: header + one row, CRLF line endings, UTF-8 BOM for Excel. */
export function buildCsv(r: ReportData): string {
  const lines = [CSV_HEADERS.map(escapeCsvCell).join(','), buildCsvRow(r).map(escapeCsvCell).join(',')];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
