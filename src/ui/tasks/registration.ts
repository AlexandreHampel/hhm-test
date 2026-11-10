import { expect } from '@playwright/test';
import { PersonFormData } from '../helpers/models';
import { IsDisplayed, TextOf } from '../questions/generic';
import { perform, taskWhere } from '../screenplay/core';
import { ErrorMessage, SuccessMessage } from '../targets/people';
import { OpenGeneralRegistration } from './navigation';
import { SelectRole } from './people-list';
import { AcknowledgeTheSuccessMessage, FillThePersonForm, StartAddingAPerson, SubmitThePersonForm } from './person-form';

/**
 * Registers a person through the form, from opening the page to acknowledging
 * the success message. It is how scenarios prepare the people they need.
 */
export const RegisterPerson = {
  with: (data: PersonFormData) =>
    taskWhere(`Register ${data.name} through the form`, async (page) => {
      await perform(
        page,
        OpenGeneralRegistration(),
        SelectRole.named(data.roles[0] ?? 'PATIENT'),
        StartAddingAPerson(),
        FillThePersonForm.with(data),
        SubmitThePersonForm(),
      );

      await expect
        .poll(async () => (await IsDisplayed.the(SuccessMessage.MESSAGE).answeredBy(page)) || (await IsDisplayed.the(ErrorMessage.MESSAGE).answeredBy(page)), {
          message: `Waiting for the outcome of registering ${data.name}`,
        })
        .toBe(true);

      const error = await TextOf.the(ErrorMessage.MESSAGE).answeredBy(page);

      if (error) {
        throw new Error(`Registering ${data.name} failed: ${error}`);
      }

      await perform(page, AcknowledgeTheSuccessMessage());
    }),
};
