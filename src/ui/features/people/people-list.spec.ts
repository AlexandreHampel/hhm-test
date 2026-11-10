import { test, expect, UI_TAGS } from '../../../../fixtures/ui.fixture';
import { expectedRowFor } from '../../helpers/format';
import { SUPPORTED_ROLES } from '../../helpers/models';
import { ROLE_OPTIONS } from '../../helpers/roles';
import { Click } from '../../interactions/click';
import { MarkTheCurrentDocument } from '../../interactions/document';
import { Network } from '../../interactions/network';
import { Select } from '../../interactions/select';
import { IsDisplayed, IsEnabled, IsTheMarkedDocument, NumberOf, TextOf, ValueOf } from '../../questions/generic';
import { IdOfListedPerson, IsRowSelected, ListedPeopleWithoutBadge, PersonRow, RoleOptionLabels } from '../../questions/people';
import { ask, askUntilPresent, perform } from '../../screenplay/core';
import { Target } from '../../screenplay/target';
import { ErrorMessage, PeopleList } from '../../targets/people';
import { OpenGeneralRegistration } from '../../tasks/navigation';
import { FilterPeople, FindPerson, SelectPerson, SelectRole } from '../../tasks/people-list';
import { AcknowledgeTheErrorMessage } from '../../tasks/person-form';
import { RegisterPerson } from '../../tasks/registration';
import { buildPersonForm, buildPersonFormWithCustomRoles } from '../../payloads/person';

