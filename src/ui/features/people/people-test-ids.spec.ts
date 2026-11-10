import { Page } from '@playwright/test';
import { test, expect, UI_TAGS } from '../../../../fixtures/ui.fixture';
import { NO_VIOLATIONS, testIdViolations } from '../../helpers/test-ids';
import { Check } from '../../interactions/check';
import { Click } from '../../interactions/click';
import { Enter } from '../../interactions/enter';
import { Network } from '../../interactions/network';
import { Select } from '../../interactions/select';
import { Wait } from '../../interactions/wait';
import { RenderedTestIds } from '../../questions/generic';
import { CustomRoleIds, IdOfListedPerson } from '../../questions/people';
import { ask, askUntilPresent, perform } from '../../screenplay/core';
import { ErrorMessage, PEOPLE_COLUMNS, PeopleFilter, PeopleList, PersonForm } from '../../targets/people';
import { DismissTheDeletion, RequestTheDeletion } from '../../tasks/deletion';
import { StartEditingPerson } from '../../tasks/edition';
import { OpenGeneralRegistration } from '../../tasks/navigation';
import { FindPerson, SelectRole } from '../../tasks/people-list';
import { AcknowledgeTheErrorMessage, AcknowledgeTheSuccessMessage, AddACustomRoleInput, CancelThePersonForm, RemoveTheCustomRoleInput, SaveThePerson, StartAddingAPerson, SubmitThePersonForm } from '../../tasks/person-form';
import { RegisterPerson } from '../../tasks/registration';
import { buildPersonForm } from '../../payloads/person';

/** Asserts every given test ID is currently rendered. */
async function expectRendered(page: Page, required: readonly string[]): Promise<void> {
  const rendered = await ask(page, RenderedTestIds());

  for (const testId of required) {
    expect(rendered, `Missing test ID ${testId}`).toContain(testId);
  }
}

/** Asserts the test IDs rendered right now follow the contract. */
async function expectContractIn(page: Page, state: string): Promise<void> {
  expect(testIdViolations(await ask(page, RenderedTestIds())), `${state}: Test ID contract violations`).toEqual(NO_VIOLATIONS);
}

test.describe('People UI | Test ID contract', () => {
  test.describe('POSITIVE', () => {
    test('Exposes the mandatory page test IDs', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration());

      await test.step('Page, dropdown, list, table, Add button and empty state are identified', async () => {
        await expectRendered(page, ['people-page', 'people-role-select', 'people-list-section', 'people-add-button', 'people-table', 'people-empty-state']);
      });
    });

    test('Exposes the mandatory form test IDs', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration(), SelectRole.named('OTHER'), StartAddingAPerson());
      const [customRoleId] = await ask(page, CustomRoleIds());

      await test.step('Form, inputs, role groups, custom role controls and actions are identified', async () => {
        await expectRendered(page, [
          'people-form',
          'people-name-input',
          'people-cpf-input',
          'people-birth-date-input',
          'people-email-input',
          'people-phone-input',
          'people-roles-group',
          'people-custom-roles-group',
          `people-custom-roles-input-${customRoleId}`,
          'people-custom-roles-add-button',
          `people-custom-roles-remove-${customRoleId}`,
          'people-save-button',
          'people-cancel-button',
        ]);
      });

      await perform(page, Enter.theValue('123').into(PersonForm.CPF_INPUT), SubmitThePersonForm());

      await test.step('An invalid CPF exposes its validation message test ID', async () => {
        await expect.poll(() => ask(page, RenderedTestIds())).toContain('people-cpf-validation-error');
      });
    });

    test('Builds row and cell test IDs from the person ID', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });

      await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('PATIENT'));
      const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));

      await test.step('The row and each of its cells carry the MongoDB ID', async () => {
        expect(personId).toMatch(/^[a-f\d]{24}$/);
        await expectRendered(page, [
          `people-row-${personId}`,
          ...PEOPLE_COLUMNS.map((column) => `people-${column}-cell-${personId}`),
          `people-role-badge-${personId}-patient`,
        ]);
      });

      await perform(page, SelectRole.named('DOCTOR'), SelectRole.named('PATIENT'));

      await test.step('The row keeps its test ID after the list is reloaded', async () => {
        expect(await ask(page, IdOfListedPerson.withCpf(data.cpf))).toBe(personId);
      });
    });

    test('Keeps every rendered test ID unique and kebab case in each state', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR', 'OTHER'], customRoles: ['Researcher', 'Lecturer'] });

      await perform(page, RegisterPerson.with(data), OpenGeneralRegistration(), SelectRole.named('DOCTOR'));
      await test.step('List with rows', () => expectContractIn(page, 'List'));

      await perform(page, StartAddingAPerson(), Check.the(PersonForm.roleCheckbox('OTHER')), AddACustomRoleInput(), AddACustomRoleInput());
      const [, removableId] = await ask(page, CustomRoleIds());
      await perform(page, RemoveTheCustomRoleInput.withId(removableId), AddACustomRoleInput(), SubmitThePersonForm());
      await test.step('Add form with custom roles added and removed', () => expectContractIn(page, 'Add form'));
      await perform(page, CancelThePersonForm());

      await perform(page, FindPerson.withCpf(data.cpf).under('DOCTOR'));
      const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
      await perform(page, StartEditingPerson.withId(personId));
      await test.step('Edit form', () => expectContractIn(page, 'Edit form'));
      await perform(page, CancelThePersonForm());

      await perform(page, Click.on(PeopleFilter.OPEN_BUTTON), Wait.until(PeopleFilter.DIALOG).isVisible());
      await test.step('Filter dialog', () => expectContractIn(page, 'Filter dialog'));
      await perform(page, Click.on(PeopleFilter.CANCEL_BUTTON), Wait.until(PeopleFilter.DIALOG).isHidden());

      await perform(page, RequestTheDeletion.ofPerson(personId));
      await test.step('Delete confirmation', () => expectContractIn(page, 'Delete confirmation'));
      await perform(page, DismissTheDeletion());

      await perform(page, StartEditingPerson.withId(personId), SaveThePerson());
      await test.step('Success message', async () => {
        await expectRendered(page, ['people-success-message']);
        await expectContractIn(page, 'Success message');
      });
      await perform(page, AcknowledgeTheSuccessMessage());

      await perform(page, Network.goesOffline(), Select.option('NURSE').from(PeopleList.ROLE_SELECT), Wait.until(ErrorMessage.MESSAGE).isVisible());
      await test.step('Error message', async () => {
        await expectRendered(page, ['people-error-message']);
        await expectContractIn(page, 'Error message');
      });
      await perform(page, AcknowledgeTheErrorMessage(), Network.comesBackOnline());

      await perform(page, Network.becomesSlow(), Select.option('PATIENT').from(PeopleList.ROLE_SELECT), Wait.until(PeopleList.LOADING).isVisible());
      await test.step('Loading indicator', async () => {
        await expectRendered(page, ['people-loading']);
        await expectContractIn(page, 'Loading');
      });
      await perform(page, Network.becomesNormal(), Wait.until(PeopleList.LOADING).isHidden());
    });
  });
});
