import type { ReactNode } from 'react';
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf, type TextProps } from '@react-pdf/renderer';
import type { Photo, ReportData } from '../types/report';
import { isValidIso, isoToDisplay } from './dates';
import regularFontUrl from '../assets/fonts/DejaVuSansCondensed.ttf?url';
import boldFontUrl from '../assets/fonts/DejaVuSansCondensed-Bold.ttf?url';
import headingFontUrl from '../assets/fonts/DejaVuSerif-Bold.ttf?url';

// Keep words whole (no automatic hyphenation of engineering terms / IDs).
Font.registerHyphenationCallback((word) => [word]);

/**
 * Embedded Unicode font (DejaVu Sans Condensed, bundled with the app — no network) so
 * symbols such as Ω, µ, °, ±, ≤ print correctly. Paths can be overridden for tests.
 */
let fontsReady: Promise<void> | null = null;
export function registerPdfFonts(regular: string, bold: string, heading: string): void {
  Font.register({ family: 'DejaVu', fonts: [{ src: regular, fontWeight: 'normal' }, { src: bold, fontWeight: 'bold' }] });
  // Serif face used only for section headings.
  Font.register({ family: 'DejaVuSerif', fonts: [{ src: heading, fontWeight: 'bold' }] });
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
    fontsReady = Promise.all([toBlobUrl(regularFontUrl), toBlobUrl(boldFontUrl), toBlobUrl(headingFontUrl)])
      .then(([regular, bold, heading]) => registerPdfFonts(regular, bold, heading))
      .catch((e) => {
        fontsReady = null;
        throw e;
      });
  }
  return fontsReady;
}

/**
 * Print-friendly palette: black body text, grey labels, hairline rules, no filled areas.
 * Blue is used only for the report title and the section headings.
 */
const C = {
  titleBlue: '#1f3a68', // deep navy — report title
  headBlue: '#2f5f9e', // medium blue — section headings
  ink: '#111111',
  label: '#4a4a4a',
  muted: '#7a7a7a',
  rule: '#111111',
  hair: '#c4c4c4',
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 60, paddingHorizontal: 44, fontFamily: 'DejaVu', fontSize: 9.5, color: C.ink, lineHeight: 1.4 },

  // Title block (first page only)
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  dept: { fontSize: 8, letterSpacing: 2, color: C.label, paddingTop: 1 },
  title: { fontSize: 16, fontWeight: 'bold', letterSpacing: 0.2, paddingBottom: 7, color: C.titleBlue },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', fontSize: 8 },
  metaLabel: { color: C.label, width: 62, textAlign: 'right', marginRight: 6 },
  metaValue: { fontWeight: 'bold', minWidth: 70 },
  ruleThick: { borderBottomWidth: 1.6, borderBottomColor: C.rule },
  ruleThin: { borderBottomWidth: 0.5, borderBottomColor: C.rule, marginTop: 1.5, marginBottom: 6 },

  // Section headings: numbered, bold, underlined — clear without colour
  sectionHead: { marginTop: 16, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.headBlue },
  sectionTitle: { fontFamily: 'DejaVuSerif', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: C.headBlue },
  subHead: { fontSize: 9, fontWeight: 'bold', marginTop: 9, marginBottom: 3 },

  // Label / value table
  kvRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.hair },
  kvLabel: { width: '19%', paddingTop: 6.5, paddingBottom: 5, paddingRight: 6, fontSize: 8, fontWeight: 'bold', color: C.label },
  kvValueHalf: { width: '62%', paddingVertical: 5, paddingRight: 8 },
  kvValueFull: { width: '81%', paddingVertical: 5 },
  missing: { color: C.muted },

  // Free text
  textBox: { borderWidth: 0.5, borderColor: C.hair, paddingVertical: 6, paddingHorizontal: 8 },

  // Measurements table
  tHead: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.rule, borderBottomWidth: 1, borderBottomColor: C.rule },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.hair },
  th: { paddingVertical: 4, paddingRight: 6, fontSize: 8, fontWeight: 'bold', letterSpacing: 0.3 },
  td: { paddingVertical: 4, paddingRight: 6 },
  note: { fontSize: 7.5, color: C.muted, marginTop: 4 },

  // Photographs
  photoGrid: { flexDirection: 'row', justifyContent: 'space-between', flexShrink: 0 },
  photoBox: { width: '48.5%', marginBottom: 10, borderWidth: 0.5, borderColor: C.hair, padding: 4, flexShrink: 0 },
  // minHeight stops the layout engine from squeezing photos to fit a page; they move to the next page instead.
  photo: { width: '100%', height: 185, minHeight: 185, objectFit: 'contain', flexShrink: 0 },
  caption: { fontSize: 8, color: C.label, marginTop: 4 },

  noShrink: { flexShrink: 0 },

  // Blank line for a handwritten date when no date was selected.
  dateLine: { width: 150, borderBottomWidth: 0.75, borderBottomColor: C.ink, height: 13 },

  footer: { position: 'absolute', top: 841.89 - 42, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.hair, paddingTop: 5 },
});

