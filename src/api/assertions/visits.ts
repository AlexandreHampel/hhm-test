import { expect } from '@playwright/test';
import { referenceId } from '../helpers/references';
import { toEpoch } from '../helpers/time';
import { ACTIVE_VISIT_STATUSES, MOVEMENT_TYPES, MovementPayload, VISIT_STATUSES, VISIT_TYPES, Visit, VisitMovement, VisitPayload, VisitStatus } from '../helpers/models/visit';

export { expectApiError } from './people';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function isValidDate(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Asserts two timestamps denote the same instant, regardless of their textual format. */
export function expectSameInstant(actual: string | null | undefined, expected: string, label: string): void {
  expect(isValidDate(actual), `${label} must be a valid date: ${actual}`).toBe(true);
  expect(toEpoch(actual), `${label}: expected ${expected}, received ${actual}`).toBe(toEpoch(expected));
}

/** Asserts a visit resource complies with the `visits` data model (section 3.1). */
export function expectVisitContract(visit: Visit): void {
  expect(visit._id, 'Visit identifier must be a MongoDB ObjectId').toMatch(OBJECT_ID_PATTERN);
  expect(referenceId(visit.patientId), 'patientId must reference a person ObjectId').toMatch(OBJECT_ID_PATTERN);
  expect(VISIT_TYPES as readonly string[], `Unsupported visit type persisted: ${visit.type}`).toContain(visit.type);
  expect(VISIT_STATUSES as readonly string[], `Unsupported visit status persisted: ${visit.status}`).toContain(visit.status);
  expect(isValidDate(visit.admissionDate), `admissionDate must be a date: ${visit.admissionDate}`).toBe(true);
  expect(typeof visit.chiefComplaint, 'chiefComplaint must be a string').toBe('string');
  expect(visit.chiefComplaint.trim().length, 'chiefComplaint must not be blank').toBeGreaterThan(0);
  expect(isValidDate(visit.createdAt), `createdAt must be generated: ${visit.createdAt}`).toBe(true);
  expect(isValidDate(visit.updatedAt), `updatedAt must be generated: ${visit.updatedAt}`).toBe(true);

  const professionalId = referenceId(visit.attendingProfessionalId);

  if (professionalId !== undefined) {
    expect(professionalId, 'attendingProfessionalId must reference a person ObjectId').toMatch(OBJECT_ID_PATTERN);
  }

  if ((ACTIVE_VISIT_STATUSES as readonly string[]).includes(visit.status)) {
    expect(visit.closedAt ?? null, 'closedAt must be null while the visit is active').toBeNull();
  } else {
    expect(isValidDate(visit.closedAt), `closedAt must be set on a closed visit: ${visit.closedAt}`).toBe(true);
  }
}

/** Asserts the persisted visit reflects the submitted payload. */
export function expectVisitToMatchPayload(visit: Visit, payload: VisitPayload): void {
  expect(referenceId(visit.patientId), 'Visit must reference the submitted patient').toBe(payload.patientId);
  expect(visit.type).toBe(payload.type);
  expect(visit.chiefComplaint).toBe(payload.chiefComplaint);

  if (payload.admissionDate !== undefined) {
    expectSameInstant(visit.admissionDate, payload.admissionDate, 'admissionDate');
  }

  if (payload.notes !== undefined) {
    expect(visit.notes).toBe(payload.notes);
  }

  if (payload.attendingProfessionalId !== undefined) {
    expect(referenceId(visit.attendingProfessionalId)).toBe(payload.attendingProfessionalId);
  }
}

/** Asserts the visit is in the given active status with no closing timestamp. */
export function expectActiveVisit(visit: Visit, status: VisitStatus): void {
  expect(visit.status, `Visit ${visit._id} status`).toBe(status);
  expect(visit.closedAt ?? null, `Visit ${visit._id} must not have closedAt while active`).toBeNull();
}

/** Asserts the visit is closed with the given status and a consistent closing timestamp. */
export function expectClosedVisit(visit: Visit, status: VisitStatus): void {
  expect(visit.status, `Visit ${visit._id} status`).toBe(status);
  expect(isValidDate(visit.closedAt), `Visit ${visit._id} must have closedAt: ${visit.closedAt}`).toBe(true);
  expect(toEpoch(visit.closedAt), 'closedAt cannot precede the admission').toBeGreaterThanOrEqual(
    toEpoch(visit.admissionDate),
  );
}

/** Asserts a movement resource complies with the `visit_movements` data model (section 3.2). */
export function expectMovementContract(movement: VisitMovement, visitId: string): void {
  expect(movement._id, 'Movement identifier must be a MongoDB ObjectId').toMatch(OBJECT_ID_PATTERN);
  expect(movement.visitId, 'Movement must be linked to its visit').toBe(visitId);
  expect(MOVEMENT_TYPES as readonly string[], `Unsupported movement type: ${movement.type}`).toContain(movement.type);
  expect(isValidDate(movement.occurredAt), `occurredAt must be a date: ${movement.occurredAt}`).toBe(true);
  expect(isValidDate(movement.createdAt), `createdAt must be generated: ${movement.createdAt}`).toBe(true);
}

/** Asserts the persisted movement reflects the submitted payload. */
export function expectMovementToMatchPayload(movement: VisitMovement, payload: MovementPayload): void {
  expect(movement.type).toBe(payload.type);

  if (payload.occurredAt !== undefined) {
    expectSameInstant(movement.occurredAt, payload.occurredAt, 'occurredAt');
  }

  for (const field of ['departmentFrom', 'departmentTo', 'description'] as const) {
    if (payload[field] !== undefined) {
      expect(movement[field], `Movement ${field}`).toBe(payload[field]);
    }
  }

  if (payload.responsibleProfessionalId !== undefined) {
    expect(referenceId(movement.responsibleProfessionalId)).toBe(payload.responsibleProfessionalId);
  }
}

/**
 * Asserts the documented timeline order (rule 10): ascending `occurredAt`, then
 * `createdAt`, then `_id` as deterministic tie-breakers.
 */
export function expectChronologicalTimeline(movements: VisitMovement[]): void {
  for (let index = 1; index < movements.length; index++) {
    const previous = movements[index - 1];
    const current = movements[index];
    const byOccurred = toEpoch(previous.occurredAt) - toEpoch(current.occurredAt);
    const byCreated = toEpoch(previous.createdAt) - toEpoch(current.createdAt);
    const inOrder = byOccurred < 0 ||
      (byOccurred === 0 && (byCreated < 0 || (byCreated === 0 && previous._id < current._id)));

    expect(inOrder, `Movement ${current._id} is out of chronological order after ${previous._id}`).toBe(true);
  }
}

/** Asserts the list is ordered newest admission first (documented default, section 6). */
export function expectNewestAdmissionFirst(visits: Visit[]): void {
  for (let index = 1; index < visits.length; index++) {
    expect(
      toEpoch(visits[index - 1].admissionDate),
      `Visit ${visits[index]._id} is listed before an older admission`,
    ).toBeGreaterThanOrEqual(toEpoch(visits[index].admissionDate));
  }
}

/** Returns the ids of the visits, in list order. */
export function idsOf(records: Array<{ _id: string }>): string[] {
  return records.map((record) => record._id);
}
