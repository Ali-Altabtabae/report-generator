import Papa from 'papaparse';
import type { Substation } from '../types/report';

export const SUBSTATIONS_URL = `${import.meta.env.BASE_URL}data/substations.csv`;

/** Parse the source CSV text (columns: NO, S/S NAME, S/S FULL NAME). */
export function parseSubstationsCsv(text: string): Substation[] {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toUpperCase(),
  });
  const fields = result.meta.fields ?? [];
  for (const col of ['NO', 'S/S NAME', 'S/S FULL NAME']) {
    if (!fields.includes(col)) {
      throw new Error(`Substation list is missing the "${col}" column.`);
    }
  }
  const seen = new Set<number>();
  const list: Substation[] = [];
  for (const row of result.data) {
    const no = Number.parseInt((row['NO'] ?? '').trim(), 10);
    const code = (row['S/S NAME'] ?? '').trim();
    const fullName = (row['S/S FULL NAME'] ?? '').trim();
    if (!Number.isFinite(no) || !code) continue;
    if (seen.has(no)) throw new Error(`Substation list has a duplicate NO value: ${no}.`);
    seen.add(no);
    list.push({ no, code, fullName });
  }
  if (list.length === 0) throw new Error('Substation list is empty.');
  return list;
}

export async function loadSubstations(): Promise<Substation[]> {
  const res = await fetch(SUBSTATIONS_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load substation list (HTTP ${res.status}).`);
  return parseSubstationsCsv(await res.text());
}

/** Lower-case and strip spaces/hyphens/punctuation so "MISH A" matches "MISH-A". */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/().]+/g, '');
}

/** Rank substations: starts-with matches first, then contains matches. */
export function searchSubstations(list: Substation[], query: string, limit = 50): Substation[] {
  const q = normalize(query);
  if (!q) return list.slice(0, limit);
  const starts: Substation[] = [];
  const contains: Substation[] = [];
  for (const s of list) {
    const code = normalize(s.code);
    const full = normalize(s.fullName);
    if (code.startsWith(q) || full.startsWith(q)) starts.push(s);
    else if (code.includes(q) || full.includes(q)) contains.push(s);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Codes that appear on more than one record (so the UI can show NO to tell them apart). */
export function duplicateCodes(list: Substation[]): Set<string> {
  const counts = new Map<string, number>();
  for (const s of list) counts.set(s.code, (counts.get(s.code) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n > 1).map(([c]) => c));
}
