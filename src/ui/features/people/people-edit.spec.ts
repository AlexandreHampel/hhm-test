import { Page } from '@playwright/test';
import { test, expect, UI_TAGS } from '../../../../fixtures/ui.fixture';
import { expectedRowFor } from '../../helpers/format';
import { PersonFormData, Role } from '../../helpers/models';
import { Check, Uncheck } from '../../interactions/check';
import { Click } from '../../interactions/click';
import { Clear, Enter } from '../../interactions/enter';
import { Network } from '../../interactions/network';
import { IsDisplayed, NumberOf, TextOf } from '../../questions/generic';
import { CheckedRoles, CustomRoleIds, CustomRoleValues, IdOfListedPerson, PersonFormValues, PersonRow, ValidationMessage } from '../../questions/people';
import { ask, askUntilPresent, perform } from '../../screenplay/core';
import { ErrorMessage, PeopleList, PersonForm, SuccessMessage } from '../../targets/people';
import { DeletePerson } from '../../tasks/deletion';
import { StartEditingPerson } from '../../tasks/edition';
import { OpenGeneralRegistration } from '../../tasks/navigation';
import { FindPerson, SelectPerson, SelectRole } from '../../tasks/people-list';
import { AcknowledgeTheErrorMessage, AcknowledgeTheSuccessMessage, AddACustomRoleInput, CancelThePersonForm, FillThePersonForm, RemoveTheCustomRoleInput, SaveThePerson, SubmitThePersonForm } from '../../tasks/person-form';
import { RegisterPerson } from '../../tasks/registration';
import { buildPersonForm } from '../../payloads/person';

/** Registers a person through the form and lists it under the role, returning its ID. */
async function registerAndFind(page: Page, data: PersonFormData, role: Role = data.roles[0]): Promise<string> {
  await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under(role));

  return askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
}

