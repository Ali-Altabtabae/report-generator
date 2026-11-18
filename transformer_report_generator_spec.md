# Transformer Department Report Generator — Build Specification

> **Purpose:** Build a simple, professional, browser-based website that lets an engineer complete **one form** and download (1) an **existing-format CSV summary** and (2) a **more detailed PDF report**. No sign-in, dashboards, database, or complex backend.
>
> **For Claude Code:** Implement this as a working application. Follow the requirements and acceptance criteria below. Prefer clean, maintainable code over extra features. Do not add authentication, analytics, Supabase, NestJS, AI, or server-side storage.

## 1. Scope and architecture

### Required

- **Single-page application** using **Vite + React + TypeScript + Tailwind CSS**.
- **Entirely client-side**: form processing, substation search, CSV export, PDF creation, JSON draft export/import, and photo handling stay in the engineer's browser.
- Responsive desktop-first layout that also works on phones/tablets.
- One editable report at a time in the MVP.
- Two independent download buttons: **Download PDF** and **Download CSV**. Optionally add **Download Both**.
- No login, accounts, dashboard, database, server API, or persistent cloud storage.
- Deployable as a static website (for example on Vercel). Department administrators must decide whether public hosting is appropriate for the data; an internal static host is preferable for confidential reports.

### Suggested packages

- `@react-pdf/renderer` for paginated, professional PDF generation with text selectable/searchable.
- `papaparse` for reading the source substation CSV reliably (quoted cells, commas, BOM).
- `lucide-react` for minimal icons.
- Use standard browser APIs for JSON download, CSV creation, file upload, and images; introduce additional packages only when clearly justified.

## 2. Main user workflow

1. Engineer opens the website and sees **New Maintenance / Repair Report**.
2. Engineer types/selects a substation using **autocomplete** from the supplied CSV list.
3. Engineer enters equipment identification and the common CSV fields.
4. Engineer optionally expands **Additional PDF Details** to add technical notes, readings, recommendations, and before/after photos.
5. Engineer reviews a **CSV summary preview** and a **PDF preview**.
6. Engineer downloads a PDF, a CSV, or both. Both exports use the exact same report form data.
7. If unfinished, engineer clicks **Save Draft (.json)**. Later, **Load Draft (.json)** restores their report for editing.
8. **New / Clear Form** asks for confirmation before discarding unsaved data.

Do not require one report to be saved to a server before exporting.

## 3. Website form fields

Organize the single form into these collapsible or clearly grouped sections.

### A. General / equipment information

| Website field | Input | Required? | Behavior |
|---|---|---|---|
| Engineer Name | Text | Yes | Free typing |
| Substation Name | Searchable autocomplete | Yes | Pick a **specific source record**, not an arbitrary unverified string |
| Equipment ID / Name | Text | Yes | **Manually typed**; e.g. `30MVA TR 1` |
| Voltage | **Multi-select** | Yes | Engineer may pick multiple values, e.g. `132kV` and `33kV` |
| Section | Single-select dropdown | Yes | Exactly: `Transformer`, `Feeder`, `Shunt Reactor`, `Local Transformer` |
| Status | Single-select dropdown | Yes | **Exactly `Live` or `Dead`**; do not substitute `Completed`, `In Progress`, etc. |
| Starting Date | Date | Yes | Native date picker; store ISO `YYYY-MM-DD` internally |
| Finishing Date | Date | No | Allow blank if the work is ongoing; if filled, cannot precede start date |
| Company Name | Text | No | Free typing |
| Contract Number | Text | No | Free typing; store as a **string** to preserve leading zeroes |

**Voltage options:** Must include `132kV` and `33kV`. Make the options easy to configure in one file, and allow an `Other` value with a user-supplied kV entry if necessary. Example additional options can be `11kV`, `300kV`, and `400kV`, but do not hardcode those as the only allowed department voltages. The UI must clearly show all selected voltages and allow deselection. Preserve selection order or display in a consistent order.

### B. Repair information (used in CSV *and* PDF)

| Website field | Input | Required? |
|---|---|---|
| Reason of Repair | Multi-line text | Yes |
| Job Description | Multi-line text | Yes |
| Materials Used | Multi-line text | No |

Allow meaningful long descriptions; **do not truncate** in exported files. Preserve punctuation and line breaks appropriately.

### C. Additional PDF details (**optional**, not new CSV columns)

