/** Visit and visit movement contracts as defined by REQ-VIS-001 (sections 3.1 and 3.2). */

export const VISIT_TYPES = ['OUTPATIENT', 'EMERGENCY', 'INPATIENT'] as const;
export const VISIT_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const ACTIVE_VISIT_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;
export const CLOSED_VISIT_STATUSES = ['COMPLETED', 'CANCELLED'] as const;

export const MOVEMENT_TYPES = [
  'TRIAGE',
  'CARE_STARTED',
  'DEPARTMENT_TRANSFER',
  'DISCHARGE',
  'CANCELLATION',
  'OTHER',
] as const;

/** Movements that never close a visit on their own (business rule 7). */
export const NON_CLOSING_MOVEMENT_TYPES = ['TRIAGE', 'DEPARTMENT_TRANSFER', 'OTHER'] as const;

/** Movements that close a visit and the status each one produces (business rules 5 and 6). */
export const CLOSING_MOVEMENTS = {
  DISCHARGE: 'COMPLETED',
  CANCELLATION: 'CANCELLED',
} as const;

export type VisitType = (typeof VISIT_TYPES)[number];
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type ClosingMovementType = keyof typeof CLOSING_MOVEMENTS;

/**
 * A reference to a `people` record. The requirement stores ObjectId references;
 * an API may return them either as plain ids or populated with the person data.
 */
export type PersonReference = string | { _id: string; name?: string };

/** Request body accepted by POST /api/visits. */
export interface VisitPayload {
  patientId: string;
  type: VisitType;
  admissionDate?: string;
  attendingProfessionalId?: string;
  chiefComplaint: string;
  notes?: string;
}

/** Editable fields accepted by PUT /api/visits/id/:id (business rule 13). */
export interface VisitUpdatePayload {
  type?: VisitType;
  attendingProfessionalId?: string | null;
  chiefComplaint?: string;
  notes?: string;
}

/** Visit resource returned by the Visits API. */
export interface Visit {
  _id: string;
  patientId: PersonReference;
  type: VisitType;
  status: VisitStatus;
  admissionDate: string;
  attendingProfessionalId?: PersonReference | null;
  chiefComplaint: string;
  notes?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Request body accepted by POST /api/visits/id/:id/movements. */
export interface MovementPayload {
  type: MovementType;
  occurredAt?: string;
  departmentFrom?: string;
  departmentTo?: string;
  responsibleProfessionalId?: string;
  description?: string;
}

/** Movement resource returned by the movements endpoints. */
export interface VisitMovement {
  _id: string;
  visitId: string;
  type: MovementType;
  occurredAt: string;
  departmentFrom?: string | null;
  departmentTo?: string | null;
  responsibleProfessionalId?: PersonReference | null;
  description?: string | null;
  createdAt: string;
}
