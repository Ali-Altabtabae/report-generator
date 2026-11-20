import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument, registerPdfFonts } from '../src/lib/pdfExport';
registerPdfFonts('src/assets/fonts/DejaVuSansCondensed.ttf', 'src/assets/fonts/DejaVuSansCondensed-Bold.ttf', 'src/assets/fonts/DejaVuSerif-Bold.ttf');
import { emptyReport, type ReportData } from '../src/types/report';

// A small real JPEG (1x1) is fine for layout; use a generated PNG instead to test images.
const png = 'data:image/png;base64,' + readFileSync('tests/fixture.png').toString('base64');

it('renders minimal and full PDFs', async () => {
  const base: ReportData = {
    ...emptyReport(),
    engineerName: 'Test Engineer',
    substation: { no: 320, code: 'MISH-A', fullName: 'MISHRIF -A' },
    equipmentName: '30MVA TR 1',
    voltages: ['132kV', '33kV'],
    section: 'Transformer',
    status: 'Dead',
    startDate: '2026-11-10',
    reasonOfRepair: 'Oil leak at valve',
    jobDescription: 'Replaced gasket.',
  };
  const minimal = await renderToBuffer(<ReportDocument report={base} generatedAt={new Date()} />);
  writeFileSync('tests/out-minimal.pdf', minimal);
  expect(minimal.length).toBeGreaterThan(1000);

  const long = Array.from({ length: 80 }, (_, i) => `Step ${i + 1}: inspected and tightened bushing connection, cleaned surfaces, recorded readings.`).join('\n');
  const photos = Array.from({ length: 5 }, (_, i) => ({ id: String(i), dataUrl: png, caption: `Photo ${i + 1}`, width: 64, height: 48 }));
  const full = await renderToBuffer(
    <ReportDocument
      report={{
        ...base,
        jobDescription: long,
        finishDate: '2026-11-12',
        companyName: 'ACME',
        contractNumber: '00123',
        reportReference: 'TR-2026-001',
        equipmentType: 'ONAN',
        serialNumber: 'SN-1',
        ratedCapacity: '30 MVA',
        location: 'Bay 4',
        inspectionRows: Array.from({ length: 12 }, (_, i) => ({ id: String(i), parameter: `IR test ${i}`, value: '1200', unit: 'MΩ', remarks: 'As recorded ≥ 1000 MΩ, 25 °C ± 2, 5 µA' })),
        observations: 'Observed minor corrosion.',
        beforePhotos: photos,
        afterPhotos: photos.slice(0, 3),
        recommendations: 'Re-inspect in 6 months.',
        foremanNames: ['Foreman One', 'Foreman Two'],
        preparedDate: '2026-11-13',
      }}
      generatedAt={new Date()}
    />,
  );
  writeFileSync('tests/out-full.pdf', full);
  expect(full.length).toBeGreaterThan(minimal.length);
}, 60000);
