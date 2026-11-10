import { test, expect, API_TAGS } from '../../../fixtures/api.fixture';
import { HTTP_STATUS } from '../../../helpers/expected-status';
import { expectStatus, readJson } from '../../../helpers/http';
import { expectApiError, expectPersonContract, expectPersonToMatchPayload } from '../../../assertions/api/people.assertions';
import { buildPerson, buildPersonWithCustomRoles } from '../../../payloads/person.payload';
import { Person, PersonPayload } from '../../../helpers/models/person';

test.describe('People API | Other role and custom roles', () => {
  test.describe('positive', () => {
    test('creates a person with the other role and a single custom role', {
      tag: [...API_TAGS, '@positive', '@smoke'],
    }, async ({ peopleApi }) => {
      const payload = buildPersonWithCustomRoles(['Receptionist']);

      await test.step('post a person holding the other role and one custom role', async () => {
        const created = await peopleApi.createPerson(payload);
        expectPersonContract(created);
        expectPersonToMatchPayload(created, payload);
      });
    });

    test('stores multiple custom roles as a plain string array on the person document', {
      tag: [...API_TAGS, '@positive'],
    }, async ({ peopleApi }) => {
      const customRoles = ['Physiotherapist', 'Receptionist', 'Chaplain'];
      const payload = buildPersonWithCustomRoles(customRoles);
      let created!: Person;

      await test.step('post a person with several custom roles', async () => {
        created = await peopleApi.createPerson(payload);
      });

      await test.step('persisted custom roles contain exactly the submitted strings', async () => {
        const persisted = await peopleApi.getPerson(created._id);
        expect(Array.isArray(persisted.custom_roles)).toBe(true);
        expect([...(persisted.custom_roles ?? [])].sort()).toEqual([...customRoles].sort());
        expect((persisted.custom_roles ?? []).every((value) => typeof value === 'string')).toBe(true);
      });
    });

    test('combines the other role with standard roles in a single record', {
      tag: [...API_TAGS, '@positive'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['DOCTOR', 'OTHER'], custom_roles: ['Physiotherapist', 'Receptionist'] });
      let created!: Person;

      await test.step('post a person holding the doctor and other roles', async () => {
        created = await peopleApi.createPerson(payload);
        expectPersonToMatchPayload(created, payload);
      });

      await test.step('a single record exists for the cpf', async () => {
        const all = await peopleApi.listAll();
        expect(all.filter((person) => person.cpf === payload.cpf)).toHaveLength(1);
      });
    });

    test('allows the same custom role name on different people', {
      tag: [...API_TAGS, '@positive'],
    }, async ({ peopleApi }) => {
      const sharedCustomRole = 'Volunteer';

      await test.step('create two people sharing one custom role name', async () => {
        const first = await peopleApi.createPerson(buildPersonWithCustomRoles([sharedCustomRole]));
        const second = await peopleApi.createPerson(buildPersonWithCustomRoles([sharedCustomRole]));
        expect(first._id).not.toBe(second._id);
        expect(first.custom_roles).toEqual([sharedCustomRole]);
        expect(second.custom_roles).toEqual([sharedCustomRole]);
      });
    });

    test('stores custom role names trimmed', {
      tag: [...API_TAGS, '@positive', '@edge'],
    }, async ({ peopleApi }) => {
      const payload = buildPersonWithCustomRoles(['  Physiotherapist  ']);

      await test.step('post a custom role surrounded by whitespace', async () => {
        const created = await peopleApi.createPerson(payload);
        expect(created.custom_roles).toEqual(['Physiotherapist']);
      });
    });

    test('accepts a large number of distinct custom roles', {
      tag: [...API_TAGS, '@positive', '@boundary'],
    }, async ({ peopleApi }) => {
      const customRoles = Array.from({ length: 20 }, (_, index) => `Custom Role ${index + 1}`);
      const payload = buildPersonWithCustomRoles(customRoles);

      await test.step('post a person with many custom roles', async () => {
        const created = await peopleApi.createPerson(payload);
        expect(created.custom_roles).toHaveLength(customRoles.length);
        expectPersonToMatchPayload(created, payload);
      });
    });
  });

  test.describe('negative', () => {
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
      test(`rejects the other role when ${label}`, {
        tag: [...API_TAGS, '@negative', '@boundary'],
      }, async ({ peopleApi }) => {
        const payload: Record<string, unknown> = { ...buildPerson({ roles: ['DOCTOR', 'OTHER'] }) };

        if (customRoles === undefined) {
          delete payload.custom_roles;
        } else {
          payload.custom_roles = customRoles;
        }

        await test.step(`post a person holding the other role where ${label}`, async () => {
          const response = await peopleApi.create(payload);
          await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR, message);
        });

        await test.step('no record is persisted for the cpf', async () => {
          await expectApiError(await peopleApi.findByCpf(String(payload.cpf)), HTTP_STATUS.NOT_FOUND);
        });
      });
    }

    test('never persists custom roles for a person without the other role', {
      tag: [...API_TAGS, '@negative', '@edge'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['NURSE'], custom_roles: ['Receptionist'] });

      await test.step('post a nurse that also sends custom roles', async () => {
        const response = await peopleApi.create(payload);
        // Rejecting the payload or discarding the values both satisfy the rule;
        // persisting custom roles without the other role does not.
        await expectStatus(response, [...HTTP_STATUS.CREATED, ...HTTP_STATUS.VALIDATION_ERROR]);

        if (HTTP_STATUS.CREATED.includes(response.status() as never)) {
          const created = await readJson<Person>(response);
          expect(created.custom_roles ?? [], 'custom roles must be empty without the other role').toEqual([]);
        }
      });

      await test.step('the persisted state, if any, carries no custom roles', async () => {
        const response = await peopleApi.findByCpf(payload.cpf);

        if (HTTP_STATUS.OK.includes(response.status() as never)) {
          const persisted = await readJson<Person>(response);
          expect(persisted.custom_roles ?? []).toEqual([]);
        } else {
          await expectApiError(response, HTTP_STATUS.NOT_FOUND);
        }
      });
    });

    test('rejects non-string custom role values', {
      tag: [...API_TAGS, '@negative', '@edge'],
    }, async ({ peopleApi }) => {
      const payload = {
        ...buildPerson({ roles: ['OTHER'] }),
        custom_roles: [{ name: 'Receptionist' }] as unknown as PersonPayload['custom_roles'],
      };

      await test.step('post custom roles containing an object instead of a string', async () => {
        const response = await peopleApi.create(payload);
        await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR);
      });
    });
  });
});
