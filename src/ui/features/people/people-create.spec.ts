import { Page } from '@playwright/test';
import { test, expect, UI_TAGS } from '../../../../fixtures/ui.fixture';
import { addDays, expectedRowFor, formatCpf } from '../../helpers/format';
import { PersonFormData, Role, SUPPORTED_ROLES } from '../../helpers/models';
import { Click } from '../../interactions/click';
import { Network } from '../../interactions/network';
import { Press } from '../../interactions/press';
import { Wait } from '../../interactions/wait';
import { IsDisplayed, IsEnabled, NumberOf, TextOf, TodayInTheBrowser, ValueOf } from '../../questions/generic';
import { CheckedRoles, CustomRoleValues, IdOfListedPerson, PersonFormValues, PersonRow, ValidationMessage } from '../../questions/people';
import { ask, askUntilPresent, perform, Performable } from '../../screenplay/core';
import { ErrorMessage, PeopleList, PersonForm, SuccessMessage } from '../../targets/people';
import { StartEditingPerson } from '../../tasks/edition';
import { OpenGeneralRegistration } from '../../tasks/navigation';
import { FindPerson, SelectRole } from '../../tasks/people-list';
import { AcknowledgeTheErrorMessage, AcknowledgeTheSuccessMessage, CancelThePersonForm, CheckTheRoles, FillThePersonForm, SaveThePerson, StartAddingAPerson, SubmitThePersonForm } from '../../tasks/person-form';
import { RegisterPerson } from '../../tasks/registration';
import { buildPersonForm, buildRequiredOnlyPersonForm } from '../../payloads/person';

/** Reloads the list, finds the person and compares what the table and the edit form show with the entered data. */
async function expectPersonToBeStored(page: Page, data: PersonFormData, role = data.roles[0]): Promise<void> {
  await perform(page, OpenGeneralRegistration(), FindPerson.withCpf(data.cpf).under(role));
  const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));

  await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(data));

  await perform(page, StartEditingPerson.withId(personId));
  expect(await ask(page, PersonFormValues())).toEqual({
    name: data.name.trim(),
    cpf: data.cpf.replace(/\D/g, ''),
    birthDate: data.birthDate,
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
  });
  expect(await ask(page, CheckedRoles())).toEqual(SUPPORTED_ROLES.filter((candidate) => data.roles.includes(candidate)));
  await perform(page, CancelThePersonForm());
}

/** Asserts that no person with the CPF is listed under the role. */
async function expectPersonNotToBeRegistered(page: Page, cpf: string, role: Role): Promise<void> {
  await perform(page, OpenGeneralRegistration(), FindPerson.withCpf(cpf).under(role));
  expect(await ask(page, IdOfListedPerson.withCpf(cpf))).toBeUndefined();
}

