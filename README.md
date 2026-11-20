# Transformer Department Report Generator

A small website for writing one maintenance/repair report and downloading it as:

- a **CSV** that uses the department's existing 12-column template,
- a more detailed **PDF** report (A4, page numbers, optional test results and photos),
- an editable **JSON draft** that you can load again later.

You can work on **several reports at once**: use **Add report** or **Duplicate** in the Reports bar. The downloads then give one CSV with one row per report, and one separate PDF per report. Save Draft keeps all the reports in one JSON file.

Everything runs in the browser. There is no login, database or server. Nothing you type leaves your computer.

## Requirements

- Node.js 20 or newer

## Commands

```bash
npm install      # install dependencies (first time only)
npm run dev      # start a local development server (http://localhost:5173)
npm run build    # create the static website in dist/
npm run preview  # serve the built dist/ folder locally
npm test         # run the automated checks (CSV format, search, drafts, PDF)
```

## Deployment

`npm run build` creates a fully static `dist/` folder. Copy it to any static web host, such as an internal IIS/Apache/Nginx share, SharePoint static hosting, Vercel or Netlify. No server configuration is needed. The build uses relative paths, so it also works from a sub-folder.

> Reports can contain confidential details. An internal host is preferable to public hosting. Department administrators should decide.

## Updating the substation list

The list is `public/data/substations.csv` (in the built site: `dist/data/substations.csv`). You can replace this file without changing any code. It must keep these three columns:

```
NO,S/S NAME,S/S FULL NAME
```

`NO` must be unique, because it identifies the record. Short codes may repeat. When an old draft refers to a substation whose `NO` no longer exists or has changed, the app warns the user and asks them to pick the substation again. It never substitutes a different one.

## Changing the voltage options

Edit `src/data/voltageOptions.ts`. Users can also type a custom value with **Other kV**.

## Changing the Company Name / Contract Number suggestions

Edit `src/data/listOptions.ts`. Both boxes are searchable, and users can still type a value that is not on the list.

## Dates

Dates are always shown and typed as `DD/MM/YYYY`, whatever the computer's region setting is. Type the digits and the slashes are added for you, or use the calendar button.

## Multiple reports

- **Add report** starts a blank report. **Duplicate** copies the report you are editing (handy for several transformers in the same job). Click a report's tab to edit it, or its × to remove it.
- **Download CSV** creates one file with the 12 template columns and one row per report, in tab order.
- **Download PDF(s)** creates a separate PDF for each report. With more than one report, the equipment name is added to each file name (e.g. `Transformer_Report_MISH-A_30MVA_TR_1_2026-11-21.pdf`). The first time, the browser may ask you to allow multiple downloads from the site; choose **Allow**.
- All reports must be complete before downloading. If one isn't, the app opens that report and highlights the fields to fix.
- Up to 30 reports can be kept at once. Drafts saved by the older single-report version still load.

## CSV notes

- Headers are exactly: `Engineer Name, Circuit/Transformer Name, Voltage, Section, Status, Starting Date, Finishing Date, Reason of Repair, Job Description, Materials Used, Company Name, Contract Number`.
- `Circuit/Transformer Name` combines the station and equipment: `MISH-A` + `30MVA TR 1` becomes `MISH "A" 30MVA TR 1`. Codes that are not in the simple `XXXX-Y` form (e.g. `SNPS`, `MINB-W/C`) are kept as they are. The logic is in `formatCsvEquipmentName` in `src/lib/csvExport.ts`.
- Dates are `DD/MM/YYYY`. The file is UTF-8 with a BOM so Excel shows symbols correctly. Cells are quoted per RFC 4180.
- **Formula-injection guard:** if a free-text value starts with `=`, `+`, `-` or `@` (after any spaces), the CSV cell is prefixed with an apostrophe `'` so spreadsheet apps treat it as text. The PDF and JSON keep the original text.
- The CSV stores the contract number exactly as typed (e.g. `00123`). Excel may hide leading zeros when it opens a CSV directly. Use *Data → From Text/CSV* and set the column to Text if that matters.

## PDF notes

- The PDF is titled **Transformer Cable Maintenance & Repair Report** (Transformer Department · Cable Team). It is designed for printing: black body text, no filled colour areas, and a footer on every page showing the substation/equipment and page number. Colour is limited to the title (deep navy), the section headings (medium blue, bold serif font, DejaVu Serif) and any photos.
- Sections: Equipment Information, Job Details, Repair Details, then (only if filled in) Technical / Inspection Details, Photographs, Recommendations, and finally Prepared By.

- The PDF uses the bundled DejaVu Sans font (free licence, `src/assets/fonts/DejaVu-LICENSE.txt`), so symbols like Ω, µ, °, ± print correctly. Arabic script is not supported by this font.
- Optional sections that are left empty are left out of the PDF.
- The final **Prepared by** section shows the engineer, any foreman names (optional, as many as needed) and a date. If the date is left empty, the PDF shows a blank line so it can be written by hand. Foreman names and this date appear only in the PDF, never in the CSV.
- `Live`/`Dead` is recorded as report data only. It is not a safety clearance.

## Project layout

```
public/data/substations.csv   substation source list (replaceable)
src/types/report.ts           report data model and allowed values
src/data/voltageOptions.ts    voltage choices
src/lib/                      substations search, CSV, PDF, drafts, validation, photos
src/components/               form, combobox, voltage picker, PDF extras, preview
tests/                        automated acceptance checks
```