const NP = 'Not provided';
const has = (v: string) => v.trim().length > 0;

type TextStyle = Exclude<TextProps['style'], undefined | unknown[]>;

function Value({ v, style }: { v: string; style: TextStyle }) {
  return <Text style={has(v) ? style : [style, s.missing]}>{has(v) ? v : NP}</Text>;
}

type KV = { label: string; value: string; full?: boolean; node?: ReactNode };

/** Label/value table, two pairs per row; `full` items take a whole row. */
function KVTable({ items, heading }: { items: KV[]; heading?: ReactNode }) {
  const rows: KV[][] = [];
  let pending: KV[] = [];
  for (const it of items) {
    if (it.full) {
      if (pending.length) rows.push(pending);
      rows.push([it]);
      pending = [];
    } else {
      pending.push(it);
      if (pending.length === 2) {
        rows.push(pending);
        pending = [];
      }
    }
  }
  if (pending.length) rows.push(pending);
  return (
    <View>
      {rows.map((row, i) => (
        // The section heading travels with the first row so it is never left alone at a page bottom.
        <View key={i} wrap={false}>
          {i === 0 && heading}
          <View style={s.kvRow}>
            {row.map((it) => (
              <View key={it.label} style={{ flexDirection: 'row', width: it.full ? '100%' : '50%' }}>
                <Text style={[s.kvLabel, it.full ? { width: '19%' } : { width: '38%' }]}>{it.label}</Text>
                {it.node ?? <Value v={it.value} style={it.full ? s.kvValueFull : s.kvValueHalf} />}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
    </View>
  );
}

/** Rough line count, used to keep short text blocks in one piece. */
const approxLines = (v: string) => v.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 95)), 0);

function TextBlock({ label, value, heading }: { label: string; value: string; heading?: ReactNode }) {
  // Short blocks are kept in one piece. Long ones may split across pages, with the
  // heading asked to stay with the start of the text.
  const long = approxLines(value) > 12;
  return (
    <View wrap={long} style={s.noShrink}>
      <View wrap={false} {...(long ? { minPresenceAhead: 36 } : {})}>
        {heading}
        <Text style={s.subHead}>{label}</Text>
      </View>
      <View style={s.textBox}>
        <Value v={value} style={{}} />
      </View>
    </View>
  );
}

function Photos({ title, photos, heading }: { title: string; photos: Photo[]; heading?: ReactNode }) {
  if (photos.length === 0) return null;
  const rowsOfTwo: Photo[][] = [];
  for (let i = 0; i < photos.length; i += 2) rowsOfTwo.push(photos.slice(i, i + 2));
  return (
    <View style={s.noShrink}>
      {rowsOfTwo.map((row, ri) => (
        <View key={ri} wrap={false} style={s.noShrink}>
          {ri === 0 && heading}
          {ri === 0 && <Text style={s.subHead}>{title}</Text>}
          <View style={s.photoGrid}>
            {row.map((p, j) => (
              <View key={p.id} style={s.photoBox}>
                <Image src={p.dataUrl} style={s.photo} />
                <Text style={s.caption}>
                  {title} {ri * 2 + j + 1}
                  {has(p.caption) ? ` — ${p.caption}` : ''}
                </Text>
              </View>
            ))}
          </View>
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
  const col = { p: '32%', v: '18%', u: '12%', r: '38%' };
  const subject = [r.substation?.code, r.equipmentName.trim()].filter(Boolean).join(' · ');

  const head = (title: string) => <SectionHead title={title} />;

  return (
    <Document
      title={`Transformer Cable Report ${subject}`.trim()}
      author={r.engineerName}
      creator="Transformer Department — Cable Team"
      producer="Transformer Department Report Generator"
    >
      <Page size="A4" style={s.page}>
        <View style={s.footer} fixed>
          <Text>
            Transformer Department · Cable Team{subject ? `  |  ${subject}` : ''}  |  Generated {generated}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        <View style={s.headerTop}>
          <Text style={s.dept}>TRANSFORMER DEPARTMENT · CABLE TEAM</Text>
          <View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Report date</Text>
              <Text style={s.metaValue}>{generatedAt.toLocaleDateString('en-GB')}</Text>
            </View>
            {has(r.reportReference) && (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Reference</Text>
                <Text style={s.metaValue}>{r.reportReference}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={s.title}>Transformer Cable Maintenance &amp; Repair Report</Text>
        <View style={s.ruleThick} />
        <View style={s.ruleThin} />

        <KVTable
          heading={head('Equipment Information')}
          items={[
            { label: 'Substation', value: station, full: true },
            { label: 'Equipment ID / Name', value: r.equipmentName },
            { label: 'Section', value: r.section },
            { label: 'Voltage', value: r.voltages.join(', ') },
            { label: 'Status', value: r.status, node: <Value v={r.status} style={{ ...s.kvValueHalf, fontWeight: 'bold' }} /> },
          ]}
        />

        <KVTable
          heading={head('Job Details')}
          items={[
            { label: 'Engineer', value: r.engineerName },
            { label: 'Company', value: r.companyName },
            { label: 'Starting Date', value: isoToDisplay(r.startDate) },
            { label: 'Finishing Date', value: isoToDisplay(r.finishDate) },
            { label: 'Contract No.', value: r.contractNumber, full: true },
          ]}
        />

        <TextBlock heading={head('Repair Details')} label="Reason of Repair" value={r.reasonOfRepair} />
        <TextBlock label="Job Description" value={r.jobDescription} />
        <TextBlock label="Materials Used" value={r.materialsUsed} />

        {hasTech && (
          <>
            {(() => {
              const techHead = head('Technical / Inspection Details');
              return (
                <>
                  {hasEquipSpecs && (
                    <KVTable
                      heading={techHead}
                      items={[
                        { label: 'Type / Model', value: r.equipmentType },
                        { label: 'Serial Number', value: r.serialNumber },
                        { label: 'Rated Capacity', value: r.ratedCapacity },
                        { label: 'Location / Bay', value: r.location },
                      ]}
                    />
                  )}
                  {rows.length > 0 && (
                    <>
                      <View wrap={false}>
                        {!hasEquipSpecs && techHead}
                        <Text style={s.subHead}>Inspection / Testing Notes</Text>
                        <View style={s.tHead}>
                          <Text style={[s.th, { width: col.p }]}>TEST / PARAMETER</Text>
                          <Text style={[s.th, { width: col.v }]}>MEASURED VALUE</Text>
                          <Text style={[s.th, { width: col.u }]}>UNIT</Text>
                          <Text style={[s.th, { width: col.r }]}>RESULT / REMARKS</Text>
                        </View>
                        {/* first row kept with the table header */}
                        <View style={s.tRow}>
                          <Text style={[s.td, { width: col.p }]}>{rows[0].parameter || '—'}</Text>
                          <Text style={[s.td, { width: col.v }]}>{rows[0].value || '—'}</Text>
                          <Text style={[s.td, { width: col.u }]}>{rows[0].unit || '—'}</Text>
                          <Text style={[s.td, { width: col.r }]}>{rows[0].remarks || '—'}</Text>
                        </View>
                      </View>
                      {rows.slice(1).map((x) => (
                        <View key={x.id} style={s.tRow} wrap={false}>
                          <Text style={[s.td, { width: col.p }]}>{x.parameter || '—'}</Text>
                          <Text style={[s.td, { width: col.v }]}>{x.value || '—'}</Text>
                          <Text style={[s.td, { width: col.u }]}>{x.unit || '—'}</Text>
                          <Text style={[s.td, { width: col.r }]}>{x.remarks || '—'}</Text>
                        </View>
                      ))}
                      <Text style={s.note}>Values are as recorded by the engineer; no automatic compliance judgement is applied.</Text>
                    </>
                  )}
                  {has(r.observations) && (
                    <TextBlock
                      heading={!hasEquipSpecs && rows.length === 0 ? techHead : undefined}
                      label="Work Performed / Observations"
                      value={r.observations}
                    />
                  )}
                </>
              );
            })()}
          </>
        )}

        {hasPhotos &&
          (() => {
            const photoHead = head('Photographs');
            return (
              // No wrapping View here: an extra nesting level stops the PDF engine from
              // moving photo rows to the next page (they overflow the page instead).
              <>
                <Photos title="Before repair" photos={r.beforePhotos} heading={photoHead} />
                <Photos title="After repair" photos={r.afterPhotos} heading={r.beforePhotos.length === 0 ? photoHead : undefined} />
              </>
            );
          })()}

        {has(r.recommendations) && (
          <TextBlock heading={head('Recommendations / Outstanding Work')} label="Recommendations" value={r.recommendations} />
        )}

        <View wrap={false}>
          <KVTable
            heading={head('Prepared By')}
            items={[
              { label: 'Engineer', value: r.engineerName, full: true },
              ...(foremen.length > 0 ? [{ label: foremen.length > 1 ? 'Foremen' : 'Foreman', value: foremen.join('\n'), full: true }] : []),
              {
                label: 'Date',
                value: '',
                full: true,
                node: isValidIso(r.preparedDate) ? (
                  <Text style={s.kvValueFull}>{isoToDisplay(r.preparedDate)}</Text>
                ) : (
                  <View style={[s.kvValueFull, { paddingVertical: 4 }]}>
                    <View style={s.dateLine} />
                  </View>
                ),
              },
            ]}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generatePdfBlob(report: ReportData): Promise<Blob> {
  await preparePdfFonts();
  return pdf(<ReportDocument report={report} generatedAt={new Date()} />).toBlob();
}
