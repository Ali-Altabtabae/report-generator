import type { ReactNode } from 'react';
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { Photo, ReportData } from '../types/report';
import { isValidIso, isoToDisplay } from './dates';
import regularFontUrl from '../assets/fonts/DejaVuSansCondensed.ttf?url';
import boldFontUrl from '../assets/fonts/DejaVuSansCondensed-Bold.ttf?url';

// Keep words whole (no automatic hyphenation of engineering terms / IDs).
Font.registerHyphenationCallback((word) => [word]);

/**
 * Embedded Unicode font (DejaVu Sans Condensed, bundled with the app — no network) so
 * symbols such as Ω, µ, °, ±, ≤ print correctly. Paths can be overridden for tests.
 */
let fontsReady: Promise<void> | null = null;
export function registerPdfFonts(regular: string, bold: string): void {
  Font.register({ family: 'DejaVu', fonts: [{ src: regular, fontWeight: 'normal' }, { src: bold, fontWeight: 'bold' }] });
  fontsReady = Promise.resolve();
}

/** Fetch the bundled fonts once into in-memory blob URLs (so PDF export keeps working offline). */
export function preparePdfFonts(): Promise<void> {
  if (!fontsReady) {
    const toBlobUrl = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not load PDF font (HTTP ${res.status}).`);
      return URL.createObjectURL(await res.blob());
    };
    fontsReady = Promise.all([toBlobUrl(regularFontUrl), toBlobUrl(boldFontUrl)])
      .then(([regular, bold]) => registerPdfFonts(regular, bold))
      .catch((e) => {
        fontsReady = null;
        throw e;
      });
  }
  return fontsReady;
}

const C = {
  navy: '#1e3a5f',
  blue: '#2563eb',
  text: '#1f2937',
  label: '#4b5563',
  muted: '#6b7280',
  line: '#d1d5db',
  band: '#eef2f7',
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: 'DejaVu', fontSize: 9.5, color: C.text, lineHeight: 1.35 },
  header: { borderBottomWidth: 2, borderBottomColor: C.navy, paddingBottom: 8, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dept: { fontSize: 10, fontWeight: 'bold', color: C.blue, letterSpacing: 1.5 },
  title: { fontSize: 16, fontWeight: 'bold', color: C.navy, marginTop: 2 },
  headerMeta: { fontSize: 8.5, color: C.label, textAlign: 'right' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#ffffff', backgroundColor: C.navy, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 6, letterSpacing: 0.8 },
  subTitle: { fontSize: 9.5, fontWeight: 'bold', color: C.navy, marginTop: 6, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 3, paddingRight: 10, flexDirection: 'row' },
  cellFull: { width: '100%', paddingVertical: 3, flexDirection: 'row' },
  label: { width: 110, color: C.label, fontWeight: 'bold', fontSize: 8.5 },
  value: { flex: 1 },
  missing: { flex: 1, color: C.muted },
  block: { marginBottom: 6 },
  blockLabel: { color: C.label, fontWeight: 'bold', fontSize: 8.5, marginBottom: 2 },
  blockBody: { borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 8 },
  table: { borderWidth: 1, borderColor: C.line, marginTop: 2 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  th: { backgroundColor: C.band, fontWeight: 'bold', fontSize: 8.5, color: C.navy },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: C.line },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  photoBox: { width: '48.5%', marginBottom: 10, borderWidth: 1, borderColor: C.line, padding: 4 },
  photo: { width: '100%', height: 190, objectFit: 'contain', backgroundColor: '#f9fafb' },
  caption: { fontSize: 8.5, color: C.label, marginTop: 4 },
  // Blank line for a handwritten date when no date was selected.
  dateLine: { width: 140, borderBottomWidth: 1, borderBottomColor: C.text, height: 14 },
  footer: { position: 'absolute', top: 841.89 - 40, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5 },
});

const NP = 'Not provided';
const has = (v: string) => v.trim().length > 0;

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <View style={full ? s.cellFull : s.cell} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <Text style={has(value) ? s.value : s.missing}>{has(value) ? value : NP}</Text>
    </View>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.block}>
      <Text style={s.blockLabel} minPresenceAhead={24}>{label}</Text>
      <View style={s.blockBody}>
        <Text style={has(value) ? undefined : { color: C.muted }}>{has(value) ? value : NP}</Text>
      </View>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle} minPresenceAhead={90}>{children}</Text>;
}

function Photos({ title, photos, heading }: { title: string; photos: Photo[]; heading?: ReactNode }) {
  if (photos.length === 0) return null;
  const box = (p: Photo, i: number) => (
    <View key={p.id} style={s.photoBox} wrap={false}>
      <Image src={p.dataUrl} style={s.photo} />
      <Text style={s.caption}>{has(p.caption) ? p.caption : `${title} — photo ${i + 1}`}</Text>
    </View>
  );
  // Rows of two; the heading + subtitle stay attached to the first row.
  const rowsOfTwo: Photo[][] = [];
  for (let i = 0; i < photos.length; i += 2) rowsOfTwo.push(photos.slice(i, i + 2));
  return (
    <View>
      {rowsOfTwo.map((row, ri) => (
        <View key={ri} wrap={false}>
          {ri === 0 && heading}
          {ri === 0 && <Text style={s.subTitle}>{title}</Text>}
          <View style={s.photoGrid}>{row.map((p, j) => box(p, ri * 2 + j))}</View>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ report: r, generatedAt }: { report: ReportData; generatedAt: Date }) {
  const generated = generatedAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const station = r.substation ? `${r.substation.code} — ${r.substation.fullName}` : '';
  const hasEquipSpecs = [r.equipmentType, r.serialNumber, r.ratedCapacity, r.location].some(has);
  const rows = r.inspectionRows.filter((x) => [x.parameter, x.value, x.unit, x.remarks].some(has));
  const hasTech = hasEquipSpecs || rows.length > 0 || has(r.observations);
  const foremen = r.foremanNames.map((n) => n.trim()).filter(Boolean);
  const hasPhotos = r.beforePhotos.length + r.afterPhotos.length > 0;
  const col = { p: '30%', v: '18%', u: '12%', r: '40%' };

  return (
    <Document title={`Transformer Report ${r.substation?.code ?? ''} ${r.equipmentName}`.trim()} author={r.engineerName} creator="Transformer Department Report Generator" producer="Transformer Department Report Generator">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.dept}>TRANSFORMER DEPARTMENT</Text>
            <Text style={s.title}>MAINTENANCE &amp; REPAIR REPORT</Text>
          </View>
          <View>
            <Text style={s.headerMeta}>Report date: {generatedAt.toLocaleDateString('en-GB')}</Text>
            {has(r.reportReference) && <Text style={s.headerMeta}>Ref: {r.reportReference}</Text>}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>Generated {generated} · Transformer Department Report Generator</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        <View style={s.section}>
          <SectionTitle>GENERAL INFORMATION</SectionTitle>
          <View style={s.grid}>
            <Field label="Engineer Name" value={r.engineerName} />
            <Field label="Company Name" value={r.companyName} />
            <Field label="Starting Date" value={isoToDisplay(r.startDate)} />
            <Field label="Finishing Date" value={isoToDisplay(r.finishDate)} />
            <Field label="Contract Number" value={r.contractNumber} />
          </View>
        </View>

        <View style={s.section}>
          <SectionTitle>EQUIPMENT INFORMATION</SectionTitle>
          <View style={s.grid}>
            <Field label="Substation" value={station} full />
            <Field label="Equipment ID / Name" value={r.equipmentName} />
            <Field label="Voltage" value={r.voltages.join(', ')} />
            <Field label="Section" value={r.section} />
            <Field label="Status" value={r.status} />
          </View>
        </View>

        <View style={s.section}>
          <SectionTitle>REPAIR INFORMATION</SectionTitle>
          <TextBlock label="Reason of Repair" value={r.reasonOfRepair} />
          <TextBlock label="Job Description" value={r.jobDescription} />
          <TextBlock label="Materials Used" value={r.materialsUsed} />
        </View>

        {hasTech && (
          <View style={s.section}>
            {/* Keep the section heading on the same page as the first piece of content. */}
            <View wrap={false}>
              <SectionTitle>TECHNICAL / INSPECTION DETAILS</SectionTitle>
              {hasEquipSpecs && (
                <View style={s.grid}>
                  <Field label="Type / Model" value={r.equipmentType} />
                  <Field label="Serial Number" value={r.serialNumber} />
                  <Field label="Rated Capacity" value={r.ratedCapacity} />
                  <Field label="Location / Bay" value={r.location} />
                </View>
              )}
              {!hasEquipSpecs && rows.length > 0 && <Text style={s.subTitle}>Inspection / Testing Notes</Text>}
              {!hasEquipSpecs && rows.length === 0 && <Text style={s.blockLabel}>Work Performed / Observations</Text>}
            </View>
            {rows.length > 0 && (
              <View>
                {hasEquipSpecs && <Text style={s.subTitle} minPresenceAhead={40}>Inspection / Testing Notes</Text>}
                <View style={s.table}>
                  <View style={[s.tr, s.th]} fixed>
                    <Text style={[s.td, { width: col.p }]}>Test / Parameter</Text>
                    <Text style={[s.td, { width: col.v }]}>Measured Value</Text>
                    <Text style={[s.td, { width: col.u }]}>Unit</Text>
                    <Text style={[s.td, { width: col.r, borderRightWidth: 0 }]}>Result / Remarks</Text>
                  </View>
                  {rows.map((x, i) => (
                    <View key={x.id} style={[s.tr, i === rows.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                      <Text style={[s.td, { width: col.p }]}>{x.parameter || '—'}</Text>
                      <Text style={[s.td, { width: col.v }]}>{x.value || '—'}</Text>
                      <Text style={[s.td, { width: col.u }]}>{x.unit || '—'}</Text>
                      <Text style={[s.td, { width: col.r, borderRightWidth: 0 }]}>{x.remarks || '—'}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 3 }}>
                  Values are as recorded by the engineer; no automatic compliance judgement is applied.
                </Text>
              </View>
            )}
            {has(r.observations) &&
              (!hasEquipSpecs && rows.length === 0 ? (
                <View style={s.blockBody}>
                  <Text>{r.observations}</Text>
                </View>
              ) : (
                <View style={{ marginTop: 6 }}>
                  <TextBlock label="Work Performed / Observations" value={r.observations} />
                </View>
              ))}
          </View>
        )}

        {hasPhotos && (
          <View style={s.section}>
            <Photos title="Before Repair" photos={r.beforePhotos} heading={<SectionTitle>PHOTOGRAPHS</SectionTitle>} />
            <Photos title="After Repair" photos={r.afterPhotos} heading={r.beforePhotos.length === 0 ? <SectionTitle>PHOTOGRAPHS</SectionTitle> : null} />
          </View>
        )}

        {has(r.recommendations) && (
          <View style={s.section}>
            <SectionTitle>RECOMMENDATIONS / OUTSTANDING WORK</SectionTitle>
            <View style={s.blockBody}>
              <Text>{r.recommendations}</Text>
            </View>
          </View>
        )}

        <View style={s.section} wrap={false}>
          <SectionTitle>PREPARED BY</SectionTitle>
          <Field label="Prepared by" value={r.engineerName} full />
          {foremen.length > 0 && <Field label={foremen.length > 1 ? 'Foremen' : 'Foreman'} value={foremen.join('\n')} full />}
          <View style={s.cellFull}>
            <Text style={s.label}>Date</Text>
            {isValidIso(r.preparedDate) ? (
              <Text style={s.value}>{isoToDisplay(r.preparedDate)}</Text>
            ) : (
              <View style={s.dateLine} />
            )}
          </View>
        </View>

      </Page>
    </Document>
  );
}

export async function generatePdfBlob(report: ReportData): Promise<Blob> {
  await preparePdfFonts();
  return pdf(<ReportDocument report={report} generatedAt={new Date()} />).toBlob();
}
