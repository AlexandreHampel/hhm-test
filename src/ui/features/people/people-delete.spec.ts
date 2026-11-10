import { Page } from '@playwright/test';
import { test, expect, UI_TAGS } from '../../../../fixtures/ui.fixture';
import { PersonFormData } from '../../helpers/models';
import { uniqueSuffix } from '../../helpers/unique';
import { Network } from '../../interactions/network';
import { Press } from '../../interactions/press';
import { IsDisplayed, IsEnabled, NumberOf, TextOf } from '../../questions/generic';
import { IdOfListedPerson } from '../../questions/people';
import { ask, askUntilPresent, perform, Performable } from '../../screenplay/core';
import { DeleteConfirmation, ErrorMessage, PeopleList, SuccessMessage } from '../../targets/people';
import { ConfirmTheDeletion, DeletePerson, DismissTheDeletion, RequestTheDeletion } from '../../tasks/deletion';
import { OpenGeneralRegistration } from '../../tasks/navigation';
import { FilterPeople, FindPerson, SelectRole } from '../../tasks/people-list';
import { AcknowledgeTheErrorMessage, AcknowledgeTheSuccessMessage } from '../../tasks/person-form';
import { RegisterPerson } from '../../tasks/registration';
import { buildPersonForm } from '../../payloads/person';

/** Registers a patient through the form and lists it, returning its ID. */
async function registerAndFind(page: Page, data: PersonFormData): Promise<string> {
  await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('PATIENT'));

  return askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
}

/** Whether a person with the CPF is still registered, checked from a freshly opened list. */
async function isStillRegistered(page: Page, cpf: string): Promise<boolean> {
  await perform(page, OpenGeneralRegistration(), FindPerson.withCpf(cpf).under('PATIENT'));

  return (await ask(page, IdOfListedPerson.withCpf(cpf))) !== undefined;
}

