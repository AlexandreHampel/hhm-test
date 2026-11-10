import { test, expect, API_TAGS } from '../../../fixtures/api.fixture';
import { HTTP_STATUS } from '../../../helpers/expected-status';
import { expectStatus } from '../../../helpers/http';
import { expectApiError, expectListNotToContain, expectListToContainOnce } from '../../../assertions/api/people.assertions';
import { buildPerson, MALFORMED_PERSON_IDS, UNKNOWN_PERSON_ID } from '../../../payloads/person.payload';
import { Person } from '../../../helpers/models/person';

test.describe('People API | Delete person', () => {
  test.describe('POSITIVE', () => {
    test('Deletes a person and removes it from every read endpoint', {
      tag: [...API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create a person holding the DOCTOR and OTHER roles', async () => {
        person = await peopleApi.createPerson(
          buildPerson({ roles: ['DOCTOR', 'OTHER'], custom_roles: ['Researcher'] }),
        );
      });

      await test.step('Delete the person', async () => {
        const response = await peopleApi.delete(person._id);
        await expectStatus(response, HTTP_STATUS.DELETED);
      });

      await test.step('Lookups by ID and by CPF return not found', async () => {
        await expectApiError(await peopleApi.findById(person._id), HTTP_STATUS.NOT_FOUND);
        await expectApiError(await peopleApi.findByCpf(person.cpf), HTTP_STATUS.NOT_FOUND);
      });

      await test.step('Person is absent from the full list and from each of its role lists', async () => {
        expectListNotToContain(await peopleApi.listAll(), person._id, 'People list');
        expectListNotToContain(await peopleApi.listByRole('DOCTOR'), person._id, 'Role DOCTOR');
        expectListNotToContain(await peopleApi.listByRole('OTHER'), person._id, 'Role OTHER');
      });
    });

    test('Deleting one person does not affect other people', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      let removed!: Person;
      let kept!: Person;

      await test.step('Create two patients', async () => {
        removed = await peopleApi.createPerson(buildPerson({ roles: ['PATIENT'] }));
        kept = await peopleApi.createPerson(buildPerson({ roles: ['PATIENT'] }));
      });

      await test.step('Delete the first one', async () => {
        await expectStatus(await peopleApi.delete(removed._id), HTTP_STATUS.DELETED);
      });

      await test.step('The second one is still retrievable and listed', async () => {
        expect((await peopleApi.getPerson(kept._id)).cpf).toBe(kept.cpf);
        expectListToContainOnce(await peopleApi.listByRole('PATIENT'), kept._id, 'Role PATIENT');
      });
    });

    test('Allows the CPF of a deleted person to be registered again', {
      tag: [...API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['NURSE'] });
      let first!: Person;

      await test.step('Create and delete a person', async () => {
        first = await peopleApi.createPerson(payload);
        await expectStatus(await peopleApi.delete(first._id), HTTP_STATUS.DELETED);
      });

      await test.step('Create a new person with the same CPF', async () => {
        const second = await peopleApi.createPerson({ ...payload, name: `${payload.name} Again` });
        expect(second._id).not.toBe(first._id);
        expect(second.cpf).toBe(payload.cpf);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Returns not found when deleting the same person twice', {
      tag: [...API_TAGS, '@NEGATIVE'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('Create and delete a person', async () => {
        person = await peopleApi.createPerson(buildPerson());
        await expectStatus(await peopleApi.delete(person._id), HTTP_STATUS.DELETED);
      });

      await test.step('Delete the same identifier again', async () => {
        await expectApiError(await peopleApi.delete(person._id), HTTP_STATUS.NOT_FOUND, /not found/i);
      });
    });

    test('Returns not found with a message when deleting a person that does not exist', {
      tag: [...API_TAGS, '@NEGATIVE'],
    }, async ({ peopleApi }) => {
      await test.step('Delete a person by an unknown identifier', async () => {
        await expectApiError(await peopleApi.delete(UNKNOWN_PERSON_ID), HTTP_STATUS.NOT_FOUND, /not found/i);
      });
    });

    test('Returns a client error when deleting with a malformed ID', {
      tag: [...API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      await test.step('Delete a person by a malformed identifier', async () => {
        await expectApiError(await peopleApi.delete(MALFORMED_PERSON_IDS[0]), HTTP_STATUS.MALFORMED_ID);
      });
    });
  });
});
