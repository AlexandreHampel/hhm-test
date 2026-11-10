import { test, expect, API_TAGS } from '../../../../fixtures/api.fixture';
import { HTTP_STATUS } from '../../helpers/expected-status';
import { expectStatus, readJson } from '../../helpers/http';
import { expectApiError, expectListToContainOnce, expectPersonContract, expectPersonToMatchPayload } from '../../assertions/people';
import { buildPerson, buildPersonWithCustomRoles } from '../../payloads/person';
import { generateCpf } from '../../helpers/cpf';
import { Person } from '../../helpers/models/person';

test.describe('People API | Read people', () => {
  test.describe('POSITIVE', () => {
    test('Lists all people including newly created ones', {
      tag: [...API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ peopleApi }) => {
      let doctor!: Person;
      let other!: Person;

      await test.step('Create people with different roles', async () => {
        doctor = await peopleApi.createPerson(buildPerson({ roles: ['DOCTOR'] }));
        other = await peopleApi.createPerson(buildPersonWithCustomRoles(['Receptionist']));
      });

      await test.step('The list returns an array with each person exactly once', async () => {
        const all = await peopleApi.listAll();
        expectListToContainOnce(all, doctor._id, 'People list');
        expectListToContainOnce(all, other._id, 'People list');
      });

      await test.step('Every listed record complies with the person data model', async () => {
        const all = await peopleApi.listAll();

        for (const person of all) {
          expectPersonContract(person);
        }
      });
    });

    test('Returns the person for an existing ID', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['NURSE', 'PATIENT'] });
      let created!: Person;

      await test.step('Create a person', async () => {
        created = await peopleApi.createPerson(payload);
      });

      await test.step('Get the person by ID', async () => {
        const response = await peopleApi.findById(created._id);
        await expectStatus(response, HTTP_STATUS.OK);
        const found = await readJson<Person>(response);
        expect(found._id).toBe(created._id);
        expectPersonToMatchPayload(found, payload);
      });
    });

    test('Returns the person for an existing CPF', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const payload = buildPerson({ roles: ['NURSING_TECHNICIAN'] });
      let created!: Person;

      await test.step('Create a person', async () => {
        created = await peopleApi.createPerson(payload);
      });

      await test.step('Get the person by CPF', async () => {
        const response = await peopleApi.findByCpf(payload.cpf);
        await expectStatus(response, HTTP_STATUS.OK);
        const found = await readJson<Person>(response);
        expect(found._id).toBe(created._id);
        expectPersonToMatchPayload(found, payload);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Returns not found with a message for a well-formed ID that does not exist', {
      tag: [...API_TAGS, '@NEGATIVE'],
    }, async ({ peopleApi }) => {
      await test.step('Get a person by an unknown identifier', async () => {
        const response = await peopleApi.findById('ffffffffffffffffffffffff');
        await expectApiError(response, HTTP_STATUS.NOT_FOUND, /not found/i);
      });
    });

    test('Returns a client error, not a server error, for a malformed ID', {
      tag: [...API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ peopleApi }) => {
      for (const malformedId of ['abc', 'not-an-object-id', 'zzzzzzzzzzzzzzzzzzzzzzzz']) {
        await test.step(`Get a person by the malformed identifier "${malformedId}"`, async () => {
          const response = await peopleApi.findById(malformedId);
          await expectApiError(response, HTTP_STATUS.MALFORMED_ID);
        });
      }
    });

    test('Returns not found with a message for an unknown CPF', {
      tag: [...API_TAGS, '@NEGATIVE'],
    }, async ({ peopleApi }) => {
      const unknownCpf = generateCpf();

      await test.step('Get a person by a CPF that was never registered', async () => {
        const response = await peopleApi.findByCpf(unknownCpf);
        await expectApiError(response, HTTP_STATUS.NOT_FOUND, /not found/i);
      });
    });
  });
});
