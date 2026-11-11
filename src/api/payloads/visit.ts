import { uniqueSuffix } from '../helpers/unique';
import { HOUR_MS, isoAgo } from '../helpers/time';
import { MovementPayload, MovementType, Visit, VisitPayload } from '../helpers/models/visit';
import { referenceId } from '../helpers/references';
import { TEST_DATA_PREFIX } from './person';

/**
 * Standard visit payload, without the patient reference, which every scenario
 * supplies. Frozen so builders always work on a copy.
 */
export const STANDARD_VISIT: Readonly<Omit<VisitPayload, 'patientId'>> = Object.freeze({
  type: 'OUTPATIENT',
  chiefComplaint: 'Persistent headache',
  notes: 'Patient reports symptoms for three days',
});

/**
 * Default admission offset. Admitting the patient in the past leaves room to
 * append movements with explicit timestamps between admission and "now".
 */
export const DEFAULT_ADMISSION_OFFSET_MS = 2 * HOUR_MS;

/** Well-formed ObjectId that never belongs to a visit or a person. */
export const UNKNOWN_OBJECT_ID = 'ffffffffffffffffffffffff';

/** Identifiers that cannot be parsed as a MongoDB ObjectId. */
export const MALFORMED_IDS: readonly string[] = Object.freeze(['abc', 'not-an-object-id', 'zzzzzzzzzzzzzzzzzzzzzzzz']);

/** Builds a valid visit payload for the given patient, applying the given changes to a copy. */
export function buildVisit(patientId: string, overrides: Partial<VisitPayload> = {}): VisitPayload {
  return {
    ...structuredClone(STANDARD_VISIT),
    patientId,
    admissionDate: isoAgo(DEFAULT_ADMISSION_OFFSET_MS),
    chiefComplaint: `${TEST_DATA_PREFIX} ${STANDARD_VISIT.chiefComplaint} ${uniqueSuffix()}`,
    ...structuredClone(overrides),
  };
}

/** Builds a payload containing only the fields that the visit model marks as required without default. */
export function buildRequiredOnlyVisit(patientId: string): VisitPayload {
  const { type, chiefComplaint } = buildVisit(patientId);

  return { patientId, type, chiefComplaint };
}

/** Builds a valid visit payload and removes one field, for missing-field scenarios. */
export function buildVisitWithout(patientId: string, field: keyof VisitPayload): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...buildVisit(patientId) };
  delete payload[field];

  return payload;
}

/**
 * Builds a minimal valid movement of the given type. Context-sensitive fields
 * that the requirement makes mandatory (destination for transfers, description
 * for OTHER) are filled so the movement is valid by default.
 */
export function buildMovement(type: MovementType, overrides: Partial<MovementPayload> = {}): MovementPayload {
  const movement: MovementPayload = { type };

  if (type === 'DEPARTMENT_TRANSFER') {
    movement.departmentTo = 'Cardiology';
  }

  if (type === 'OTHER') {
    movement.description = `${TEST_DATA_PREFIX} Family meeting ${uniqueSuffix()}`;
  }

  return { ...movement, ...structuredClone(overrides) };
}

/**
 * Builds a full update payload holding every editable field of the persisted
 * visit (rule 13) plus the given changes. Sending the complete editable set
 * keeps scenarios valid whether PUT is implemented as a merge or a replacement.
 */
export function buildVisitUpdate(visit: Visit, changes: Record<string, unknown> = {}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: visit.type,
    chiefComplaint: visit.chiefComplaint,
  };

  if (visit.notes !== undefined && visit.notes !== null) {
    payload.notes = visit.notes;
  }

  const professionalId = referenceId(visit.attendingProfessionalId);

  if (professionalId !== undefined) {
    payload.attendingProfessionalId = professionalId;
  }

  return { ...payload, ...structuredClone(changes) };
}