- Equipment details: equipment type/model, serial number, rated capacity, and exact location/bay when relevant.
- Inspection / testing notes: a small, **repeatable table** with columns `Test / Parameter`, `Measured Value`, `Unit`, `Result / Remarks`. These entries are user-entered, not automatically judged compliant.
- Work performed / observations: additional multi-line notes.
- Before-repair and after-repair photos: optional uploads, image captions, thumbnail preview, and remove/replace image control.
- Recommendations / outstanding work: optional multi-line notes.
- Supervisor name and review/signature space: optional. The PDF may leave blank lines for handwritten signatures. **Do not claim a digital signature or authorization** has occurred.

Keep this section **collapsed by default** to avoid overwhelming engineers who only need CSV.

**Safety:** Treat `Live`/`Dead` as report data, not a safety clearance. Do not automate switching, infer de-energization, certify test results, or invent electrical measurements.

## 4. Substation autocomplete — essential feature

### Source file

Use the accompanying exact file: **`transformer_department_substations.csv`**. Copy it into the project as `public/data/substations.csv` (or bundle it at build time).

Source columns (retain verbatim):

```csv
NO,S/S NAME,S/S FULL NAME
1,ARAI-M,AL RAI -M
2,ABDL-A,ABDALI -A
```

- The uploaded source contains **621 actual rows**, with source reference numbers continuing up to 633. Reference numbers **21, 22, 25, 83, 84, 86, 116, 117, 118, 144, 260, 448** are missing **in the source**. Do not generate fictitious stations for them.
- Some short codes appear more than once, specifically `FINT-W`, `HAWL-M`, `JAHR-X`, and `MNGS-D`. **Never de-duplicate by short code**; different rows may have different full names.
- Treat `NO` as the unique **source record identifier**. Store selected station as an object with `no`, `code`, and `fullName`. Do not overwrite source spellings, parenthetical details such as `(NEW)`/`(OLD)`, or source codes.
- This data is transcribed from images. Permit the department to replace the CSV file after review without changing application code.

### Required interaction

- Text field label: **Substation Name**; placeholder: `Search by code or full name...`.
- Results update instantly while typing, with **case-insensitive, whitespace-tolerant** matching across **both** short code and full name.
- Prioritize matches that **start with** the user's text; then matches that contain it. For best usability, tolerate hyphens and spaces (`MISH A` should find `MISH-A`).
- Each suggestion shows **short code**, **full name**, and (when needed) source `NO` to distinguish duplicate short codes.
- Keyboard accessible: Arrow Up/Down, Enter to choose, Escape to dismiss; mouse/touch selection; proper combobox semantics.
- Selecting a suggestion stores the record and closes the suggestions.
- Changing the text after selection clears the selected record until another suggestion is chosen.
- Provide a clear `X` button.
- If no match: show `No matching substation` instead of silently choosing an invalid record.
- Do not invent example records such as `MISH-B` if they do not exist in the supplied dataset. The supplied MISH examples include `MISH-A`, `MISH-M`, `MISH-P`, and `MISH-Q`.
- The search must load **all 621** records (not a hard-coded demo subset). Handle file-loading errors clearly.

## 5. CSV export — preserve the existing department template

**Critical:** The output CSV must contain **exactly these 12 headers, in this exact order**. Do not rename, add, reorder, or split columns:

```csv
Engineer Name,Circuit/Transformer Name,Voltage,Section,Status,Starting Date,Finishing Date,Reason of Repair,Job Description,Materials Used,Company Name,Contract Number
```

| CSV column | Data mapping |
|---|---|
| `Engineer Name` | Engineer Name input |
| `Circuit/Transformer Name` | **Combine selected substation and manually entered Equipment ID / Name into one cell** |
| `Voltage` | Selected voltages joined with `, `, e.g. `132kV, 33kV` (one CSV cell, properly quoted) |
| `Section` | Section dropdown choice |
| `Status` | `Live` or `Dead` |
| `Starting Date` | Display as `DD/MM/YYYY` |
| `Finishing Date` | Display as `DD/MM/YYYY`, or blank when not entered |
| `Reason of Repair` | Reason of Repair input |
| `Job Description` | Job Description input |
| `Materials Used` | Materials Used input |
| `Company Name` | Company Name input |
| `Contract Number` | Contract Number input |

### Combined name formatting

The requested example is:

- Selected station short code: `MISH-A` (source full name: `MISHRIF -A`)
- Engineer types Equipment ID / Name: `30MVA TR 1`
- **CSV value:** `MISH "A" 30MVA TR 1`

