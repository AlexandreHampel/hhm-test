import { Page } from '@playwright/test';
import { shiftDateTime } from '../helpers/format';
import { PersonFormData, Role } from '../helpers/models';
import { MovementFormData, VisitFormData, VisitStatus } from '../helpers/visits';
import { buildPersonForm } from '../payloads/person';
import { buildMovementForm, buildVisitForm } from '../payloads/visit';
import { IdOfTheListedVisit, NowInTheBrowser } from '../questions/visits';
import { ask, askUntilPresent, perform } from '../screenplay/core';
import { RegisterPerson } from './registration';
import { FindTheVisits, RecordMovement, RegisterVisit } from './visits';

/**
 * Scenario preconditions prepared through the interface, like every UI
 * scenario in this suite. They return what the scenario needs to refer to the
 * records afterwards (names, entered data, visit IDs).
 */

/** Default admission offset: in the past, leaving room for backdated movements. */
export const ADMITTED_MINUTES_AGO = 120;

/** Registers a person holding PATIENT (plus any extra roles) through the General Registration form. */
export async function aRegisteredPatient(page: Page, extraRoles: Role[] = []): Promise<PersonFormData> {
  const roles: Role[] = ['PATIENT', ...extraRoles];
  const patient = buildPersonForm({ roles, customRoles: roles.includes('OTHER') ? ['Volunteer'] : [] });
  await perform(page, RegisterPerson.with(patient));

  return patient;
}

/** Registers a person with the given roles, for example a doctor, through the General Registration form. */
export async function aRegisteredPerson(page: Page, roles: Role[]): Promise<PersonFormData> {
  const person = buildPersonForm({ roles, customRoles: roles.includes('OTHER') ? ['Volunteer'] : [] });
  await perform(page, RegisterPerson.with(person));

  return person;
}

/** Browser-local date-time the given number of minutes ago, in datetime-local shape. */
export async function minutesAgo(page: Page, minutes: number): Promise<string> {
  return shiftDateTime(await ask(page, NowInTheBrowser()), -minutes);
}

/**
 * Creates a visit through the New Visit form and returns its ID, read from the
 * visit list. The page is left on the list, narrowed to that visit.
 */
export async function aVisit(page: Page, data: VisitFormData): Promise<string> {
  await perform(page, RegisterVisit.with(data));

  return anIdOfTheVisit(page, data);
}

/** Finds the visit created with the given data in the list (its chief complaint is unique) and returns its ID. */
export async function anIdOfTheVisit(page: Page, data: VisitFormData): Promise<string> {
  await perform(page, FindTheVisits.ofPatient(data.patientName, { 'chief-complaint': data.chiefComplaint }));

  return askUntilPresent(page, IdOfTheListedVisit.ofPatient(data.patientName));
}

/** Movements that take a new visit to each status through the interface. */
const MOVEMENTS_TO: Record<VisitStatus, MovementFormData[]> = {
  OPEN: [],
  IN_PROGRESS: [buildMovementForm('CARE_STARTED')],
  COMPLETED: [buildMovementForm('CARE_STARTED'), buildMovementForm('DISCHARGE')],
  CANCELLED: [buildMovementForm('CANCELLATION')],
};

/**
 * Registers a new patient and a visit for them, admitted two hours ago, and
 * takes the visit to the requested status by recording the documented
 * movements on its details page.
 */
export async function aVisitInStatus(
  page: Page,
  status: VisitStatus,
  overrides: Partial<VisitFormData> = {},
): Promise<{ patient: PersonFormData; data: VisitFormData; visitId: string }> {
  const patient = await aRegisteredPatient(page);
  const data = buildVisitForm(patient.name, await minutesAgo(page, ADMITTED_MINUTES_AGO), overrides);

  await perform(page, RegisterVisit.with(data), ...MOVEMENTS_TO[status].map((movement) => RecordMovement.with(movement)));

  return { patient, data, visitId: await anIdOfTheVisit(page, data) };
}
