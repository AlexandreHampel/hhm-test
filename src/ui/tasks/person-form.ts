import { expect } from '@playwright/test';
import { Check, Uncheck } from '../interactions/check';
import { Click } from '../interactions/click';
import { Enter } from '../interactions/enter';
import { Wait } from '../interactions/wait';
import { PersonFormData, Role, SUPPORTED_ROLES } from '../helpers/models';
import { CheckedRoles, CustomRoleIds } from '../questions/people';
import { ValueOf } from '../questions/generic';
import { perform, task, taskWhere } from '../screenplay/core';
import { ErrorMessage, PeopleList, PersonForm, SuccessMessage } from '../targets/people';

/** Opens the registration form with the Add button. */
export const StartAddingAPerson = () =>
  task('Start adding a person', Click.on(PeopleList.ADD_BUTTON), Wait.until(PersonForm.DIALOG).isVisible());

/** Checks exactly the given roles and unchecks the others. */
export const CheckTheRoles = {
  exactly: (roles: readonly Role[]) =>
    task(
      `Check exactly the roles ${roles.length ? roles.join(', ') : 'none'}`,
      ...SUPPORTED_ROLES.map((role) => (roles.includes(role) ? Check.the(PersonForm.roleCheckbox(role)) : Uncheck.the(PersonForm.roleCheckbox(role)))),
    ),
};

/** Adds a custom role input, failing if the new input does not get an ID of its own. */
export const AddACustomRoleInput = () =>
  taskWhere('Add a custom role input', async (page) => {
    const before = await CustomRoleIds().answeredBy(page);
    await perform(page, Click.on(PersonForm.ADD_CUSTOM_ROLE_BUTTON));
    await expect.poll(async () => (await CustomRoleIds().answeredBy(page)).length).toBe(before.length + 1);

    const after = await CustomRoleIds().answeredBy(page);
    const added = after.filter((clientId) => !before.includes(clientId));

    expect(added, `The new custom role input must have its own ID. Before: ${before}, after: ${after}`).toHaveLength(1);
  });

/** Removes the custom role input with the given client ID. */
export const RemoveTheCustomRoleInput = {
  withId: (clientId: string) =>
    task(
      `Remove the custom role input ${clientId}`,
      Click.on(PersonForm.customRoleRemoveButton(clientId)),
      Wait.until(PersonForm.customRoleInput(clientId)).isHidden(),
    ),
};

/** Makes the custom role inputs hold exactly the given names, adding or removing inputs as needed. */
export const EnterTheCustomRoles = {
  named: (names: readonly string[]) =>
    taskWhere(`Enter the custom roles ${JSON.stringify(names)}`, async (page) => {
      while ((await CustomRoleIds().answeredBy(page)).length < names.length) {
        await perform(page, AddACustomRoleInput());
      }

      for (const clientId of (await CustomRoleIds().answeredBy(page)).slice(names.length)) {
        await perform(page, RemoveTheCustomRoleInput.withId(clientId));
      }

      const clientIds = await CustomRoleIds().answeredBy(page);

      for (const [index, name] of names.entries()) {
        await perform(page, Enter.theValue(name).into(PersonForm.customRoleInput(clientIds[index])));
      }
    }),
};

/** Fills every field of the form from the given data. */
export const FillThePersonForm = {
  with: (data: PersonFormData) =>
    task(
      `Fill the person form for ${data.name.trim() || 'a person without name'}`,
      Enter.theValue(data.name).into(PersonForm.NAME_INPUT),
      Enter.theValue(data.cpf).into(PersonForm.CPF_INPUT),
      Enter.theValue(data.birthDate).into(PersonForm.BIRTH_DATE_INPUT),
      Enter.theValue(data.email).into(PersonForm.EMAIL_INPUT),
      Enter.theValue(data.phone).into(PersonForm.PHONE_INPUT),
      CheckTheRoles.exactly(data.roles),
      ...(data.roles.includes('OTHER') ? [EnterTheCustomRoles.named(data.customRoles)] : []),
    ),
};

/** Clicks Save without expecting any outcome. */
export const SubmitThePersonForm = () => task('Submit the person form', Click.on(PersonForm.SAVE_BUTTON));

/** Saves the form and waits for the success message. */
export const SaveThePerson = () =>
  task('Save the person', SubmitThePersonForm(), Wait.until(PersonForm.DIALOG).isHidden(), Wait.until(SuccessMessage.MESSAGE).isVisible());

export const CancelThePersonForm = () =>
  task('Cancel the person form', Click.on(PersonForm.CANCEL_BUTTON), Wait.until(PersonForm.DIALOG).isHidden());

export const AcknowledgeTheSuccessMessage = () =>
  task('Acknowledge the success message', Click.on(SuccessMessage.CONFIRM_BUTTON), Wait.until(SuccessMessage.DIALOG).isHidden());

export const AcknowledgeTheErrorMessage = () =>
  task('Acknowledge the error message', Click.on(ErrorMessage.CONFIRM_BUTTON), Wait.until(ErrorMessage.DIALOG).isHidden());