Build a small, centralized `formatCsvEquipmentName(station, equipmentName)` function. For a station code in the simple `PREFIX-SUFFIX` pattern, render `PREFIX "SUFFIX" <equipment>`, preserving the source selection under the hood. For unusual codes, be conservative and preserve meaningful text rather than altering it incorrectly. Show the **final combined value in the CSV preview**, so engineers can verify it before download.

**CSV format requirements:**

- UTF-8 CSV, one report row plus the header row; Excel-friendly UTF-8 BOM is acceptable.
- Standard RFC-style CSV quoting: values containing quotes, commas, or newlines must be enclosed in quotes, and internal `"` characters must be doubled.
- **Never concatenate CSV text without escaping.** Example `MISH "A"` should be encoded as `"MISH ""A"" 30MVA TR 1"` inside the CSV cell.
- Guard against spreadsheet **formula injection** in any engineer-entered free-text field (e.g. values beginning with `=`, `+`, `-`, `@`, after leading whitespace). Apply a documented safe export approach while retaining the original user-entered data for PDF and JSON.
- Do not append PDF-only fields to the CSV.
- Filename example: `Transformer_Report_MISH-A_2026-11-18.csv` (sanitize unsafe filename characters).

## 6. PDF export — professional, more detailed than CSV

Create a **clean A4 portrait PDF**, with automatic pagination for long text, measurements, and images. Avoid text clipping or split table rows when possible.

Suggested PDF structure:

1. **Header:** `TRANSFORMER DEPARTMENT` / `MAINTENANCE & REPAIR REPORT`; optional department logo if supplied later; report date and an optional human-readable report reference.
2. **General information:** Engineer, starting/finishing dates, company, contract number.
3. **Equipment information:** **Separate** Substation Name (show both short code and full name), Equipment ID / Name, selected voltages, Section, and `Live`/`Dead` status.
4. **Repair information:** Reason of Repair, Job Description, Materials Used.
5. **Technical / inspection details:** Optional equipment specs, testing/measurements table, observations.
6. **Photographs:** Optional before and after images, resized to fit, with captions and logical page breaks.
7. **Recommendations / outstanding work.**
8. **Prepared by / Reviewed by:** engineer and supervisor names, and blank signature/date lines if desired.
9. **Footer:** Page X of Y if supported, otherwise page numbers; generated date.

### PDF design constraints

- Professional, restrained blue / gray / white engineering-report aesthetic, readable typography, comfortable margins.
- Labels clearly distinguished from values; no fake official approval stamps or fabricated department logos.
- Render missing optional values as `—` or `Not provided`, not guessed values.
- Long text wraps over multiple lines/pages; images do not cover content.
- A report generated with **only the required common fields** must still be valid even if all PDF extras are blank.
- Do not include empty full pages for unused PDF sections.
- PDF must remain **text-based/selectable** where practical (do not just screenshot the form).
- Filename example: `Transformer_Report_MISH-A_2026-11-18.pdf`.

## 7. Save Draft / Load Draft — JSON, no database

Add **Save Draft (.json)** and **Load Draft (.json)** to the UI.

- Export the complete **editable form state** as a downloadable JSON file, including selected station `{no,code,fullName}`, multi-selected voltages, common fields, PDF-only fields, inspection rows, and photo captions.
- If photos are included, preserve them in the JSON draft via reasonably compressed browser-generated data URLs; warn that a JSON file with photos may be large. Provide sensible size limits and validation. **Do not silently drop photos.**
- Include metadata such as `schemaVersion: 1`, `savedAt`, and `appName`.
- On load, validate JSON structure, compatible schema version, and all enum values. Show an understandable error for invalid/corrupt files; never execute imported content.
- Match a saved station by `NO` and verify it against the currently bundled CSV; warn if a previously saved record no longer exists or its source details changed, rather than substituting a different substation.
- Restoring a draft populates the form and allows normal editing and export without any account.
- The user can save revised drafts again. No server upload or automatic cross-device sync.
- Filename example: `Transformer_Report_Draft_MISH-A_2026-11-18.json`.

## 8. UI layout

Desktop-first one-page layout (responsive stacking on mobile):