test.describe('People UI | Edit person', () => {
  test.describe('POSITIVE', () => {
    test('Loads the selected person into the form', {
      tag: [...UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR', 'OTHER'], customRoles: ['Researcher', 'Lecturer'] });
      const personId = await registerAndFind(page, data);

      await perform(page, StartEditingPerson.withId(personId));

      await test.step('The form is titled Edit Person and shows the stored data', async () => {
        await expect.poll(() => ask(page, TextOf.the(PersonForm.TITLE))).toBe('Edit Person');
        expect(await ask(page, PersonFormValues())).toEqual({ name: data.name, cpf: data.cpf, birthDate: data.birthDate, email: data.email, phone: data.phone });
        expect(await ask(page, CheckedRoles())).toEqual(['DOCTOR', 'OTHER']);
        expect(await ask(page, CustomRoleValues())).toEqual(['Researcher', 'Lecturer']);
      });
    });

    test('Updates personal data and refreshes the list', {
      tag: [...UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const original = buildPersonForm({ roles: ['PATIENT'] });
      const changes = buildPersonForm({
        name: `${original.name} Updated`,
        cpf: original.cpf,
        birthDate: '1985-12-31',
        email: `updated.${original.cpf}@example.com`,
        phone: '48988887777',
        roles: ['PATIENT'],
      });
      const personId = await registerAndFind(page, original);

      await perform(page, StartEditingPerson.withId(personId), FillThePersonForm.with(changes), SaveThePerson());

      await test.step('A success message is shown', async () => {
        await expect.poll(() => ask(page, TextOf.the(SuccessMessage.MESSAGE))).toBe('Person updated successfully');
      });

      await perform(page, AcknowledgeTheSuccessMessage());

      await test.step('The same row is refreshed with the new data and no duplicate appears', async () => {
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(changes));
        expect(await ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
      });

      await test.step('The changes are stored', async () => {
        await perform(page, OpenGeneralRegistration(), FindPerson.withCpf(original.cpf).under('PATIENT'), StartEditingPerson.withId(personId));
        expect(await ask(page, PersonFormValues())).toEqual({ name: changes.name, cpf: changes.cpf, birthDate: changes.birthDate, email: changes.email, phone: changes.phone });
      });
    });

    test('Adds a role so the person appears under it without a duplicate record', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['NURSE'] });
      const personId = await registerAndFind(page, data);

      await perform(page, StartEditingPerson.withId(personId), Check.the(PersonForm.roleCheckbox('PATIENT')), SaveThePerson(), AcknowledgeTheSuccessMessage());

      await test.step('The row shows the new role', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.roleBadge(personId, 'PATIENT')))).toBe(true);
      });

      await perform(page, SelectRole.named('PATIENT'));

      await test.step('The same record is listed under PATIENT, once', async () => {
        await expect.poll(() => ask(page, IdOfListedPerson.withCpf(data.cpf))).toBe(personId);
        expect(await ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
      });
    });

    test('Removing the OTHER role clears its custom roles', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR', 'OTHER'], customRoles: ['Researcher', 'Lecturer'] });
      const personId = await registerAndFind(page, data);

      await perform(page, StartEditingPerson.withId(personId), Uncheck.the(PersonForm.roleCheckbox('OTHER')));

      await test.step('The custom role inputs disappear', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PersonForm.CUSTOM_ROLES_GROUP))).toBe(false);
      });

      await perform(page, SaveThePerson(), AcknowledgeTheSuccessMessage());

      await test.step('The row no longer shows custom roles', async () => {
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor({ ...data, roles: ['DOCTOR'] }));
      });

      await perform(page, SelectRole.named('OTHER'));

      await test.step('The person left the OTHER list', async () => {
        expect(await ask(page, IsDisplayed.the(PeopleList.row(personId)))).toBe(false);
      });

      await perform(page, SelectRole.named('DOCTOR'), StartEditingPerson.withId(personId));

      await test.step('Reopening the record shows no custom roles', async () => {
        expect(await ask(page, CheckedRoles())).toEqual(['DOCTOR']);
        expect(await ask(page, IsDisplayed.the(PersonForm.CUSTOM_ROLES_GROUP))).toBe(false);
      });
    });

    test('Replaces custom roles by removing one and adding another', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['OTHER'], customRoles: ['Researcher', 'Lecturer'] });
      const personId = await registerAndFind(page, data);

      await perform(page, StartEditingPerson.withId(personId));
      const [researcherId] = await ask(page, CustomRoleIds());
      await perform(page, RemoveTheCustomRoleInput.withId(researcherId), AddACustomRoleInput());
      const mentorId = (await ask(page, CustomRoleIds())).at(-1)!;
      await perform(page, Enter.theValue('Mentor').into(PersonForm.customRoleInput(mentorId)), SaveThePerson(), AcknowledgeTheSuccessMessage());

      await test.step('The row and the stored record show the new custom roles', async () => {
        await expect.poll(async () => (await ask(page, PersonRow.of(personId)))?.customRoles).toEqual(['Lecturer', 'Mentor']);
        await perform(page, StartEditingPerson.withId(personId));
        expect(await ask(page, CustomRoleValues())).toEqual(['Lecturer', 'Mentor']);
      });
    });

    test('Removes optional data when email and phone are cleared', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      const personId = await registerAndFind(page, data);

      await perform(
        page,
        StartEditingPerson.withId(personId),
        Clear.theValueOf(PersonForm.EMAIL_INPUT),
        Clear.theValueOf(PersonForm.PHONE_INPUT),
        SaveThePerson(),
        AcknowledgeTheSuccessMessage(),
      );

      await test.step('The row shows placeholders for email and phone', async () => {
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor({ ...data, email: '', phone: '' }));
      });

      await perform(page, StartEditingPerson.withId(personId));

      await test.step('The stored record has no email or phone', async () => {
        expect(await ask(page, PersonFormValues())).toMatchObject({ email: '', phone: '' });
      });
    });

    test('Shows a loading indicator while the person is being loaded', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const personId = await registerAndFind(page, buildPersonForm({ roles: ['PATIENT'] }));

      await perform(page, SelectPerson.withId(personId), Network.becomesSlow(), Click.on(PeopleList.EDIT_BUTTON));

      await test.step('The loading indicator is shown before the form', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.PERSON_LOADING))).toBe(true);
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(false);
      });

      await perform(page, Network.becomesNormal());

      await test.step('Once loaded, the form opens and the indicator disappears', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.PERSON_LOADING))).toBe(false);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Shows the server status and message when the CPF belongs to another person', {
      tag: [...UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const first = buildPersonForm({ roles: ['DOCTOR'] });
      const second = buildPersonForm({ roles: ['DOCTOR'] });
      await registerAndFind(page, first);
      const secondId = await registerAndFind(page, second);

      await perform(page, StartEditingPerson.withId(secondId), Enter.theValue(first.cpf).into(PersonForm.CPF_INPUT), SubmitThePersonForm());

      await test.step('An error dialog shows the status code and the server message', async () => {
        await expect.poll(() => ask(page, TextOf.the(ErrorMessage.MESSAGE))).toBe('Failed to update person (409): A person with this CPF already exists');
      });

      await perform(page, AcknowledgeTheErrorMessage());

      await test.step('The form stays open', async () => {
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
      });

      await perform(page, CancelThePersonForm());

      await test.step('Both people keep their own CPF', async () => {
        for (const person of [first, second]) {
          await perform(page, FindPerson.withCpf(person.cpf).under('DOCTOR'));
          const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(person.cpf));
          await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(person));
        }
      });
    });

    test('Shows an error and refreshes the list when the person was deleted by another user', {
      tag: [...UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page, anotherSession }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      const personId = await registerAndFind(page, data);

      await perform(page, SelectPerson.withId(personId));
      await perform(anotherSession, DeletePerson.withCpf(data.cpf).listedUnder('PATIENT'));
      await perform(page, Click.on(PeopleList.EDIT_BUTTON));

      await test.step('An error dialog explains the person was not found', async () => {
        await expect.poll(() => ask(page, TextOf.the(ErrorMessage.MESSAGE))).toBe('Failed to load person (404): Person not found');
      });

      await perform(page, AcknowledgeTheErrorMessage());

      await test.step('No form opens and the refreshed list no longer shows the person', async () => {
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(false);
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.row(personId)))).toBe(false);
      });
    });

    test('Blocks saving when a required field is cleared', {
      tag: [...UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      const personId = await registerAndFind(page, data);

      await perform(page, StartEditingPerson.withId(personId), Clear.theValueOf(PersonForm.NAME_INPUT), SubmitThePersonForm());

      await test.step('The name message is shown and the form stays open', async () => {
        await expect.poll(() => ask(page, ValidationMessage.of('name'))).toBe('Name is required.');
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
      });

      await perform(page, CancelThePersonForm());

      await test.step('The record keeps its name', async () => {
        await expect.poll(() => ask(page, TextOf.the(PeopleList.cell('name', personId)))).toBe(data.name);
      });
    });

    test('Cancelling an edit leaves the record unchanged', {
      tag: [...UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      const personId = await registerAndFind(page, data);

      await perform(page, StartEditingPerson.withId(personId), Enter.theValue(`${data.name} Discarded`).into(PersonForm.NAME_INPUT), CancelThePersonForm());

      await test.step('The list still shows the original data', async () => {
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(data));
      });

      await perform(page, OpenGeneralRegistration(), FindPerson.withCpf(data.cpf).under('PATIENT'), StartEditingPerson.withId(personId));

      await test.step('The stored record keeps the original name', async () => {
        expect((await ask(page, PersonFormValues())).name).toBe(data.name);
      });
    });
  });
});
