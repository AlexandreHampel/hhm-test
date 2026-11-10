import { test, expect, API_TAGS } from '../../../../fixtures/api.fixture';
import { HTTP_STATUS } from '../../helpers/expected-status';
import { expectStatus, readJson } from '../../helpers/http';
import { expectApiError, expectPersonContract, expectPersonToMatchPayload } from '../../assertions/people';
import { buildPerson, buildPersonWithCustomRoles } from '../../payloads/person';
import { Person, PersonPayload } from '../../helpers/models/person';

test.describe('People API | OTHER role and custom roles', () => {
  test.describe('POSITIVE', () => {
    test('Creates a person with the OTHER role and a single custom role', {
      tag: [...API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ peopleApi }) => {
      const payload = buildPersonWithCustomRoles(['Receptionist']);

      await test.step('Post a person holding the OTHER role and one custom role', async () => {
        const created = await peopleApi.createPerson(payload);
        expectPersonContract(created);
        expectPersonToMatchPayload(created, payload);
      });
    });

    test('Stores multiple custom roles as a plain string array on the person document', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const customRoles = ['Physiotherapist', 'Receptionist', 'Chaplain'];
      const payload = buildPersonWithCustomRoles(customRoles);
      let created!: Person;

      await test.step('Post a person with several custom roles', async () => {
        created = await peopleApi.createPerson(payload);
      });

      await test.step('Persisted custom roles contain exactly the submitted strings', async () => {
        const persisted = await peopleApi.getPerson(created._id);
        expect(Array.isArray(persisted.custom_roles)).toBe(true);
        expect([...(persisted.custom_roles ?? [])].sort()).toEqual([...customRoles].sort());
        expect((persisted.custom_roles ?? []).every((value) => typeof value === 'string')).toBe(true);
      });
    });

    test('Combines the OTHER role with standard roles in a single record', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['DOCTOR', 'OTHER'], custom_roles: ['Physiotherapist', 'Receptionist'] });
      let created!: Person;

      await test.step('Post a person holding the DOCTOR and OTHER roles', async () => {
        created = await peopleApi.createPerson(payload);
        expectPersonToMatchPayload(created, payload);
      });

      await test.step('A single record exists for the CPF', async () => {
        const all = await peopleApi.listAll();
        expect(all.filter((person) => person.cpf === payload.cpf)).toHaveLength(1);
      });
    });

    test('Allows the same custom role name on different people', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const sharedCustomRole = 'Volunteer';

      await test.step('Create two people sharing one custom role name', async () => {
        const first = await peopleApi.createPerson(buildPersonWithCustomRoles([sharedCustomRole]));
        const second = await peopleApi.createPerson(buildPersonWithCustomRoles([sharedCustomRole]));
        expect(first._id).not.toBe(second._id);
        expect(first.custom_roles).toEqual([sharedCustomRole]);
        expect(second.custom_roles).toEqual([sharedCustomRole]);
      });
    });

    test('Stores custom role names trimmed', {
      tag: [...API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      const payload = buildPersonWithCustomRoles(['  Physiotherapist  ']);

      await test.step('Post a custom role surrounded by whitespace', async () => {
        const created = await peopleApi.createPerson(payload);
        expect(created.custom_roles).toEqual(['Physiotherapist']);
      });
    });

    test('Accepts a large number of distinct custom roles', {
      tag: [...API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ peopleApi }) => {
      const customRoles = Array.from({ length: 20 }, (_, index) => `Custom Role ${index + 1}`);
      const payload = buildPersonWithCustomRoles(customRoles);

      await test.step('Post a person with many custom roles', async () => {
        const created = await peopleApi.createPerson(payload);
        expect(created.custom_roles).toHaveLength(customRoles.length);
        expectPersonToMatchPayload(created, payload);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    const invalidCustomRoles: Array<{ customRoles: unknown; label: string; message: RegExp }> = [
      { customRoles: undefined, label: 'custom roles are absent', message: /custom/i },
      { customRoles: [], label: 'custom roles are an empty array', message: /custom/i },
      { customRoles: [''], label: 'the only custom role is an empty string', message: /custom|blank|empty/i },
      { customRoles: ['   '], label: 'the only custom role is whitespace', message: /custom|blank|empty/i },
      { customRoles: ['Physiotherapist', ''], label: 'one custom role entry is blank', message: /custom|blank|empty/i },
      { customRoles: ['Physiotherapist', 'Physiotherapist'], label: 'custom roles contain duplicates', message: /duplicate|unique/i },
      { customRoles: ['Physiotherapist', '  Physiotherapist '], label: 'custom roles are duplicates after trimming', message: /duplicate|unique/i },
    ];

    for (const { customRoles, label, message } of invalidCustomRoles) {
      test(`Rejects the OTHER role when ${label}`, {
        tag: [...API_TAGS, '@NEGATIVE', '@BOUNDARY'],
      }, async ({ peopleApi }) => {
        const payload: Record<string, unknown> = { ...buildPerson({ roles: ['DOCTOR', 'OTHER'] }) };

        if (customRoles === undefined) {
          delete payload.custom_roles;
        } else {
          payload.custom_roles = customRoles;
        }

        await test.step(`Post a person holding the OTHER role where ${label}`, async () => {
          const response = await peopleApi.create(payload);
          await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR, message);
        });

        await test.step('No record is persisted for the CPF', async () => {
          await expectApiError(await peopleApi.findByCpf(String(payload.cpf)), HTTP_STATUS.NOT_FOUND);
        });
      });
    }

    test('Never persists custom roles for a person without the OTHER role', {
      tag: [...API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['NURSE'], custom_roles: ['Receptionist'] });

      await test.step('Post a nurse that also sends custom roles', async () => {
        const response = await peopleApi.create(payload);
        // Rejecting the payload or discarding the values both satisfy the rule;
        // persisting custom roles without the OTHER role does not.
        await expectStatus(response, [...HTTP_STATUS.CREATED, ...HTTP_STATUS.VALIDATION_ERROR]);

        if (HTTP_STATUS.CREATED.includes(response.status() as never)) {
          const created = await readJson<Person>(response);
          expect(created.custom_roles ?? [], 'Custom roles must be empty without the OTHER role').toEqual([]);
        }
      });

      await test.step('The persisted state, if any, carries no custom roles', async () => {
        const response = await peopleApi.findByCpf(payload.cpf);

        if (HTTP_STATUS.OK.includes(response.status() as never)) {
          const persisted = await readJson<Person>(response);
          expect(persisted.custom_roles ?? []).toEqual([]);
        } else {
          await expectApiError(response, HTTP_STATUS.NOT_FOUND);
        }
      });
    });

    test('Rejects non-string custom role values', {
      tag: [...API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      const payload = {
        ...buildPerson({ roles: ['OTHER'] }),
        custom_roles: [{ name: 'Receptionist' }] as unknown as PersonPayload['custom_roles'],
      };

      await test.step('Post custom roles containing an object instead of a string', async () => {
        const response = await peopleApi.create(payload);
        await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR);
      });
    });
  });
});
