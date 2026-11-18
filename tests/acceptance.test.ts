import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { parseSubstationsCsv, searchSubstations, duplicateCodes } from '../src/lib/substations';
import { CSV_HEADERS, buildCsv, formatCsvEquipmentName } from '../src/lib/csvExport';
import { validateReport } from '../src/lib/validation';
import { buildDraft, parseDraft } from '../src/lib/draftJson';
import { reportFilename } from '../src/lib/filenames';
import { emptyReport, type ReportData } from '../src/types/report';

const list = parseSubstationsCsv(readFileSync('public/data/substations.csv', 'utf8'));
const mishA = list.find((s) => s.code === 'MISH-A')!;

function sample(): ReportData {
  return {
    ...emptyReport(),
    engineerName: 'Test Engineer',
    substation: mishA,
    equipmentName: '30MVA TR 1',
    voltages: ['132kV', '33kV'],
    section: 'Transformer',
    status: 'Dead',
    startDate: '2026-11-10',
    finishDate: '2026-11-12',
    reasonOfRepair: 'Oil leak, "minor" at valve',
    jobDescription: 'Line one\nLine two, with comma',
    materialsUsed: '=SUM(A1:A2)',
    companyName: 'ACME, Ltd',
    contractNumber: '00123',
  };
}

describe('substations', () => {
  it('loads all 621 records with missing NOs not invented', () => {
    expect(list.length).toBe(621);
    for (const n of [21, 22, 25, 83, 84, 86, 116, 117, 118, 144, 260, 448]) expect(list.find((s) => s.no === n)).toBeUndefined();
    expect(Math.max(...list.map((s) => s.no))).toBe(633);
  });
  it('keeps duplicate codes as distinct records', () => {
    const d = duplicateCodes(list);
    for (const c of ['FINT-W', 'HAWL-M', 'JAHR-X', 'MNGS-D']) {
      expect(d.has(c)).toBe(true);
      expect(searchSubstations(list, c).filter((s) => s.code === c).length).toBeGreaterThan(1);
    }
  });
  it('search finds MISH-A from several queries', () => {
    for (const q of ['MISH', 'MISHRIF', 'MISH A', 'mish-a', '  mish  a ']) {
      expect(searchSubstations(list, q).map((s) => s.code)).toContain('MISH-A');
    }
    expect(searchSubstations(list, 'MI').length).toBeGreaterThan(0);
    expect(searchSubstations(list, 'MI')[0].code.toLowerCase().startsWith('mi') || searchSubstations(list, 'MI')[0].fullName.toLowerCase().startsWith('mi')).toBe(true);
    expect(searchSubstations(list, 'MISH-B').length).toBe(0);
  });
});

describe('csv', () => {
  it('formats the combined name', () => {
    expect(formatCsvEquipmentName(mishA, '30MVA TR 1')).toBe('MISH "A" 30MVA TR 1');
    expect(formatCsvEquipmentName({ no: 488, code: 'SNPS', fullName: 'x' }, 'TR 2')).toBe('SNPS TR 2');
    expect(formatCsvEquipmentName({ no: 311, code: 'MINB-W/C', fullName: 'x' }, 'TR 2')).toBe('MINB-W/C TR 2');
  });
  it('has exactly 12 columns and correct escaping', () => {
    const r = { ...sample(), observations: 'pdf only', recommendations: 'pdf only', serialNumber: 'X', foremanNames: ['F1', 'F2'], preparedDate: '2026-11-13' };
    const csv = buildCsv(r);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"MISH ""A"" 30MVA TR 1"');
    expect(csv).toContain('"132kV, 33kV"');
    const parsed = Papa.parse<string[]>(csv.slice(1), { skipEmptyLines: true }).data;
    expect(parsed.length).toBe(2);
    expect(parsed[0]).toEqual([...CSV_HEADERS]);
    expect(parsed[1].length).toBe(12);
    expect(parsed[1][1]).toBe('MISH "A" 30MVA TR 1');
    expect(parsed[1][2]).toBe('132kV, 33kV');
    expect(parsed[1][5]).toBe('10/11/2026');
    expect(parsed[1][6]).toBe('12/11/2026');
    expect(parsed[1][7]).toBe('Oil leak, "minor" at valve');
    expect(parsed[1][8]).toBe('Line one\nLine two, with comma');
    expect(parsed[1][9]).toBe("'=SUM(A1:A2)");
    expect(parsed[1][11]).toBe('00123');
    
  });
  it('blank finish date stays blank', () => {
    const parsed = Papa.parse<string[]>(buildCsv({ ...sample(), finishDate: '' }).slice(1)).data;
    expect(parsed[1][6]).toBe('');
  });
  it('filename', () => {
    expect(reportFilename(sample(), 'csv')).toMatch(/^Transformer_Report_MISH-A_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe('validation', () => {
  it('requires fields and date order', () => {
    const e = validateReport(emptyReport());
    expect(Object.keys(e).sort()).toEqual(
      ['engineerName', 'substation', 'equipmentName', 'voltages', 'section', 'status', 'startDate', 'reasonOfRepair', 'jobDescription'].sort(),
    );
    expect(validateReport(sample())).toEqual({});
    expect(validateReport({ ...sample(), finishDate: '2026-11-01' }).finishDate).toBeTruthy();
  });
});

describe('draft json', () => {
  it('round-trips', () => {
    const r = { ...sample(), beforePhotos: [{ id: 'a', dataUrl: 'data:image/jpeg;base64,AAAA', caption: 'cap', width: 1, height: 1 }] };
    const { report, warnings } = parseDraft(buildDraft(r), list);
    expect(warnings).toEqual([]);
    expect(report.substation).toEqual(mishA);
    expect(report.voltages).toEqual(['132kV', '33kV']);
    expect(report.beforePhotos[0].caption).toBe('cap');
    expect(report.beforePhotos[0].dataUrl).toBe('data:image/jpeg;base64,AAAA');
    expect(report.startDate).toBe('2026-11-10');
    const r2 = parseDraft(buildDraft({ ...sample(), foremanNames: ['A', 'B'], preparedDate: '2026-11-13' }), list).report;
    expect(r2.foremanNames).toEqual(['A', 'B']);
    expect(r2.preparedDate).toBe('2026-11-13');
  });
  it('rejects invalid files', () => {
    expect(() => parseDraft('{not json', list)).toThrow(/not valid JSON/);
    expect(() => parseDraft('{"a":1}', list)).toThrow(/not a Transformer/);
    const bad = JSON.parse(buildDraft(sample()));
    bad.report.status = 'Completed';
    expect(() => parseDraft(JSON.stringify(bad), list)).toThrow(/Status/);
    bad.report.status = 'Live';
    bad.schemaVersion = 99;
    expect(() => parseDraft(JSON.stringify(bad), list)).toThrow(/version/);
  });
  it('warns and never substitutes outdated stations', () => {
    const d = JSON.parse(buildDraft(sample()));
    d.report.substation = { no: 21, code: 'XXXX-A', fullName: 'GONE' };
    let res = parseDraft(JSON.stringify(d), list);
    expect(res.report.substation).toBeNull();
    expect(res.warnings[0]).toMatch(/no longer exists/);
    d.report.substation = { ...mishA, fullName: 'MISHRIF OLD' };
    res = parseDraft(JSON.stringify(d), list);
    expect(res.report.substation).toBeNull();
    expect(res.warnings[0]).toMatch(/changed/);
  });
});
