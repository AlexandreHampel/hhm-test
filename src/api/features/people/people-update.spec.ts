import { test, expect, API_TAGS } from '../../../../fixtures/api.fixture'
import { HTTP_STATUS } from '../../helpers/expected-status';
import { expectStatus, readJson } from '../../helpers/http';
import { expectApiError, expectListNotToContain, expectListToContainOnce, expectPersonContract, expectPersonToMatchPayload } from '../../assertions/people';
import { buildPerson, buildPersonWithCustomRoles, buildUpdatePayload, MALFORMED_PERSON_IDS, UNKNOWN_PERSON_ID } from '../../payloads/person';
import { Person, PersonPayload } from '../../helpers/models/person';

test.describe('People API | Update person', () => {
  test.describe('POSITIVE', () => {
    test('Updates personal data and refreshes the update timestamp while keeping identity', {
      tag: [...API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ peopleApi }) => {
      let original!: Person;
      let changes!: PersonPayload;
      let updated!: Person;

      await test.step('Create a person', async () => {
        original = await peopleApi.createPerson(buildPerson({ roles: ['PATIENT'] }));
      });

      await test.step('Update the name, birth date, email and phone', async () => {
        changes = buildUpdatePayload(original, {
          name: `${original.name} Updated`,
          birthDate: '1985-12-31',
          email: `updated.${original.cpf}@example.com`,
          phone: '48988887777',
        });
        const response = await peopleApi.update(original._id, changes);
        await expectStatus(response, HTTP_STATUS.OK);
        updated = await readJson<Person>(response);
      });

      await test.step('Response reflects the changes and keeps the identifier and creation timestamp', async () => {
        expectPersonContract(updated);
        expectPersonToMatchPayload(updated, changes);
        expect(updated._id).toBe(original._id);
        expect(updated.createdAt).toBe(original.createdAt);
        expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.updatedAt));
      });

      await test.step('Changes are persisted', async () => {
        const persisted = await peopleApi.getPerson(original._id);
        expectPersonToMatchPayload(persisted, changes);
      });
    });

    test('Adds a role to an existing person without creating a duplicate record', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create a nurse', async () => {
        person = await peopleApi.createPerson(buildPerson({ roles: ['NURSE'] }));
      });

      await test.step('Assign the PATIENT role to the same person', async () => {
        const response = await peopleApi.update(person._id, buildUpdatePayload(person, { roles: ['NURSE', 'PATIENT'] }));
        await expectStatus(response, HTTP_STATUS.OK);
        const updated = await readJson<Person>(response);
        expect([...updated.roles].sort()).toEqual(['NURSE', 'PATIENT']);
        expect(updated._id).toBe(person._id);
      });

      await test.step('A single record exists for the CPF and it appears under both roles', async () => {
        const all = await peopleApi.listAll();
        expect(all.filter((candidate) => candidate.cpf === person.cpf)).toHaveLength(1);
        expectListToContainOnce(await peopleApi.listByRole('NURSE'), person._id, 'Role NURSE');
        expectListToContainOnce(await peopleApi.listByRole('PATIENT'), person._id, 'Role PATIENT');
      });
    });

    test('Removes a role so the person no longer appears under it', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create a person holding the DOCTOR and PATIENT roles', async () => {
        person = await peopleApi.createPerson(buildPerson({ roles: ['DOCTOR', 'PATIENT'] }));
      });

      await test.step('Keep only the PATIENT role', async () => {
        const response = await peopleApi.update(person._id, buildUpdatePayload(person, { roles: ['PATIENT'] }));
        await expectStatus(response, HTTP_STATUS.OK);
      });

      await test.step('Person is listed under PATIENT but no longer under DOCTOR', async () => {
        expectListToContainOnce(await peopleApi.listByRole('PATIENT'), person._id, 'Role PATIENT');
        expectListNotToContain(await peopleApi.listByRole('DOCTOR'), person._id, 'Role DOCTOR');
      });
    });

    test('Assigns the OTHER role with custom roles to an existing person', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      let person!: Person;
      let changes!: PersonPayload;

      await test.step('Create a patient', async () => {
        person = await peopleApi.createPerson(buildPerson({ roles: ['PATIENT'] }));
      });

      await test.step('Assign the OTHER role with two custom roles', async () => {
        changes = buildUpdatePayload(person, { roles: ['PATIENT', 'OTHER'], custom_roles: ['Volunteer', 'Interpreter'] });
        const response = await peopleApi.update(person._id, changes);
        await expectStatus(response, HTTP_STATUS.OK);
      });

      await test.step('Custom roles are persisted and the person is listed under the OTHER role', async () => {
        expectPersonToMatchPayload(await peopleApi.getPerson(person._id), changes);
        expectListToContainOnce(await peopleApi.listByRole('OTHER'), person._id, 'Role OTHER');
      });
    });

    test('Replaces the list of custom roles, adding and removing entries', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create a person holding the OTHER role with two custom roles', async () => {
        person = await peopleApi.createPerson(buildPersonWithCustomRoles(['Volunteer', 'Interpreter']));
      });

      await test.step('Submit a different set of custom roles', async () => {
        const response = await peopleApi.update(
          person._id,
          buildUpdatePayload(person, { custom_roles: ['Interpreter', 'Chaplain'] }),
        );
        await expectStatus(response, HTTP_STATUS.OK);
      });

      await test.step('Persisted custom roles equal the new list', async () => {
        const persisted = await peopleApi.getPerson(person._id);
        expect([...(persisted.custom_roles ?? [])].sort()).toEqual(['Chaplain', 'Interpreter']);
      });
    });

    test('Clears custom roles when the OTHER role is removed', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create a person holding the DOCTOR and OTHER roles', async () => {
        person = await peopleApi.createPerson(
          buildPerson({ roles: ['DOCTOR', 'OTHER'], custom_roles: ['Physiotherapist', 'Receptionist'] }),
        );
      });

      await test.step('Keep only the DOCTOR role and omit the custom roles', async () => {
        const payload: Partial<PersonPayload> = buildUpdatePayload(person, { roles: ['DOCTOR'] });
        delete payload.custom_roles;
        const response = await peopleApi.update(person._id, payload);
        await expectStatus(response, HTTP_STATUS.OK);
        const updated = await readJson<Person>(response);
        expect(updated.custom_roles ?? []).toEqual([]);
      });

      await test.step('Persisted custom roles are empty and the person is no longer listed under the OTHER role', async () => {
        const persisted = await peopleApi.getPerson(person._id);
        expect(persisted.roles).toEqual(['DOCTOR']);
        expect(persisted.custom_roles ?? []).toEqual([]);
        expectListNotToContain(await peopleApi.listByRole('OTHER'), person._id, 'Role OTHER');
      });
    });

    test('Does not keep stale custom roles when the OTHER role is removed but custom roles are still sent', {
      tag: [...API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create a person holding the NURSE and OTHER roles', async () => {
        person = await peopleApi.createPerson(
          buildPerson({ roles: ['NURSE', 'OTHER'], custom_roles: ['Receptionist'] }),
        );
      });

      await test.step('Keep only the NURSE role while still sending the previous custom roles', async () => {
        const response = await peopleApi.update(person._id, buildUpdatePayload(person, { roles: ['NURSE'] }));
        // Rejecting the inconsistent payload or clearing the values are both acceptable.
        await expectStatus(response, [...HTTP_STATUS.OK, ...HTTP_STATUS.VALIDATION_ERROR]);
      });

      await test.step('Persisted record never holds custom roles without the OTHER role', async () => {
        const persisted = await peopleApi.getPerson(person._id);
        expectPersonContract(persisted);
      });
    });

    test('Accepts keeping the own CPF of the person, which is not reported as duplicate', {
      tag: [...API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create a person', async () => {
        person = await peopleApi.createPerson(buildPerson({ roles: ['PATIENT'] }));
      });

      await test.step('Submit the same CPF with a new name', async () => {
        const response = await peopleApi.update(person._id, buildUpdatePayload(person, { name: `${person.name} Jr.` }));
        await expectStatus(response, HTTP_STATUS.OK);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Rejects changing the CPF to one that belongs to another person', {
      tag: [...API_TAGS, '@NEGATIVE'],
    }, async ({ peopleApi }) => {
      let first!: Person;
      let second!: Person;

      await test.step('Create two people', async () => {
        first = await peopleApi.createPerson(buildPerson({ roles: ['DOCTOR'] }));
        second = await peopleApi.createPerson(buildPerson({ roles: ['NURSE'] }));
      });

      await test.step('Submit the CPF of the first person on the second one', async () => {
        const response = await peopleApi.update(second._id, buildUpdatePayload(second, { cpf: first.cpf }));
        await expectApiError(response, HTTP_STATUS.DUPLICATE_CPF, /cpf/i);
      });

      await test.step('Both records keep their original CPF', async () => {
        expect((await peopleApi.getPerson(first._id)).cpf).toBe(first.cpf);
        expect((await peopleApi.getPerson(second._id)).cpf).toBe(second.cpf);
      });
    });

    const invalidChanges: Array<{ label: string; changes: Record<string, unknown>; message?: RegExp }> = [
      { label: 'an empty roles array', changes: { roles: [] }, message: /role/i },
      { label: 'an unsupported role', changes: { roles: ['SURGEON'] }, message: /role/i },
      { label: 'the OTHER role without custom roles', changes: { roles: ['OTHER'], custom_roles: [] }, message: /custom/i },
      { label: 'the OTHER role with a blank custom role', changes: { roles: ['OTHER'], custom_roles: ['  '] }, message: /custom|blank|empty/i },
      { label: 'the OTHER role with duplicate custom roles', changes: { roles: ['OTHER'], custom_roles: ['Volunteer', 'Volunteer'] }, message: /duplicate|unique/i },
      { label: 'a blank name', changes: { name: '   ' } },
      { label: 'an empty CPF', changes: { cpf: '' } },
      { label: 'an unparseable birth date', changes: { birthDate: 'not-a-date' } },
    ];

    for (const { label, changes, message } of invalidChanges) {
      test(`Rejects an update with ${label} and leaves the record unchanged`, {
        tag: [...API_TAGS, '@NEGATIVE'],
      }, async ({ peopleApi }) => {
        let person!: Person;

        await test.step('Create a valid doctor', async () => {
          person = await peopleApi.createPerson(buildPerson({ roles: ['DOCTOR'] }));
        });

        await test.step(`Submit an update with ${label}`, async () => {
          const response = await peopleApi.update(person._id, { ...buildUpdatePayload(person), ...changes });
          await expectApiError(response, HTTP_STATUS.VALIDATION_ERROR, message);
        });

        await test.step('Persisted record is unchanged', async () => {
          const persisted = await peopleApi.getPerson(person._id);
          expectPersonToMatchPayload(persisted, buildUpdatePayload(person));
        });
      });
    }

    test('Returns not found with a message when updating a person that does not exist', {
      tag: [...API_TAGS, '@NEGATIVE'],
    }, async ({ peopleApi }) => {
      await test.step('Update a person by an unknown identifier', async () => {
        const response = await peopleApi.update(UNKNOWN_PERSON_ID, buildPerson());
        await expectApiError(response, HTTP_STATUS.NOT_FOUND, /not found/i);
      });
    });

    test('Returns a client error when updating with a malformed ID', {
      tag: [...API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      await test.step('Update a person by a malformed identifier', async () => {
        const response = await peopleApi.update(MALFORMED_PERSON_IDS[0], buildPerson());
        await expectApiError(response, HTTP_STATUS.MALFORMED_ID);
      });
    });
  });
});
