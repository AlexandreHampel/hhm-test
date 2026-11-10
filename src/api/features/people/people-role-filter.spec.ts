import { test, expect, API_TAGS } from '../../../../fixtures/api.fixture'
import { HTTP_STATUS } from '../../helpers/expected-status';
import { expectApiError, expectListNotToContain, expectListToContainOnce, expectPersonContract } from '../../assertions/people.assertions';
import { buildPerson, buildPersonWithCustomRoles } from '../../payloads/person.payload';
import { Person, PersonPayload, STANDARD_ROLES, SUPPORTED_ROLES } from '../../helpers/models/person';

test.describe('People API | Filter people by role', () => {
  test.describe('POSITIVE', () => {
    for (const role of SUPPORTED_ROLES) {
      test(`Lists only people holding ${role}`, {
        tag: [...API_TAGS, '@POSITIVE'],
      }, async ({ peopleApi }) => {
        const payload: PersonPayload = role === 'OTHER'
          ? buildPersonWithCustomRoles(['Receptionist'])
          : buildPerson({ roles: [role] });
        const outsiderRole = STANDARD_ROLES.find((candidate) => candidate !== role)!;
        let member!: Person;
        let outsider!: Person;

        await test.step(`Create a person holding ${role} and another one without it`, async () => {
          member = await peopleApi.createPerson(payload);
          outsider = await peopleApi.createPerson(buildPerson({ roles: [outsiderRole] }));
        });

        await test.step(`The ${role} filter includes the matching person exactly once`, async () => {
          const people = await peopleApi.listByRole(role);
          expectListToContainOnce(people, member._id, `Role ${role}`);
          expectListNotToContain(people, outsider._id, `Role ${role}`);
        });

        await test.step(`Every returned person holds ${role}`, async () => {
          const people = await peopleApi.listByRole(role);

          for (const person of people) {
            expectPersonContract(person);
            expect(person.roles, `Person ${person._id} listed under ${role}`).toContain(role);
          }
        });
      });
    }

    test('Lists a person with multiple roles under each of their roles only', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      const assignedRoles = ['DOCTOR', 'NURSE', 'OTHER'] as const;
      let person!: Person;

      await test.step('Create a person holding the DOCTOR, NURSE and OTHER roles', async () => {
        person = await peopleApi.createPerson(
          buildPerson({ roles: [...assignedRoles], custom_roles: ['Researcher'] }),
        );
      });

      for (const role of SUPPORTED_ROLES) {
        const assigned = (assignedRoles as readonly string[]).includes(role);

        await test.step(`${assigned ? 'Listed' : 'Not listed'} under ${role}`, async () => {
          const people = await peopleApi.listByRole(role);

          if (assigned) {
            expectListToContainOnce(people, person._id, `Role ${role}`);
          } else {
            expectListNotToContain(people, person._id, `Role ${role}`);
          }
        });
      }
    });

    test('The OTHER filter returns people regardless of custom role name and exposes all custom roles', {
      tag: [...API_TAGS, '@POSITIVE'],
    }, async ({ peopleApi }) => {
      let receptionist!: Person;
      let multiCustom!: Person;

      await test.step('Create people holding the OTHER role with different custom role names', async () => {
        receptionist = await peopleApi.createPerson(buildPersonWithCustomRoles(['Receptionist']));
        multiCustom = await peopleApi.createPerson(
          buildPerson({ roles: ['PATIENT', 'OTHER'], custom_roles: ['Physiotherapist', 'Chaplain'] }),
        );
      });

      await test.step('The OTHER filter lists both with their full custom roles array', async () => {
        const people = await peopleApi.listByRole('OTHER');
        expectListToContainOnce(people, receptionist._id, 'Role OTHER');
        expectListToContainOnce(people, multiCustom._id, 'Role OTHER');

        const listedMulti = people.find((person) => person._id === multiCustom._id)!;
        expect([...(listedMulti.custom_roles ?? [])].sort()).toEqual(['Chaplain', 'Physiotherapist']);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    for (const role of ['SURGEON', 'Physiotherapist', 'RECEPTIONIST']) {
      test(`Rejects filtering by the unsupported role "${role}"`, {
        tag: [...API_TAGS, '@NEGATIVE'],
      }, async ({ peopleApi }) => {
        await test.step(`Filter people by "${role}"`, async () => {
          const response = await peopleApi.findByRole(role);
          await expectApiError(response, HTTP_STATUS.UNSUPPORTED_ROLE_FILTER, /role/i);
        });
      });
    }
  });
});
