import { test, expect, API_TAGS } from '../../../../fixtures/api.fixture';
import { HTTP_STATUS } from '../../helpers/expected-status';
import { expectStatus, readJson } from '../../helpers/http';
import { expectApiError, expectListToContainOnce, expectPersonContract, expectPersonToMatchPayload } from '../../assertions/people';
import { buildPerson, buildPersonWithout, buildRequiredOnlyPerson } from '../../payloads/person';
import { Person, PersonPayload, STANDARD_ROLES, SUPPORTED_ROLES } from '../../helpers/models/person';

test.describe('People API | Create person', () => {
  test.describe('POSITIVE', () => {
    test('Creates a person with only the required fields', {
      tag: [...API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ peopleApi }) => {
      const payload = buildRequiredOnlyPerson({ roles: ['PATIENT'] });
      let created!: Person;

      await test.step('Post a payload containing name, CPF, birth date and roles only', async () => {
        const response = await peopleApi.create(payload);
        await expectStatus(response, HTTP_STATUS.CREATED);
        created = await readJson<Person>(response);
      });

      await test.step('Response body complies with the person data model', async () => {
        expectPersonContract(created);
        expectPersonToMatchPayload(created, payload);
      });

      await test.step('Optional email and phone are not invented by the API', async () => {
        expect(created.email ?? '').toBe('');
        expect(created.phone ?? '').toBe('');
      });

      await test.step('Person is persisted and retrievable by ID', async () => {
        const persisted = await peopleApi.getPerson(created._id);
        expectPersonToMatchPayload(persisted, payload);
        expect(persisted.createdAt).toBe(created.createdAt);
      });
    });

    test('Creates a person with all fields populated', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['DOCTOR'] });
      let created!: Person;

      await test.step('Post a payload with name, CPF, birth date, email, phone and roles', async () => {
        created = await peopleApi.createPerson(payload);
      });

      await test.step('Every submitted field is returned and generated fields are present', async () => {
        expectPersonContract(created);
        expectPersonToMatchPayload(created, payload);
        expect(created.createdAt).toBeTruthy();
        expect(created.updatedAt).toBeTruthy();
      });

      await test.step('Person is persisted and retrievable by CPF', async () => {
        const response = await peopleApi.findByCpf(payload.cpf);
        await expectStatus(response, HTTP_STATUS.OK);
        const persisted = await readJson<Person>(response);
        expect(persisted._id).toBe(created._id);
        expectPersonToMatchPayload(persisted, payload);
      });
    });

    for (const role of STANDARD_ROLES) {
      test(`Creates a person with the single standard role ${role}`, {
        tag: [...API_TAGS, '@POSITIVE'],
      }, async ({ peopleApi }) => {
        const payload = buildPerson({ roles: [role] });

        await test.step(`Post a person whose only role is ${role}`, async () => {
          const created = await peopleApi.createPerson(payload);
          expectPersonContract(created);
          expect(created.roles).toEqual([role]);
          expect(created.custom_roles ?? []).toEqual([]);
        });
      });
    }

    test('Creates a person holding multiple standard roles in a single record', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['DOCTOR', 'PATIENT'] });
      let created!: Person;

      await test.step('Post a person with the DOCTOR and PATIENT roles', async () => {
        created = await peopleApi.createPerson(payload);
        expectPersonToMatchPayload(created, payload);
      });

      await test.step('Only one record exists for the CPF', async () => {
        const all = await peopleApi.listAll();
        expect(all.filter((person) => person.cpf === payload.cpf)).toHaveLength(1);
        expectListToContainOnce(all, created._id, 'People list');
      });
    });

    test('Creates a person with every supported role and multiple custom roles', {
      tag: [...API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({
        roles: [...SUPPORTED_ROLES],
        custom_roles: ['Physiotherapist', 'Receptionist'],
      });

      await test.step('Post a person holding all supported roles and two custom roles', async () => {
        const created = await peopleApi.createPerson(payload);
        expectPersonContract(created);
        expectPersonToMatchPayload(created, payload);
      });
    });

    test('Preserves accented and non-ASCII characters in the name', {
      tag: [...API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ name: `José Conceição Ñandú Müller ${Date.now()}` });

      await test.step('Post a person with a Unicode name', async () => {
        const created = await peopleApi.createPerson(payload);
        expect(created.name).toBe(payload.name);
      });

      await test.step('The stored name round-trips unchanged', async () => {
        const response = await peopleApi.findByCpf(payload.cpf);
        expect((await readJson<Person>(response)).name).toBe(payload.name);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    for (const field of ['name', 'cpf', 'birthDate', 'roles'] as const) {
      test(`Rejects a person without the required field "${field}"`, {
        tag: [...API_TAGS, '@NEGATIVE'],
      }, async ({ peopleApi }) => {
        const payload = buildPersonWithout(field);

        await test.step(`Post a payload missing "${field}"`, async () => {
          const response = await peopleApi.create(payload);
          await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR);
        });

        if (field !== 'cpf') {
          await test.step('No record is persisted for the CPF', async () => {
            const response = await peopleApi.findByCpf(String(payload.cpf));
            await expectApiError(response, HTTP_STATUS.NOT_FOUND);
          });
        }
      });
    }

    const blankValues: Array<{ field: keyof PersonPayload; value: unknown; label: string }> = [
      { field: 'name', value: '', label: 'empty name' },
      { field: 'name', value: '   ', label: 'whitespace-only name' },
      { field: 'cpf', value: '', label: 'empty CPF' },
      { field: 'birthDate', value: '', label: 'empty birth date' },
      { field: 'birthDate', value: 'not-a-date', label: 'unparseable birth date' },
      { field: 'roles', value: [], label: 'empty roles array' },
    ];

    for (const { field, value, label } of blankValues) {
      test(`Rejects a person with ${label}`, {
        tag: [...API_TAGS, '@NEGATIVE', '@BOUNDARY'],
      }, async ({ peopleApi }) => {
        const payload = buildPerson({ [field]: value } as Partial<PersonPayload>);

        await test.step(`Post a payload with ${label}`, async () => {
          const response = await peopleApi.create(payload);
          await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR);
        });
      });
    }

    const unsupportedRoles: Array<{ roles: unknown[]; label: string }> = [
      { roles: ['SURGEON'], label: 'an unknown role identifier' },
      { roles: ['DOCTOR', 'JANITOR'], label: 'a valid role mixed with an unknown role' },
      { roles: ['Physiotherapist'], label: 'a custom role name used as a role identifier' },
      { roles: [''], label: 'a blank role identifier' },
    ];

    for (const { roles, label } of unsupportedRoles) {
      test(`Rejects ${label}`, {
        tag: [...API_TAGS, '@NEGATIVE'],
      }, async ({ peopleApi }) => {
        const payload = buildPerson({ roles: roles as PersonPayload['roles'] });

        await test.step(`Post a person with roles ${JSON.stringify(roles)}`, async () => {
          const response = await peopleApi.create(payload);
          await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR, /role/i);
        });

        await test.step('No record is persisted', async () => {
          await expectApiError(await peopleApi.findByCpf(payload.cpf), HTTP_STATUS.NOT_FOUND);
        });
      });
    }

    test('Rejects a duplicate CPF and keeps the original record unchanged', {
      tag: [...API_TAGS, '@NEGATIVE'],
    }, async ({ peopleApi }) => {
      const original = buildPerson({ roles: ['NURSE'] });
      const duplicate = buildPerson({ cpf: original.cpf, roles: ['DOCTOR'] });
      let created!: Person;

      await test.step('Create the first person', async () => {
        created = await peopleApi.createPerson(original);
      });

      await test.step('Post a second person with the same CPF', async () => {
        const response = await peopleApi.create(duplicate);
        await expectApiError(response, HTTP_STATUS.DUPLICATE_CPF, /cpf/i);
      });

      await test.step('Exactly one record exists for the CPF and it is unchanged', async () => {
        const all = await peopleApi.listAll();
        expect(all.filter((person) => person.cpf === original.cpf)).toHaveLength(1);
        const persisted = await peopleApi.getPerson(created._id);
        expectPersonToMatchPayload(persisted, original);
      });
    });

    test('Rejects concurrent creations with the same CPF, persisting exactly one record', {
      tag: [...API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      const { cpf } = buildPerson();
      const attempts = 5;
      let statuses: number[] = [];

      await test.step('Fire simultaneous create requests sharing one CPF', async () => {
        const responses = await Promise.all(
          Array.from({ length: attempts }, () => peopleApi.create(buildPerson({ cpf }))),
        );
        statuses = responses.map((response) => response.status());
      });

      await test.step('Exactly one request succeeds and the others are rejected without server errors', async () => {
        const created = statuses.filter((status) => HTTP_STATUS.CREATED.includes(status as never));
        expect(created, `Statuses: ${statuses}`).toHaveLength(1);
        expect(statuses.every((status) => status < 500), `Statuses: ${statuses}`).toBe(true);
      });

      await test.step('Exactly one record exists for the CPF', async () => {
        const all = await peopleApi.listAll();
        expect(all.filter((person) => person.cpf === cpf)).toHaveLength(1);
      });
    });

    test('Rejects a malformed JSON body with a JSON error response', {
      tag: [...API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      await test.step('Post a syntactically invalid JSON document', async () => {
        const response = await peopleApi.createRaw('{"name": "Broken", "cpf": ');
        await expectApiError(response, HTTP_STATUS.MALFORMED_JSON);
      });
    });
  });
});