```text
+------------------------------------------------------------------+
| Transformer Department  | Report Generator                       |
| [New / Clear]   [Load Draft] [Save Draft]                          |
+------------------------------------------------------------------+
| GENERAL / EQUIPMENT INFORMATION                                  |
| Engineer Name                                                     |
| Substation Name [type to search _________________________]        |
|     MISH-A  | MISHRIF -A                                     [>] |
|     MISH-M  | MISHRIF -M                                     [>] |
| Equipment ID / Name [30MVA TR 1____________________________]      |
| Voltage [132kV x] [33kV x] [+ select]                             |
| Section [Transformer v]     Status [Live v]                       |
| Starting Date [...]         Finishing Date [...]                 |
| Company Name [...]          Contract Number [...]                |
+------------------------------------------------------------------+
| REPAIR DETAILS                                                   |
| Reason of Repair [___________________________________________]  |
| Job Description  [___________________________________________]  |
| Materials Used    [___________________________________________]  |
+------------------------------------------------------------------+
| ADDITIONAL PDF DETAILS                          [Expand v]       |
| Technical details / Test results / Photos / Recommendations      |
+------------------------------------------------------------------+
| PREVIEW [CSV Summary] [PDF Preview]                               |
+------------------------------------------------------------------+
| [Download CSV]  [Download PDF]  [Save Draft JSON]                |
+------------------------------------------------------------------+
```

- Clear required indicators and inline errors; prevent invalid export.
- Accessible labels and keyboard navigation.
- Show a subtle confirmation after a successful browser download *only when a download has actually been triggered*.
- Display a small notice: `Your report is processed locally in this browser. Download a JSON draft to keep an editable copy.`

## 9. Suggested code organization

```text
src/
  components/
    ReportForm.tsx
    SubstationCombobox.tsx
    VoltageMultiSelect.tsx
    PdfExtras.tsx
    ReportPreview.tsx
  data/
    voltageOptions.ts
  lib/
    substations.ts        # load, validate, normalize, match
    validation.ts
    csvExport.ts          # exact 12-column CSV mapping
    pdfExport.tsx         # PDF template and download
    draftJson.ts          # versioned JSON save/load
    filenames.ts
  types/
    report.ts
  App.tsx
  main.tsx
public/
  data/
    substations.csv       # copy supplied CSV unchanged
```

Keep styling and layout components lightweight. No global state framework required; React state is sufficient.

## 10. Acceptance tests — must pass

1. Website loads correctly with no account/login and no backend services.
2. Search `MI` and see matching real station codes; search `MISH`, `MISHRIF`, and `MISH A` and find `MISH-A`.
3. **621** source rows are loaded, and duplicated short codes remain selectable as distinct records.
4. Select `MISH-A`, enter `30MVA TR 1`, and verify CSV combined-name preview displays **`MISH "A" 30MVA TR 1`**.
5. Select **both** `132kV` and `33kV`; both appear in the PDF and within one properly quoted CSV voltage cell.
6. Section dropdown has exactly the four requested choices; Status dropdown has exactly `Live` and `Dead`.
7. Generated CSV has **exactly 12 columns**, with original headers/order, even when PDF-only details are completed.
8. CSV correctly escapes `MISH "A"`, multiline descriptions, commas, and quotation marks; opens cleanly in Excel.
9. Both CSV and PDF reflect the same entered facts; PDF shows substation and equipment separately and includes any optional technical notes/photos.
10. PDF paginates without clipping long Job Description or multiple photos.
11. A JSON saved draft restores the original station, voltages, dates, details, and photos without using a server.
12. Invalid JSON and out-of-date station references show clear errors and do not silently alter the selected station.
13. Empty required fields and finishing dates earlier than starting dates block export with clear messages.
14. Basic keyboard, mobile, and offline-after-initial-load behavior work; do not rely on network calls to generate files.

## 11. Implementation order

1. Scaffold Vite + React + TypeScript + Tailwind.
2. Load and verify `public/data/substations.csv` (621 records) and build the autocomplete.
3. Implement single report form, multi-select voltage, Section/Status dropdowns, and validation.
4. Implement exact-format 12-column CSV exporter and CSV preview.
5. Implement detailed, paginated PDF template and PDF preview.
6. Add optional technical fields and photo handling.
7. Implement save/load versioned JSON draft (including photo preservation).
8. Test exports against the acceptance cases and polish responsive UI.
9. Provide concise README with `npm install`, `npm run dev`, `npm run build`, and static deployment instructions.

## 12. Explicitly out of scope for version 1

- Authentication, registration, permissions, role management.
- Dashboard, analytics, report history, cloud backups.
- Database, API backend, Supabase, NestJS, payment systems.
- Automatic electrical calculations or test pass/fail certification.
- AI-generated maintenance recommendations.
- Bulk upload, batch processing, and combined multi-report exports (possible future enhancement; do not add without request).

**Final result:** A reliable, simple website where engineers **type once**, can **search the department's substation list**, and can download a **CSV matching the existing 12-column template**, a **more detailed PDF**, and an **editable JSON draft**—with no backend or login.
