export interface Substation {
  /** Source record identifier (NO column) — unique. */
  no: number;
  /** Short code (S/S NAME column), may be duplicated across records. */
  code: string;
  /** Full name (S/S FULL NAME column). */
  fullName: string;
}

export const SECTIONS = ['Transformer', 'Feeder', 'Shunt Reactor', 'Local Transformer'] as const;
export type Section = (typeof SECTIONS)[number];

export const STATUSES = ['Live', 'Dead'] as const;
export type Status = (typeof STATUSES)[number];

export interface InspectionRow {
  id: string;
  parameter: string;
  value: string;
  unit: string;
  remarks: string;
}

export interface Photo {
  id: string;
  /** Compressed JPEG data URL generated in the browser. */
  dataUrl: string;
  caption: string;
  width: number;
  height: number;
}

export interface ReportData {
  // A. General / equipment
  engineerName: string;
  substation: Substation | null;
  equipmentName: string;
  voltages: string[];
  section: Section | '';
  status: Status | '';
  startDate: string; // ISO YYYY-MM-DD
  finishDate: string; // ISO YYYY-MM-DD or ''
  companyName: string;
  contractNumber: string;

  // B. Repair information
  reasonOfRepair: string;
  jobDescription: string;
  materialsUsed: string;

  // C. Additional PDF details
  reportReference: string;
  equipmentType: string;
  serialNumber: string;
  ratedCapacity: string;
  location: string;
  inspectionRows: InspectionRow[];
  observations: string;
  beforePhotos: Photo[];
  afterPhotos: Photo[];
  recommendations: string;
  /** PDF only: optional foreman names (any number). */
  foremanNames: string[];
  /** PDF only: optional date printed next to "Prepared by" (ISO YYYY-MM-DD or ''). */
  preparedDate: string;
}

export function emptyReport(): ReportData {
  return {
    engineerName: '',
    substation: null,
    equipmentName: '',
    voltages: [],
    section: '',
    status: '',
    startDate: '',
    finishDate: '',
    companyName: '',
    contractNumber: '',
    reasonOfRepair: '',
    jobDescription: '',
    materialsUsed: '',
    reportReference: '',
    equipmentType: '',
    serialNumber: '',
    ratedCapacity: '',
    location: '',
    inspectionRows: [],
    observations: '',
    beforePhotos: [],
    afterPhotos: [],
    recommendations: '',
    foremanNames: [],
    preparedDate: '',
  };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
