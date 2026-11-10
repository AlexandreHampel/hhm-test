import { Click } from '../interactions/click';
import { Wait } from '../interactions/wait';
import { task } from '../screenplay/core';
import { PeopleList, PersonForm } from '../targets/people';
import { SelectPerson } from './people-list';

/** Selects the person and opens the edit form, waiting until the stored data has been loaded into it. */
export const StartEditingPerson = {
  withId: (personId: string) =>
    task(
      `Start editing person ${personId}`,
      SelectPerson.withId(personId),
      Click.on(PeopleList.EDIT_BUTTON),
      Wait.until(PersonForm.DIALOG).isVisible(),
      Wait.until(PeopleList.PERSON_LOADING).isHidden(),
    ),
};