test.describe('People UI | Page and role selection', () => {
  test.describe('POSITIVE', () => {
    test('Shows the role dropdown with every supported role and no role selected', {
      tag: [...UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration());

      await test.step('The dropdown is labelled and offers every role', async () => {
        await expect.poll(() => ask(page, TextOf.the(PeopleList.ROLE_LABEL))).toBe('Person Role');
        await expect.poll(() => ask(page, RoleOptionLabels())).toEqual(ROLE_OPTIONS.map((option) => option.label));
      });

      await test.step('No role is selected and the list asks for one', async () => {
        await expect.poll(() => ask(page, ValueOf.the(PeopleList.ROLE_SELECT))).toBe('');
        await expect.poll(() => ask(page, TextOf.the(PeopleList.EMPTY_STATE))).toBe('Select a role to view registered people.');
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(0);
      });

      await test.step('Only the Add action is available', async () => {
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.ADD_BUTTON))).toBe(true);
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.EDIT_BUTTON))).toBe(false);
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.DELETE_BUTTON))).toBe(false);
      });
    });

    for (const role of SUPPORTED_ROLES) {
      test(`Selecting ${role} automatically lists the people holding it`, {
        tag: [...UI_TAGS, '@POSITIVE'],
      }, async ({ page }) => {
        const data = role === 'OTHER' ? buildPersonFormWithCustomRoles(['Physiotherapist', 'Receptionist']) : buildPersonForm({ roles: [role] });

        await perform(page, RegisterPerson.with(data), OpenGeneralRegistration(), MarkTheCurrentDocument(), SelectRole.named(role));

        await test.step('The page was not reloaded', async () => {
          expect(await ask(page, IsTheMarkedDocument())).toBe(true);
        });

        await test.step(`Every listed person holds ${role}`, async () => {
          expect(await ask(page, ListedPeopleWithoutBadge.of(role))).toEqual([]);
        });

        await perform(page, FilterPeople.by({ cpf: data.cpf }));

        await test.step('The registered person is listed with its data', async () => {
          const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
          await expect.poll(() => ask(page, PersonRow.of(personId))).toEqual(expectedRowFor(data));
        });
      });
    }

    test('Lists a person with multiple roles under each of their roles only', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const assignedRoles = ['DOCTOR', 'NURSE', 'OTHER'] as const;
      const data = buildPersonForm({ roles: [...assignedRoles], customRoles: ['Researcher'] });
      let personId = '';

      await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('DOCTOR'));
      personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));

      for (const role of SUPPORTED_ROLES) {
        const assigned = (assignedRoles as readonly string[]).includes(role);

        await perform(page, SelectRole.named(role));

        await test.step(`${assigned ? 'Listed' : 'Not listed'} under ${role}`, async () => {
          await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.row(personId)))).toBe(assigned);

          if (!assigned) {
            // The wording depends on whether other people hold the role, which this scenario does not control.
            await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.EMPTY_STATE))).toBe(true);
          }
        });
      }
    });

    test('Shows every custom role of people listed under OTHER', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const customRoles = ['Physiotherapist', 'Chaplain', 'Interpreter'];
      const data = buildPersonFormWithCustomRoles(customRoles);

      await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('OTHER'));

      await test.step('The custom roles column shows all of them', async () => {
        const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await expect.poll(async () => (await ask(page, PersonRow.of(personId)))?.customRoles).toEqual(customRoles);
      });
    });

    test('Shows a loading indicator while people are being loaded', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration(), Network.becomesSlow(), Select.option('PATIENT').from(PeopleList.ROLE_SELECT));

      await test.step('The loading indicator is shown and adding is disabled', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.LOADING))).toBe(true);
        await expect.poll(() => ask(page, TextOf.the(PeopleList.LOADING_MESSAGE))).toBe('Loading people...');
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.ADD_BUTTON))).toBe(false);
      });

      await perform(page, Network.becomesNormal());

      await test.step('Once loaded, the indicator disappears and adding is enabled again', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.LOADING))).toBe(false);
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.ADD_BUTTON))).toBe(true);
      });
    });

    test('Renders markup typed in a name as plain text', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'], name: `<b data-testid="injected-markup">QA-UI Markup</b> ${Date.now()}` });
      const injectedMarkup = Target.the('Element injected through the name').locatedByTestId('injected-markup');

      await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('PATIENT'));

      await test.step('The name is displayed literally and no element is injected', async () => {
        const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
        await expect.poll(() => ask(page, TextOf.the(PeopleList.cell('name', personId)))).toBe(data.name);
        expect(await ask(page, NumberOf.the(injectedMarkup))).toBe(0);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Shows an error with the status code when the server cannot be reached', {
      tag: [...UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration(), Network.goesOffline(), Select.option('DOCTOR').from(PeopleList.ROLE_SELECT));

      await test.step('An error dialog reports the failed request and its status', async () => {
        await expect.poll(() => ask(page, TextOf.the(ErrorMessage.TITLE))).toBe('Error');
        await expect.poll(() => ask(page, TextOf.the(ErrorMessage.MESSAGE))).toMatch(/^Failed to load people \(0\): .+/);
      });

      await perform(page, AcknowledgeTheErrorMessage());

      await test.step('The list explains that people could not be loaded', async () => {
        await expect.poll(() => ask(page, TextOf.the(PeopleList.EMPTY_STATE))).toBe('People could not be loaded.');
      });
    });

    test('Keeps Edit and Delete disabled until a row is selected', {
      tag: [...UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      let personId = '';

      await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('PATIENT'));
      personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));

      await test.step('Edit and Delete are disabled without a selection', async () => {
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.EDIT_BUTTON))).toBe(false);
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.DELETE_BUTTON))).toBe(false);
      });

      await perform(page, SelectPerson.withId(personId));

      await test.step('Selecting the row enables them', async () => {
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.EDIT_BUTTON))).toBe(true);
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.DELETE_BUTTON))).toBe(true);
      });

      await perform(page, Click.on(PeopleList.row(personId)));

      await test.step('Clicking the row again clears the selection and disables them', async () => {
        await expect.poll(() => ask(page, IsRowSelected.of(personId))).toBe(false);
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.EDIT_BUTTON))).toBe(false);
        await expect.poll(() => ask(page, IsEnabled.the(PeopleList.DELETE_BUTTON))).toBe(false);
      });
    });
  });
});
