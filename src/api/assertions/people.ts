import { APIResponse, expect } from '@playwright/test';
import { ApiError, OTHER_ROLE, Person, PersonPayload, SUPPORTED_ROLES } from '../helpers/models/person';
import { expectStatus, readJson } from '../helpers/http';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function sorted(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

function isValidDate(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Asserts a failed request returns one of the expected status codes and an
 * HHM-style JSON error body with a meaningful message. Requiring a JSON body
 * prevents framework-level responses, such as the default not-found HTML page,
 * from being accepted as business errors.
 */
export async function expectApiError(
  response: APIResponse,
  expectedStatus: number | readonly number[],
  messagePattern?: RegExp,
): Promise<ApiError> {
  await expectStatus(response, expectedStatus);
  const body = await readJson<ApiError>(response);

  expect(typeof body.message, 'Error body must contain a "message" string').toBe('string');
  expect(body.message.trim().length, 'Error message must not be blank').toBeGreaterThan(0);

  if (messagePattern) {
    expect(body.message, 'Error message must describe the failure').toMatch(messagePattern);
  }

  return body;
}

/** Asserts a person resource complies with the person data model. */
export function expectPersonContract(person: Person): void {
  expect(person._id, 'Identifier must be a MongoDB ObjectId').toMatch(OBJECT_ID_PATTERN);
  expect(typeof person.name).toBe('string');
  expect(person.name.trim().length).toBeGreaterThan(0);
  expect(typeof person.cpf).toBe('string');
  expect(isValidDate(person.birthDate), `Birth date must be a date: ${person.birthDate}`).toBe(true);
  expect(isValidDate(person.createdAt), `Creation timestamp must be generated: ${person.createdAt}`).toBe(true);
  expect(isValidDate(person.updatedAt), `Update timestamp must be generated: ${person.updatedAt}`).toBe(true);

  expect(Array.isArray(person.roles), 'Roles must be an array').toBe(true);
  expect(person.roles.length, 'Roles must contain at least one role').toBeGreaterThan(0);

  for (const role of person.roles) {
    expect(SUPPORTED_ROLES as readonly string[], `Unsupported role persisted: ${role}`).toContain(role);
  }

  if (person.custom_roles !== undefined) {
    expect(Array.isArray(person.custom_roles), 'Custom roles must be an array').toBe(true);

    for (const customRole of person.custom_roles) {
      expect(typeof customRole, 'Custom roles must contain plain strings, not references').toBe('string');
    }
  }

  if (person.roles.includes(OTHER_ROLE)) {
    expect(person.custom_roles?.length ?? 0, 'OTHER requires at least one custom role').toBeGreaterThan(0);
  } else {
    expect(person.custom_roles ?? [], 'Custom roles must be empty or absent without OTHER').toEqual([]);
  }
}

/** Asserts the persisted person reflects the submitted payload. */
export function expectPersonToMatchPayload(person: Person, payload: PersonPayload): void {
  expect(person.name).toBe(payload.name);
  expect(person.cpf).toBe(payload.cpf);
  expect(person.birthDate.slice(0, 10), 'Birth date must keep the submitted calendar date').toBe(payload.birthDate);
  expect(sorted(person.roles), 'Roles must match the submitted roles').toEqual(sorted(payload.roles));

  if (payload.email !== undefined) {
    expect(person.email).toBe(payload.email);
  }

  if (payload.phone !== undefined) {
    expect(person.phone).toBe(payload.phone);
  }

  if (payload.roles.includes(OTHER_ROLE)) {
    expect(sorted(person.custom_roles), 'Custom roles must match the submitted custom roles').toEqual(
      sorted(payload.custom_roles),
    );
  } else {
    expect(person.custom_roles ?? []).toEqual([]);
  }
}

/** Asserts the list contains the person with the given id exactly once. */
export function expectListToContainOnce(people: Person[], id: string, context: string): void {
  const matches = people.filter((person) => person._id === id);

  expect(matches, `${context}: Expected person ${id} exactly once`).toHaveLength(1);
}

export function expectListNotToContain(people: Person[], id: string, context: string): void {
  expect(
    people.some((person) => person._id === id),
    `${context}: Person ${id} must not be listed`,
  ).toBe(false);
}
