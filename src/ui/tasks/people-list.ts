import { expect } from '@playwright/test';
import { Click } from '../interactions/click';
import { Enter } from '../interactions/enter';
import { Select } from '../interactions/select';
import { Wait } from '../interactions/wait';
import { Role } from '../helpers/models';
import { roleLabel } from '../helpers/roles';
import { IsRowSelected } from '../questions/people';
import { perform, task, taskWhere } from '../screenplay/core';
import { PeopleFilter, PeopleFilterField, PeopleList } from '../targets/people';

/** Selects a role in the dropdown and waits for its people to be loaded. */
export const SelectRole = {
  named: (role: Role) =>
    task(`Select the ${roleLabel(role)} role`, Select.option(role).from(PeopleList.ROLE_SELECT), Wait.until(PeopleList.LOADING).isHidden()),
};

/** Applies filter criteria through the filter dialog. Criteria not given keep their current value. */
export const FilterPeople = {
  by: (criteria: Partial<Record<PeopleFilterField, string>>) =>
    task(
      `Filter people by ${Object.keys(criteria).join(' and ')}`,
      Click.on(PeopleFilter.OPEN_BUTTON),
      Wait.until(PeopleFilter.DIALOG).isVisible(),
      ...Object.entries(criteria).map(([field, value]) => Enter.theValue(value ?? '').into(PeopleFilter.input(field as PeopleFilterField))),
      Click.on(PeopleFilter.APPLY_BUTTON),
      Wait.until(PeopleFilter.DIALOG).isHidden(),
    ),
};

/** Removes every filter criterion. */
export const ClearTheFilter = () =>
  task(
    'Clear the filter',
    Click.on(PeopleFilter.OPEN_BUTTON),
    Wait.until(PeopleFilter.DIALOG).isVisible(),
    Click.on(PeopleFilter.CLEAR_BUTTON),
    Wait.until(PeopleFilter.DIALOG).isHidden(),
  );

/** Lists the people holding a role, narrowed to one CPF so the row is found regardless of paging or concurrent data. */
export const FindPerson = {
  withCpf: (cpf: string) => ({
    under: (role: Role) => task(`Find the person with CPF ${cpf} under ${roleLabel(role)}`, SelectRole.named(role), FilterPeople.by({ cpf })),
  }),
};

/** Selects a row. Clicking toggles the selection, so an already selected row is left as it is. */
export const SelectPerson = {
  withId: (personId: string) =>
    taskWhere(`Select the row of person ${personId}`, async (page) => {
      await perform(page, Wait.until(PeopleList.row(personId)).isVisible());

      if (!(await IsRowSelected.of(personId).answeredBy(page))) {
        await perform(page, Click.on(PeopleList.row(personId)));
      }

      await expect.poll(() => IsRowSelected.of(personId).answeredBy(page)).toBe(true);
    }),
};
