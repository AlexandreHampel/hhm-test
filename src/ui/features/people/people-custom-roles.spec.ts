import { test, expect, UI_TAGS } from '../../../../fixtures/ui.fixture';
import { expectedRowFor } from '../../helpers/format';
import { Check, Uncheck } from '../../interactions/check';
import { Enter } from '../../interactions/enter';
import { IsDisplayed, TextOf } from '../../questions/generic';
import { CheckedRoles, CustomRoleIds, CustomRoleValues, IdOfListedPerson, PersonFormValues, PersonRow } from '../../questions/people';
import { ask, askUntilPresent, perform } from '../../screenplay/core';
import { PersonForm } from '../../targets/people';
import { StartEditingPerson } from '../../tasks/edition';
import { OpenGeneralRegistration } from '../../tasks/navigation';
import { FindPerson, SelectRole } from '../../tasks/people-list';
import { AddACustomRoleInput, AcknowledgeTheSuccessMessage, EnterTheCustomRoles, FillThePersonForm, RemoveTheCustomRoleInput, SaveThePerson, StartAddingAPerson, SubmitThePersonForm } from '../../tasks/person-form';
import { buildPersonForm } from '../../payloads/person';
import { Role } from '../../helpers/models';

/** Opens the add form with the given role preselected. */
const StartAddingAPersonAs = (role: Role) => [OpenGeneralRegistration(), SelectRole.named(role), StartAddingAPerson()];