test.describe('People UI | Add person', () => {
  test.describe('POSITIVE', () => {
    for (const role of SUPPORTED_ROLES) {
      test(`Add opens an empty form with ${role} preselected`, {
        tag: [...UI_TAGS, '@POSITIVE'],
      }, async ({ page }) => {
        await perform(page, OpenGeneralRegistration(), SelectRole.named(role), StartAddingAPerson());

        await test.step('The form is titled Add Person and its fields are empty', async () => {
          await expect.poll(() => ask(page, TextOf.the(PersonForm.TITLE))).toBe('Add Person');
          expect(await ask(page, PersonFormValues())).toEqual({ name: '', cpf: '', birthDate: '', email: '', phone: '' });
        });

        await test.step(`Only ${role} is checked`, async () => {
          await expect.poll(() => ask(page, CheckedRoles())).toEqual([role]);
        });

        await test.step(role === 'OTHER' ? 'One empty custom role input is offered' : 'No custom role input is shown', async () => {
          await expect.poll(() => ask(page, IsDisplayed.the(PersonForm.CUSTOM_ROLES_GROUP))).toBe(role === 'OTHER');

          if (role === 'OTHER') {
            await expect.poll(() => ask(page, CustomRoleValues())).toEqual(['']);
          }
        });
      });
    }

    test('Creates a person with all fields and refreshes the list', {
      tag: [...UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR'] });

      await perform(page, OpenGeneralRegistration(), FindPerson.withCpf(data.cpf).under('DOCTOR'));

      await test.step('Nobody is listed with the new CPF yet', async () => {
        expect(await ask(page, NumberOf.the(PeopleList.ROWS))).toBe(0);
      });

      await perform(page, StartAddingAPerson(), FillThePersonForm.with(data), SaveThePerson());

      await test.step('A success message is shown', async () => {
        await expect.poll(() => ask(page, TextOf.the(SuccessMessage.MESSAGE))).toBe('Person created successfully');
      });

      await perform(page, AcknowledgeTheSuccessMessage());

      await test.step('The list refreshes and shows the new person', async () => {
        const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(data));
      });

      await test.step('The person is stored with the entered data', async () => {
        await expectPersonToBeStored(page, data);
      });
    });

    test('Creates a person with only the required fields', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildRequiredOnlyPersonForm({ roles: ['PATIENT'] });

      await perform(page, RegisterPerson.with(data));

      await test.step('Empty optional fields are shown as placeholders and stay empty', async () => {
        await expectPersonToBeStored(page, data);
      });
    });

    test('Creates a person holding multiple roles in a single record', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['NURSE', 'PATIENT'] });
      let personId = '';

      await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('NURSE'));

      await test.step('The row shows both roles', async () => {
        personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(data));
      });

      await perform(page, SelectRole.named('PATIENT'));

      await test.step('The same record is listed under PATIENT, once', async () => {
        await expect.poll(() => ask(page, IdOfListedPerson.withCpf(data.cpf))).toBe(personId);
        expect(await ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
      });
    });

    test('Accepts a masked CPF and stores only its digits', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });

      await perform(page, RegisterPerson.with({ ...data, cpf: formatCpf(data.cpf) }));

      await test.step('The CPF is displayed masked and stored as digits', async () => {
        await expectPersonToBeStored(page, data);
      });
    });

    test('Accepts today as the birth date', {
      tag: [...UI_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration());
      const data = buildPersonForm({ roles: ['PATIENT'], birthDate: await ask(page, TodayInTheBrowser()) });

      await perform(page, RegisterPerson.with(data));

      await test.step('The birth date is stored', async () => {
        await expectPersonToBeStored(page, data);
      });
    });

    for (const phone of ['12345678', '123456789012345']) {
      test(`Accepts a phone number with ${phone.length} digits`, {
        tag: [...UI_TAGS, '@POSITIVE', '@BOUNDARY'],
      }, async ({ page }) => {
        const data = buildPersonForm({ roles: ['PATIENT'], phone });

        await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('PATIENT'));

        await test.step('The phone number is stored as entered', async () => {
          const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
          await perform(page, StartEditingPerson.withId(personId));
          expect(await ask(page, ValueOf.the(PersonForm.PHONE_INPUT))).toBe(phone);
        });
      });
    }

    test('Creates a person without a role selected in the dropdown', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['NURSING_TECHNICIAN'] });

      await perform(page, OpenGeneralRegistration(), StartAddingAPerson());

      await test.step('No role is preselected', async () => {
        expect(await ask(page, CheckedRoles())).toEqual([]);
      });

      await perform(page, FillThePersonForm.with(data), SaveThePerson(), AcknowledgeTheSuccessMessage());

      await test.step('The person is stored with the chosen role', async () => {
        await expectPersonToBeStored(page, data);
      });
    });

    test('Does not list a new person under the selected role when that role was unchecked', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['NURSE'] });

      await perform(
        page,
        OpenGeneralRegistration(),
        FindPerson.withCpf(data.cpf).under('DOCTOR'),
        StartAddingAPerson(),
        FillThePersonForm.with(data),
        SaveThePerson(),
        AcknowledgeTheSuccessMessage(),
        Wait.until(PeopleList.LOADING).isHidden(),
      );

      await test.step('The refreshed DOCTOR list does not show the person', async () => {
        expect(await ask(page, IdOfListedPerson.withCpf(data.cpf))).toBeUndefined();
      });

      await perform(page, SelectRole.named('NURSE'));

      await test.step('The person is listed under NURSE', async () => {
        await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
      });
    });

    const dismissals: Array<{ label: string; dismiss: Performable }> = [
      { label: 'the Cancel button', dismiss: Click.on(PersonForm.CANCEL_BUTTON) },
      { label: 'the close button', dismiss: Click.on(PersonForm.CLOSE_BUTTON) },
      { label: 'the Escape key', dismiss: Press.key('Escape') },
    ];

    for (const { label, dismiss } of dismissals) {
      test(`Discards the form when dismissed with ${label}`, {
        tag: [...UI_TAGS, '@POSITIVE'],
      }, async ({ page }) => {
        const data = buildPersonForm({ roles: ['PATIENT'] });

        await perform(page, OpenGeneralRegistration(), SelectRole.named('PATIENT'), StartAddingAPerson(), FillThePersonForm.with(data), dismiss);

        await test.step('The form closes', async () => {
          await expect.poll(() => ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(false);
        });

        await perform(page, StartAddingAPerson());

        await test.step('Reopening the form shows empty fields', async () => {
          expect(await ask(page, PersonFormValues())).toEqual({ name: '', cpf: '', birthDate: '', email: '', phone: '' });
        });

        await test.step('Nobody was registered', async () => {
          await expectPersonNotToBeRegistered(page, data.cpf, 'PATIENT');
        });
      });
    }
  });

  test.describe('NEGATIVE', () => {
    test('Blocks saving an empty form and highlights the required fields', {
      tag: [...UI_TAGS, '@NEGATIVE', '@SMOKE'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration(), SelectRole.named('DOCTOR'), StartAddingAPerson(), SubmitThePersonForm());

      await test.step('Required field messages and the summary are shown', async () => {
        await expect.poll(() => ask(page, ValidationMessage.of('name'))).toBe('Name is required.');
        await expect.poll(() => ask(page, ValidationMessage.of('cpf'))).toBe('CPF is required.');
        await expect.poll(() => ask(page, ValidationMessage.of('birth-date'))).toBe('Birth date is required.');
        await expect.poll(() => ask(page, TextOf.the(PersonForm.SUMMARY_ERROR))).toBe('Please correct the highlighted fields before saving.');
      });

      await test.step('Optional fields are not flagged and the form stays open', async () => {
        expect(await ask(page, ValidationMessage.of('email'))).toBeNull();
        expect(await ask(page, ValidationMessage.of('phone'))).toBeNull();
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
        expect(await ask(page, IsDisplayed.the(SuccessMessage.DIALOG))).toBe(false);
      });
    });

    test('Requires at least one role', {
      tag: [...UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR'] });

      await perform(
        page,
        OpenGeneralRegistration(),
        SelectRole.named('DOCTOR'),
        StartAddingAPerson(),
        FillThePersonForm.with(data),
        CheckTheRoles.exactly([]),
        SubmitThePersonForm(),
      );

      await test.step('The roles message is shown and the form stays open', async () => {
        await expect.poll(() => ask(page, ValidationMessage.of('roles'))).toBe('Select at least one role.');
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
      });

      await test.step('Nobody was registered', async () => {
        await expectPersonNotToBeRegistered(page, data.cpf, 'DOCTOR');
      });
    });

    const invalidFields: Array<{ label: string; field: 'name' | 'cpf' | 'email' | 'phone'; value: string; message: string; tags?: string[] }> = [
      { label: 'a whitespace-only name', field: 'name', value: '   ', message: 'Name is required.' },
      { label: 'a CPF with too few digits', field: 'cpf', value: '123', message: 'CPF must contain exactly 11 digits.', tags: ['@BOUNDARY'] },
      { label: 'a CPF containing letters', field: 'cpf', value: '529.982.247-AB', message: 'CPF must contain exactly 11 digits.' },
      { label: 'a CPF with wrong check digits', field: 'cpf', value: '52998224700', message: 'CPF is invalid.' },
      { label: 'a CPF with every digit repeated', field: 'cpf', value: '11111111111', message: 'CPF is invalid.', tags: ['@EDGE'] },
      { label: 'an invalid email', field: 'email', value: 'not-an-email', message: 'Enter a valid email address.' },
      { label: 'a phone containing letters', field: 'phone', value: '47 9999-ABCD', message: 'Enter a valid phone number (8 to 15 digits).' },
      { label: 'a phone with too few digits', field: 'phone', value: '1234567', message: 'Enter a valid phone number (8 to 15 digits).', tags: ['@BOUNDARY'] },
      { label: 'a phone with too many digits', field: 'phone', value: '1234567890123456', message: 'Enter a valid phone number (8 to 15 digits).', tags: ['@BOUNDARY'] },
    ];

    for (const { label, field, value, message, tags = [] } of invalidFields) {
      test(`Rejects ${label}`, {
        tag: [...UI_TAGS, '@NEGATIVE', ...tags],
      }, async ({ page }) => {
        const data = buildPersonForm({ roles: ['PATIENT'], [field]: value });

        await perform(page, OpenGeneralRegistration(), SelectRole.named('PATIENT'), StartAddingAPerson(), FillThePersonForm.with(data), SubmitThePersonForm());

        await test.step('The field message is shown and the form stays open', async () => {
          await expect.poll(() => ask(page, ValidationMessage.of(field))).toBe(message);
          expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
          expect(await ask(page, IsDisplayed.the(SuccessMessage.DIALOG))).toBe(false);
        });

        if (field !== 'cpf') {
          await test.step('Nobody was registered', async () => {
            await expectPersonNotToBeRegistered(page, data.cpf, 'PATIENT');
          });
        }
      });
    }

    test('Rejects a birth date in the future', {
      tag: [...UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration());
      const data = buildPersonForm({ roles: ['PATIENT'], birthDate: addDays(await ask(page, TodayInTheBrowser()), 1) });

      await perform(page, SelectRole.named('PATIENT'), StartAddingAPerson(), FillThePersonForm.with(data), SubmitThePersonForm());

      await test.step('The birth date message is shown and the form stays open', async () => {
        await expect.poll(() => ask(page, ValidationMessage.of('birth-date'))).toBe('Birth date cannot be in the future.');
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
      });

      await test.step('Nobody was registered', async () => {
        await expectPersonNotToBeRegistered(page, data.cpf, 'PATIENT');
      });
    });

    test('Shows the server status and message when the CPF is already registered', {
      tag: [...UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const existing = buildPersonForm({ roles: ['NURSE'] });
      const duplicate = buildPersonForm({ roles: ['DOCTOR'], cpf: existing.cpf });

      await perform(
        page,
        RegisterPerson.with(existing),
        OpenGeneralRegistration(),
        SelectRole.named('DOCTOR'),
        StartAddingAPerson(),
        FillThePersonForm.with(duplicate),
        SubmitThePersonForm(),
      );

      await test.step('An error dialog shows the status code and the server message', async () => {
        await expect.poll(() => ask(page, TextOf.the(ErrorMessage.MESSAGE))).toBe('Failed to create person (409): A person with this CPF already exists');
      });

      await perform(page, AcknowledgeTheErrorMessage());

      await test.step('The form stays open with the entered data', async () => {
        expect(await ask(page, IsDisplayed.the(PersonForm.DIALOG))).toBe(true);
        expect(await ask(page, PersonFormValues())).toMatchObject({ name: duplicate.name, cpf: duplicate.cpf });
      });

      await perform(page, CancelThePersonForm());

      await test.step('The existing person is unchanged', async () => {
        await expectPersonToBeStored(page, existing);
      });
    });

    test('Creates a single person when saving is triggered repeatedly', {
      tag: [...UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });

      await perform(
        page,
        OpenGeneralRegistration(),
        FindPerson.withCpf(data.cpf).under('PATIENT'),
        StartAddingAPerson(),
        FillThePersonForm.with(data),
        Network.becomesSlow(),
        SubmitThePersonForm(),
      );

      await test.step('The form switches to a disabled saving state', async () => {
        await expect.poll(() => ask(page, TextOf.the(PersonForm.SAVE_BUTTON))).toBe('Saving...');
        expect(await ask(page, IsEnabled.the(PersonForm.SAVE_BUTTON))).toBe(false);
        expect(await ask(page, IsEnabled.the(PersonForm.CANCEL_BUTTON))).toBe(false);
      });

      await perform(page, Press.key('Enter').in(PersonForm.NAME_INPUT), Network.becomesNormal());

      await test.step('The person is created once and no duplicate error follows', async () => {
        await expect.poll(() => ask(page, TextOf.the(SuccessMessage.MESSAGE))).toBe('Person created successfully');
        await perform(page, AcknowledgeTheSuccessMessage(), Wait.until(PeopleList.LOADING).isHidden());
        await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        expect(await ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
        expect(await ask(page, IsDisplayed.the(ErrorMessage.DIALOG))).toBe(false);
      });
    });
  });
});
