import { test, expect, API_TAGS } from '../../../../fixtures/api.fixture'
import { HTTP_STATUS } from '../../helpers/expected-status';
import { expectStatus } from '../../helpers/http';
import { expectApiError, expectListNotToContain, expectListToContainOnce } from '../../assertions/people.assertions';
import { buildPerson, MALFORMED_PERSON_IDS, UNKNOWN_PERSON_ID } from '../../payloads/person.payload';
import { Person } from '../../helpers/models/person';

test.describe('People API | Delete person', () => {
  test.describe('positive', () => {
    test('deletes a person and removes it from every read endpoint', {
      tag: [...API_TAGS, '@positive', '@smoke'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('create a person holding the doctor and other roles', async () => {
        person = await peopleApi.createPerson(
          buildPerson({ roles: ['DOCTOR', 'OTHER'], custom_roles: ['Researcher'] }),
        );
      });

      await test.step('delete the person', async () => {
        const response = await peopleApi.delete(person._id);
        await expectStatus(response, HTTP_STATUS.DELETED);
      });

      await test.step('lookups by id and by cpf return not found', async () => {
        await expectApiError(await peopleApi.findById(person._id), HTTP_STATUS.NOT_FOUND);
        await expectApiError(await peopleApi.findByCpf(person.cpf), HTTP_STATUS.NOT_FOUND);
      });

      await test.step('person is absent from the full list and from each of its role lists', async () => {
        expectListNotToContain(await peopleApi.listAll(), person._id, 'people list');
        expectListNotToContain(await peopleApi.listByRole('DOCTOR'), person._id, 'role DOCTOR');
        expectListNotToContain(await peopleApi.listByRole('OTHER'), person._id, 'role OTHER');
      });
    });

    test('deleting one person does not affect other people', {
      tag: [...API_TAGS, '@positive'],
    }, async ({ peopleApi }) => {
      let removed!: Person;
      let kept!: Person;

      await test.step('create two patients', async () => {
        removed = await peopleApi.createPerson(buildPerson({ roles: ['PATIENT'] }));
        kept = await peopleApi.createPerson(buildPerson({ roles: ['PATIENT'] }));
      });

      await test.step('delete the first one', async () => {
        await expectStatus(await peopleApi.delete(removed._id), HTTP_STATUS.DELETED);
      });

      await test.step('the second one is still retrievable and listed', async () => {
        expect((await peopleApi.getPerson(kept._id)).cpf).toBe(kept.cpf);
        expectListToContainOnce(await peopleApi.listByRole('PATIENT'), kept._id, 'role PATIENT');
      });
    });

    test('allows the cpf of a deleted person to be registered again', {
      tag: [...API_TAGS, '@positive', '@edge'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['NURSE'] });
      let first!: Person;

      await test.step('create and delete a person', async () => {
        first = await peopleApi.createPerson(payload);
        await expectStatus(await peopleApi.delete(first._id), HTTP_STATUS.DELETED);
      });

      await test.step('create a new person with the same cpf', async () => {
        const second = await peopleApi.createPerson({ ...payload, name: `${payload.name} Again` });
        expect(second._id).not.toBe(first._id);
        expect(second.cpf).toBe(payload.cpf);
      });
    });
  });

  test.describe('negative', () => {
    test('returns not found when deleting the same person twice', {
      tag: [...API_TAGS, '@negative'],
    }, async ({ peopleApi }) => {
      let person!: Person;

      await test.step('create and delete a person', async () => {
        person = await peopleApi.createPerson(buildPerson());
        await expectStatus(await peopleApi.delete(person._id), HTTP_STATUS.DELETED);
      });

      await test.step('delete the same identifier again', async () => {
        await expectApiError(await peopleApi.delete(person._id), HTTP_STATUS.NOT_FOUND, /not found/i);
      });
    });

    test('returns not found with a message when deleting a person that does not exist', {
      tag: [...API_TAGS, '@negative'],
    }, async ({ peopleApi }) => {
      await test.step('delete a person by an unknown identifier', async () => {
        await expectApiError(await peopleApi.delete(UNKNOWN_PERSON_ID), HTTP_STATUS.NOT_FOUND, /not found/i);
      });
    });

    test('returns a client error when deleting with a malformed id', {
      tag: [...API_TAGS, '@negative', '@edge'],
    }, async ({ peopleApi }) => {
      await test.step('delete a person by a malformed identifier', async () => {
        await expectApiError(await peopleApi.delete(MALFORMED_PERSON_IDS[0]), HTTP_STATUS.MALFORMED_ID);
      });
    });
  });
});
