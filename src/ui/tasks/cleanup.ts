import { expect, Page } from '@playwright/test';
import { SUPPORTED_ROLES } from '../helpers/models';
import { IsDisplayed } from '../questions/generic';
import { IdOfListedPerson } from '../questions/people';
import { perform, taskWhere } from '../screenplay/core';
import { SubmittedPerson } from '../screenplay/memory';
import { ErrorMessage, PeopleList, SuccessMessage } from '../targets/people';
import { ConfirmTheDeletion, RequestTheDeletion } from './deletion';
import { OpenGeneralRegistration } from './navigation';
import { FilterPeople, SelectRole } from './people-list';
import { AcknowledgeTheErrorMessage, AcknowledgeTheSuccessMessage } from './person-form';

/** Closes whichever message the deletion left open, so the next removal starts from a clean page. */
async function acknowledgeAnyMessage(page: Page): Promise<void> {
  if (await IsDisplayed.the(SuccessMessage.DIALOG).answeredBy(page)) {
    await perform(page, AcknowledgeTheSuccessMessage());
  }

  if (await IsDisplayed.the(ErrorMessage.DIALOG).answeredBy(page)) {
    await perform(page, AcknowledgeTheErrorMessage());
  }
}

/**
 * Removes a person submitted during a scenario, through the interface. The
 * list is narrowed to the CPF once and every role is searched, starting with
 * the roles it was submitted with. Only a row showing exactly that CPF is
 * deleted. Nothing happens when the person was never created.
 *
 * The removal is confirmed by the row leaving the list rather than by the
 * success message, so cleanup keeps working even when that message is broken.
 */
export const RemoveTheSubmittedPerson = {
  matching: (person: SubmittedPerson) =>
    taskWhere(`Remove the person with CPF ${person.cpf} created by the scenario`, async (page) => {
      await perform(page, OpenGeneralRegistration(), FilterPeople.by({ cpf: person.cpf }));

      const roles = [...person.roles, ...SUPPORTED_ROLES.filter((role) => !person.roles.includes(role))];

      for (const role of roles) {
        await perform(page, SelectRole.named(role));
        const personId = await IdOfListedPerson.withCpf(person.cpf).answeredBy(page);

        if (personId) {
          await perform(page, RequestTheDeletion.ofPerson(personId), ConfirmTheDeletion());
          await expect.poll(() => IsDisplayed.the(PeopleList.row(personId)).answeredBy(page)).toBe(false);
          await acknowledgeAnyMessage(page);
          return;
        }
      }
    }),
};