test.describe('People UI | Custom roles', () => {
  test.describe('POSITIVE', () => {
    test('Shows the custom roles group only while OTHER is checked', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, ...StartAddingAPersonAs('DOCTOR'));

      await test.step('No custom role group is shown for DOCTOR', async () => {
        expect(await ask(page, IsDisplayed.the(PersonForm.CUSTOM_ROLES_GROUP))).toBe(false);
      });

      await perform(page, Check.the(PersonForm.roleCheckbox('OTHER')));

      await test.step('Checking OTHER shows the group with one empty input', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PersonForm.CUSTOM_ROLES_GROUP))).toBe(true);
        await expect.poll(() => ask(page, CustomRoleValues())).toEqual(['']);
      });

      await perform(page, Uncheck.the(PersonForm.roleCheckbox('OTHER')));

      await test.step('Unchecking OTHER hides the group again', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PersonForm.CUSTOM_ROLES_GROUP))).toBe(false);
      });
    });

    test('Starts again with one empty input when OTHER is checked a second time', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      await perform(
        page,
        ...StartAddingAPersonAs('DOCTOR'),
        Check.the(PersonForm.roleCheckbox('OTHER')),
        EnterTheCustomRoles.named(['Volunteer', 'Chaplain']),
        Uncheck.the(PersonForm.roleCheckbox('OTHER')),
        Check.the(PersonForm.roleCheckbox('OTHER')),
      );

      await test.step('A single empty input is offered instead of the stale values', async () => {
        await expect.poll(() => ask(page, CustomRoleValues())).toEqual(['']);
      });
    });

    test('Saves a person after OTHER was checked and unchecked again', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR'] });

      await perform(
        page,
        ...StartAddingAPersonAs('DOCTOR'),
        Check.the(PersonForm.roleCheckbox('OTHER')),
        Uncheck.the(PersonForm.roleCheckbox('OTHER')),
        FillThePersonForm.with(data),
        SaveThePerson(),
      );

      await test.step('The person is created without custom roles', async () => {
        await perform(page, AcknowledgeTheSuccessMessage(), FindPerson.withCpf(data.cpf).under('DOCTOR'));
        const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(data));
      });
    });

    test('Keeps custom role test IDs stable while inputs are added and removed', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, ...StartAddingAPersonAs('OTHER'), AddACustomRoleInput(), AddACustomRoleInput());
      const [firstId, secondId, thirdId] = await ask(page, CustomRoleIds());

      await test.step('Every input has its own ID', async () => {
        expect(new Set([firstId, secondId, thirdId]).size).toBe(3);
      });

      await perform(
        page,
        Enter.theValue('Volunteer').into(PersonForm.customRoleInput(firstId)),
        Enter.theValue('Interpreter').into(PersonForm.customRoleInput(secondId)),
        Enter.theValue('Chaplain').into(PersonForm.customRoleInput(thirdId)),
        RemoveTheCustomRoleInput.withId(secondId),
      );

      await test.step('Removing the middle input keeps the IDs and values of the others', async () => {
        expect(await ask(page, CustomRoleIds())).toEqual([firstId, thirdId]);
        expect(await ask(page, CustomRoleValues())).toEqual(['Volunteer', 'Chaplain']);
      });

      await perform(page, AddACustomRoleInput());

      await test.step('A new input never reuses an existing or removed ID', async () => {
        const ids = await ask(page, CustomRoleIds());
        const [newId] = ids.filter((id) => ![firstId, thirdId].includes(id));
        expect([firstId, secondId, thirdId]).not.toContain(newId);
        expect(new Set(ids).size, `Custom role IDs must be unique: ${ids}`).toBe(ids.length);
      });
    });

    test('Keeps the other entered values while custom role inputs are added and removed', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR', 'OTHER'], customRoles: ['Researcher'] });

      await perform(page, ...StartAddingAPersonAs('OTHER'), FillThePersonForm.with(data), AddACustomRoleInput());
      const addedId = (await ask(page, CustomRoleIds())).at(-1)!;
      await perform(page, Enter.theValue('Temporary').into(PersonForm.customRoleInput(addedId)), RemoveTheCustomRoleInput.withId(addedId), AddACustomRoleInput());

      await test.step('Every other field keeps its value', async () => {
        expect(await ask(page, PersonFormValues())).toEqual({ name: data.name, cpf: data.cpf, birthDate: data.birthDate, email: data.email, phone: data.phone });
        expect(await ask(page, CheckedRoles())).toEqual(['DOCTOR', 'OTHER']);
        expect((await ask(page, CustomRoleValues()))[0]).toBe('Researcher');
      });
    });

    test('Creates a person with several custom roles and lists it under OTHER', {
      tag: [...UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR', 'OTHER'], customRoles: ['Physiotherapist', 'Receptionist', 'Chaplain'] });

      await perform(
        page,
        OpenGeneralRegistration(),
        FindPerson.withCpf(data.cpf).under('OTHER'),
        StartAddingAPerson(),
        FillThePersonForm.with(data),
        SaveThePerson(),
        AcknowledgeTheSuccessMessage(),
      );

      await test.step('The refreshed list shows all custom roles', async () => {
        const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(data));
      });

      await test.step('The stored record holds every custom role', async () => {
        const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await perform(page, StartEditingPerson.withId(personId));
        expect(await ask(page, CustomRoleValues())).toEqual(data.customRoles);
      });
    });

    test('Trims custom role names before saving', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['OTHER'], customRoles: ['   Chaplain   '] });

      await perform(page, ...StartAddingAPersonAs('OTHER'), FillThePersonForm.with(data), SaveThePerson(), AcknowledgeTheSuccessMessage(), FindPerson.withCpf(data.cpf).under('OTHER'));

      await test.step('The custom role is stored without the spaces', async () => {
        const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await perform(page, StartEditingPerson.withId(personId));
        expect(await ask(page, CustomRoleValues())).toEqual(['Chaplain']);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Requires a custom role while OTHER is checked', {
      tag: [...UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      await perform(page, ...StartAddingAPersonAs('OTHER'), FillThePersonForm.with(buildPersonForm({ roles: ['OTHER'], customRoles: ['Placeholder'] })));
      const [onlyId] = await ask(page, CustomRoleIds());
      await perform(page, RemoveTheCustomRoleInput.withId(onlyId), SubmitThePersonForm());

      await test.step('The missing custom role message is shown and the form stays open', async () => {
        await expect.poll(() => ask(page, TextOf.the(PersonForm.CUSTOM_ROLES_REQUIRED_ERROR))).toBe('Add at least one custom role for the Other role.');
        expect(await ask(page, IsDisplayed.the(PersonForm.SUMMARY_ERROR))).toBe(true);
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
      });
    });

    for (const blank of ['', '   ']) {
      test(`Rejects a custom role that is ${blank ? 'whitespace only' : 'empty'}`, {
        tag: [...UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
      }, async ({ page }) => {
        await perform(page, ...StartAddingAPersonAs('OTHER'), FillThePersonForm.with(buildPersonForm({ roles: ['OTHER'], customRoles: ['Volunteer', blank] })), SubmitThePersonForm());

        await test.step('The blank input is flagged and the form stays open', async () => {
          const [, blankId] = await ask(page, CustomRoleIds());
          await expect.poll(() => ask(page, TextOf.the(PersonForm.customRoleError(blankId)))).toBe('Custom role cannot be blank.');
          expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
        });
      });
    }

    for (const duplicates of [['Volunteer', 'Volunteer'], ['Volunteer', 'VOLUNTEER'], ['Volunteer', '  volunteer ']]) {
      test(`Rejects duplicate custom roles ${JSON.stringify(duplicates)}`, {
        tag: [...UI_TAGS, '@NEGATIVE', '@EDGE'],
      }, async ({ page }) => {
        await perform(page, ...StartAddingAPersonAs('OTHER'), FillThePersonForm.with(buildPersonForm({ roles: ['OTHER'], customRoles: duplicates })), SubmitThePersonForm());

        await test.step('The duplicate message is shown and the form stays open', async () => {
          await expect.poll(() => ask(page, TextOf.the(PersonForm.CUSTOM_ROLES_DUPLICATE_ERROR))).toBe('Custom roles must be unique.');
          expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
        });
      });
    }
  });
});
