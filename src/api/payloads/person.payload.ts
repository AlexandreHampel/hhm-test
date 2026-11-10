import { generateCpf } from '../helpers/cpf';
import { uniqueSuffix } from '../helpers/unique';
import { Person, PersonPayload } from '../helpers/models/person';

/** Prefix that identifies records created by this automation. */
export const TEST_DATA_PREFIX = 'QA-API';

/**
 * Standard person payload.
 *
 * It is frozen on purpose: builders always work on a copy, so a scenario can
 * never change the defaults used by the other scenarios.
 */
export const STANDARD_PERSON: Readonly<PersonPayload> = Object.freeze({
  name: 'Standard Person',
  cpf: 'replaced-by-builder',
  birthDate: '1990-05-15',
  email: 'standard.person@example.com',
  phone: '47999990000',
  roles: ['PATIENT'] as PersonPayload['roles'],
});

/** Standard custom role names used with the OTHER role. */
export const STANDARD_CUSTOM_ROLES: readonly string[] = Object.freeze(['Physiotherapist', 'Receptionist']);

/**
 * Well-formed cpf that is never registered by the automation, so it stays
 * unknown to the API. Kept static because scenario titles must be stable
 * between the runner and the worker processes.
 */
export const UNREGISTERED_CPF = '52998224725';

/** Well-formed identifier that does not belong to any person. */
export const UNKNOWN_PERSON_ID = 'ffffffffffffffffffffffff';

/** Identifiers that cannot be parsed as a MongoDB ObjectId. */
export const MALFORMED_PERSON_IDS: readonly string[] = Object.freeze([
  'abc',
  'not-an-object-id',
  'zzzzzzzzzzzzzzzzzzzzzzzz',
]);

/** Returns an editable deep copy of the standard payload with a unique identity. */
function copyStandardPerson(): PersonPayload {
  const copy = structuredClone(STANDARD_PERSON) as PersonPayload;
  const suffix = uniqueSuffix();

  copy.name = `${TEST_DATA_PREFIX} ${copy.name} ${suffix}`;
  copy.cpf = generateCpf();
  copy.email = `qa.api.${suffix}@example.com`;

  return copy;
}

/** Builds a valid person payload, applying the given changes to a copy of the standard payload. */
export function buildPerson(overrides: Partial<PersonPayload> = {}): PersonPayload {
  return { ...copyStandardPerson(), ...structuredClone(overrides) };
}

/** Builds a payload holding the OTHER role and the given custom roles. */
export function buildPersonWithCustomRoles(customRoles: readonly string[] = STANDARD_CUSTOM_ROLES): PersonPayload {
  return buildPerson({ roles: ['OTHER'], custom_roles: [...customRoles] });
}

/** Builds a payload containing only the fields that the person model marks as required. */
export function buildRequiredOnlyPerson(overrides: Partial<PersonPayload> = {}): PersonPayload {
  const { name, cpf, birthDate, roles } = copyStandardPerson();

  return { name, cpf, birthDate, roles, ...structuredClone(overrides) };
}

/** Builds a valid payload and removes one field, for missing-field scenarios. */
export function buildPersonWithout(field: keyof PersonPayload): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...buildPerson() };
  delete payload[field];

  return payload;
}

/** Builds a full update payload from a persisted person plus the given changes. */
export function buildUpdatePayload(person: Person, changes: Partial<PersonPayload> = {}): PersonPayload {
  const { name, cpf, birthDate, email, phone, roles, custom_roles } = structuredClone(person);

  return {
    name,
    cpf,
    birthDate: birthDate.slice(0, 10),
    email,
    phone,
    roles,
    custom_roles: custom_roles ?? [],
    ...structuredClone(changes),
  };
}
