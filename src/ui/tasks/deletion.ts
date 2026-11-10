import { Click } from '../interactions/click';
import { Wait } from '../interactions/wait';
import { Role } from '../helpers/models';
import { IdOfListedPerson } from '../questions/people';
import { askUntil, perform, task, taskWhere } from '../screenplay/core';
import { DeleteConfirmation, PeopleList, SuccessMessage } from '../targets/people';
import { OpenGeneralRegistration } from './navigation';
import { FindPerson, SelectPerson } from './people-list';
import { AcknowledgeTheSuccessMessage } from './person-form';

/** Selects the person and asks to delete it, stopping at the confirmation. */
export const RequestTheDeletion = {
  ofPerson: (personId: string) =>
    task(
      `Request the deletion of person ${personId}`,
      SelectPerson.withId(personId),
      Click.on(PeopleList.DELETE_BUTTON),
      Wait.until(DeleteConfirmation.DIALOG).isVisible(),
    ),
};

export const ConfirmTheDeletion = () => task('Confirm the deletion', Click.on(DeleteConfirmation.CONFIRM_BUTTON));

export const DismissTheDeletion = () =>
  task('Dismiss the deletion', Click.on(DeleteConfirmation.CANCEL_BUTTON), Wait.until(DeleteConfirmation.DIALOG).isHidden());

/** Deletes a listed person through the confirmation, up to acknowledging the success message. */
export const DeletePerson = {
  withId: (personId: string) =>
    task(
      `Delete person ${personId}`,
      RequestTheDeletion.ofPerson(personId),
      ConfirmTheDeletion(),
      Wait.until(SuccessMessage.MESSAGE).isVisible(),
      AcknowledgeTheSuccessMessage(),
    ),

  /** Finds the person from a freshly opened page and deletes it, as another user of the system would. */
  withCpf: (cpf: string) => ({
    listedUnder: (role: Role) =>
      taskWhere(`Delete the person with CPF ${cpf}`, async (page) => {
        await perform(page, OpenGeneralRegistration(), FindPerson.withCpf(cpf).under(role));
        const personId = await askUntil(page, IdOfListedPerson.withCpf(cpf), (id) => id !== undefined);
        await perform(page, DeletePerson.withId(personId!));
      }),
  }),
};
