/**
 * Patient visit data as the automation enters and expects it on screen
 * (REQ-VIS-001). Like the person model, it never depends on the API layer or
 * on application code, so it can act as an independent oracle.
 */

export const VISIT_TYPES = ['OUTPATIENT', 'EMERGENCY', 'INPATIENT'] as const;
export const VISIT_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const MOVEMENT_TYPES = ['TRIAGE', 'CARE_STARTED', 'DEPARTMENT_TRANSFER', 'DISCHARGE', 'CANCELLATION', 'OTHER'] as const;

export type VisitType = (typeof VISIT_TYPES)[number];
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const ACTIVE_STATUSES: readonly VisitStatus[] = ['OPEN', 'IN_PROGRESS'];
export const CLOSED_STATUSES: readonly VisitStatus[] = ['COMPLETED', 'CANCELLED'];

/** Movements that close the visit, with the status each produces (rules 5 and 6). */
export const CLOSING_MOVEMENTS = { DISCHARGE: 'COMPLETED', CANCELLATION: 'CANCELLED' } as const;
export type ClosingMovement = keyof typeof CLOSING_MOVEMENTS;

/** Label shown on screen and key used in test IDs, for every option. */
interface Option {
  label: string;
  key: string;
}

export const VISIT_TYPE_OPTIONS: Readonly<Record<VisitType, Option>> = Object.freeze({
  OUTPATIENT: { label: 'Outpatient', key: 'outpatient' },
  EMERGENCY: { label: 'Emergency', key: 'emergency' },
  INPATIENT: { label: 'Inpatient', key: 'inpatient' },
});

export const VISIT_STATUS_OPTIONS: Readonly<Record<VisitStatus, Option>> = Object.freeze({
  OPEN: { label: 'Open', key: 'open' },
  IN_PROGRESS: { label: 'In Progress', key: 'in-progress' },
  COMPLETED: { label: 'Completed', key: 'completed' },
  CANCELLED: { label: 'Cancelled', key: 'cancelled' },
});

export const MOVEMENT_TYPE_OPTIONS: Readonly<Record<MovementType, Option>> = Object.freeze({
  TRIAGE: { label: 'Triage', key: 'triage' },
  CARE_STARTED: { label: 'Care Started', key: 'care-started' },
  DEPARTMENT_TRANSFER: { label: 'Department Transfer', key: 'department-transfer' },
  DISCHARGE: { label: 'Discharge', key: 'discharge' },
  CANCELLATION: { label: 'Cancellation', key: 'cancellation' },
  OTHER: { label: 'Other', key: 'other' },
});

/** Field limits stated by the form (chief complaint, notes, department, description). */
export const CHIEF_COMPLAINT_MAX_LENGTH = 500;
export const NOTES_MAX_LENGTH = 2000;

/**
 * Data entered in the New Visit form. People are referenced by name, the way
 * a user finds them in the selectors. Dates are browser-local date-times in
 * the `YYYY-MM-DDTHH:mm` shape of a datetime-local input.
 */
export interface VisitFormData {
  patientName: string;
  type: VisitType;
  professionalName: string;
  admission: string;
  chiefComplaint: string;
  notes: string;
}

/** Data entered in the Add Movement form. Without `occurredAt` the current date and time are used. */
export interface MovementFormData {
  type: MovementType;
  occurredAt?: string;
  departmentFrom?: string;
  departmentTo?: string;
  professionalName?: string;
  description?: string;
}

/** Editable fields of an active visit (rule 13). */
export interface VisitEditData {
  type: VisitType;
  professionalName: string;
  chiefComplaint: string;
  notes: string;
}

/** What a row of the visit list shows. */
export interface DisplayedVisitRow {
  patient: string;
  type: string;
  admission: string;
  status: string;
  professional: string;
}

/** What the summary of the details page shows. */
export interface DisplayedVisitSummary {
  status: string;
  patient: string;
  type: string;
  admission: string;
  professional: string;
  closedAt: string;
  chiefComplaint: string;
  notes: string;
}

/** What a timeline entry shows. Absent parts are null. */
export interface DisplayedMovement {
  id: string;
  type: string;
  occurredAt: string;
  departments: string | null;
  professional: string | null;
  description: string | null;
}