test.describe('People UI | Delete person', () => {
  test.describe('POSITIVE', () => {
    test('Asks for confirmation naming the person before deleting', {
      tag: [...UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      const personId = await registerAndFind(page, data);

      await perform(page, RequestTheDeletion.ofPerson(personId));

      await test.step('The confirmation names the person and offers Cancel and Delete', async () => {
        await expect.poll(() => ask(page, TextOf.the(DeleteConfirmation.TITLE))).toBe('Delete Person');
        expect(await ask(page, TextOf.the(DeleteConfirmation.MESSAGE))).toBe(`Are you sure you want to delete ${data.name}? This action cannot be undone.`);
        expect(await ask(page, TextOf.the(DeleteConfirmation.CANCEL_BUTTON))).toBe('Cancel');
        expect(await ask(page, TextOf.the(DeleteConfirmation.CONFIRM_BUTTON))).toBe('Delete');
      });
    });

    test('Deletes the person after confirmation and refreshes the list', {
      tag: [...UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      const personId = await registerAndFind(page, data);

      await perform(page, RequestTheDeletion.ofPerson(personId), ConfirmTheDeletion());

      await test.step('A success message is shown', async () => {
        await expect.poll(() => ask(page, TextOf.the(SuccessMessage.MESSAGE))).toBe('Person deleted successfully');
      });

      await perform(page, AcknowledgeTheSuccessMessage());

      await test.step('The refreshed list no longer shows the person', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.row(personId)))).toBe(false);
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.EMPTY_STATE))).toBe(true);
        expect(await ask(page, IsEnabled.the(PeopleList.EDIT_BUTTON))).toBe(false);
      });

      await test.step('The person is no longer registered', async () => {
        expect(await isStillRegistered(page, data.cpf)).toBe(false);
      });
    });

    test('Deleting one person keeps the others listed', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const sharedName = `QA-UI Sibling ${uniqueSuffix()}`;
      const first = buildPersonForm({ roles: ['PATIENT'], name: `${sharedName} A` });
      const second = buildPersonForm({ roles: ['PATIENT'], name: `${sharedName} B` });

      await perform(page, RegisterPerson.with(first), RegisterPerson.with(second), SelectRole.named('PATIENT'), FilterPeople.by({ name: sharedName }));

      await test.step('Both people are listed', async () => {
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(2);
      });

      const firstId = await askUntilPresent(page, IdOfListedPerson.withCpf(first.cpf));
      const secondId = await askUntilPresent(page, IdOfListedPerson.withCpf(second.cpf));
      await perform(page, DeletePerson.withId(firstId));

      await test.step('Only the second one remains', async () => {
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
        expect(await ask(page, IsDisplayed.the(PeopleList.row(secondId)))).toBe(true);
      });
    });

    test('Shows a busy state while the deletion is in progress', {
      tag: [...UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const personId = await registerAndFind(page, buildPersonForm({ roles: ['PATIENT'] }));

      await perform(page, RequestTheDeletion.ofPerson(personId), Network.becomesSlow(), ConfirmTheDeletion());

      await test.step('Both buttons are disabled while deleting', async () => {
        await expect.poll(() => ask(page, TextOf.the(DeleteConfirmation.CONFIRM_BUTTON))).toBe('Deleting...');
        expect(await ask(page, IsEnabled.the(DeleteConfirmation.CONFIRM_BUTTON))).toBe(false);
        expect(await ask(page, IsEnabled.the(DeleteConfirmation.CANCEL_BUTTON))).toBe(false);
      });

      await perform(page, Press.key('Escape'));

      await test.step('Escape does not dismiss the confirmation while deleting', async () => {
        expect(await ask(page, IsDisplayed.the(DeleteConfirmation.DIALOG))).toBe(true);
      });

      await perform(page, Network.becomesNormal());

      await test.step('The deletion completes once, without errors', async () => {
        await expect.poll(() => ask(page, TextOf.the(SuccessMessage.MESSAGE))).toBe('Person deleted successfully');
        expect(await ask(page, IsDisplayed.the(ErrorMessage.DIALOG))).toBe(false);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    const dismissals: Array<{ label: string; dismiss: Performable }> = [
      { label: 'the Cancel button', dismiss: DismissTheDeletion() },
      { label: 'the Escape key', dismiss: Press.key('Escape') },
    ];

    for (const { label, dismiss } of dismissals) {
      test(`Keeps the person when the confirmation is dismissed with ${label}`, {
        tag: [...UI_TAGS, '@NEGATIVE'],
      }, async ({ page }) => {
        const data = buildPersonForm({ roles: ['PATIENT'] });
        const personId = await registerAndFind(page, data);

        await perform(page, RequestTheDeletion.ofPerson(personId), dismiss);

        await test.step('The confirmation closes and the person is still listed', async () => {
          await expect.poll(() => ask(page, IsDisplayed.the(DeleteConfirmation.DIALOG))).toBe(false);
          expect(await ask(page, IsDisplayed.the(PeopleList.row(personId)))).toBe(true);
        });

        await test.step('The person is still registered', async () => {
          expect(await isStillRegistered(page, data.cpf)).toBe(true);
        });
      });
    }

    test('Shows an error and refreshes the list when another user already deleted the person', {
      tag: [...UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page, anotherSession }) => {
      const data = buildPersonForm({ roles: ['PATIENT'] });
      const personId = await registerAndFind(page, data);

      await perform(page, RequestTheDeletion.ofPerson(personId));
      await perform(anotherSession, DeletePerson.withCpf(data.cpf).listedUnder('PATIENT'));
      await perform(page, ConfirmTheDeletion());

      await test.step('An error dialog shows the status code and the server message', async () => {
        await expect.poll(() => ask(page, TextOf.the(ErrorMessage.MESSAGE))).toBe('Failed to delete person (404): Person not found');
      });

      await perform(page, AcknowledgeTheErrorMessage());

      await test.step('The refreshed list no longer shows the person', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.row(personId)))).toBe(false);
      });
    });
  });
});
