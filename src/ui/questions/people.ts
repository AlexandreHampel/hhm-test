import { DisplayedRow, EMPTY_CELL, formatCpf } from '../helpers/format';
import { Role, SUPPORTED_ROLES, ValidatedField } from '../helpers/models';
import { question } from '../screenplay/core';
import { PeopleList, PersonForm } from '../targets/people';
import { IsChecked, TextOf, ValueOf } from './generic';

const ROW_PREFIX = 'people-row-';
const CUSTOM_ROLE_ITEM_PREFIX = 'people-custom-roles-item-';

/** IDs of the people listed on the current table page, taken from their row test IDs. */
export const ListedPersonIds = () =>
  question('IDs of the listed people', (page) =>
    PeopleList.ROWS.resolveFor(page).evaluateAll(
      (rows, prefix) => rows.map((row) => (row.getAttribute('data-testid') ?? '').replace(prefix, '')),
      ROW_PREFIX,
    ),
  );

/** ID of the listed person showing the given CPF, or undefined when nobody shows it. */
export const IdOfListedPerson = {
  withCpf: (cpf: string) =>
    question(`ID of the listed person with CPF ${cpf}`, async (page) => {
      for (const personId of await ListedPersonIds().answeredBy(page)) {
        if ((await TextOf.the(PeopleList.cell('cpf', personId)).answeredBy(page)) === formatCpf(cpf)) {
          return personId;
        }
      }

      return undefined;
    }),
};

/** Everything a table row shows for a person, or null when the row is not displayed. */
export const PersonRow = {
  of: (personId: string) =>
    question(`Row of person ${personId}`, async (page): Promise<DisplayedRow | null> => {
      if (!(await PeopleList.row(personId).resolveFor(page).count())) {
        return null;
      }

      const text = async (column: Parameters<typeof PeopleList.cell>[0]) =>
        (await TextOf.the(PeopleList.cell(column, personId)).answeredBy(page)) ?? '';

      const roles = await PeopleList.cell('roles', personId)
        .resolveFor(page)
        .locator('[data-testid^="people-role-badge-"]')
        .allInnerTexts();

      // Custom role badges have no test ID of their own, so they are read as the children of their identified cell.
      const customRolesCell = PeopleList.cell('custom-roles', personId).resolveFor(page);
      const customRoles = (await text('custom-roles')) === EMPTY_CELL ? [] : await customRolesCell.locator(':scope > span').allInnerTexts();

      return {
        name: await text('name'),
        cpf: await text('cpf'),
        birthDate: await text('birth-date'),
        email: await text('email'),
        phone: await text('phone'),
        roles: roles.map((role) => role.trim()),
        customRoles: customRoles.map((customRole) => customRole.trim()),
      };
    }),
};

/** Whether the row of the person is selected. */
export const IsRowSelected = {
  of: (personId: string) =>
    question(`Whether the row of person ${personId} is selected`, async (page) =>
      (await PeopleList.row(personId).resolveFor(page).getAttribute('aria-selected')) === 'true',
    ),
};

/** Listed people that do not show a badge for the role. */
export const ListedPeopleWithoutBadge = {
  of: (role: Role) =>
    question(`Listed people without the ${role} badge`, async (page) => {
      const missing: string[] = [];

      for (const personId of await ListedPersonIds().answeredBy(page)) {
        if (!(await PeopleList.roleBadge(personId, role).resolveFor(page).count())) {
          missing.push(personId);
        }
      }

      return missing;
    }),
};

/** Labels of the role options offered by the dropdown. */
export const RoleOptionLabels = () =>
  question('Labels of the role options', async (page) => {
    const labels: (string | null)[] = [];

    for (const role of SUPPORTED_ROLES) {
      labels.push(await TextOf.the(PeopleList.roleOption(role)).answeredBy(page));
    }

    return labels;
  });

/** Values shown by the text fields of the person form. */
export const PersonFormValues = () =>
  question('Values of the person form', async (page) => ({
    name: await ValueOf.the(PersonForm.NAME_INPUT).answeredBy(page),
    cpf: await ValueOf.the(PersonForm.CPF_INPUT).answeredBy(page),
    birthDate: await ValueOf.the(PersonForm.BIRTH_DATE_INPUT).answeredBy(page),
    email: await ValueOf.the(PersonForm.EMAIL_INPUT).answeredBy(page),
    phone: await ValueOf.the(PersonForm.PHONE_INPUT).answeredBy(page),
  }));

/** Roles checked in the person form. */
export const CheckedRoles = () =>
  question('Roles checked in the person form', async (page) => {
    const checked: Role[] = [];

    for (const role of SUPPORTED_ROLES) {
      if (await IsChecked.the(PersonForm.roleCheckbox(role)).answeredBy(page)) {
        checked.push(role);
      }
    }

    return checked;
  });

/** Client-generated IDs of the custom role inputs, in screen order. */
export const CustomRoleIds = () =>
  question('IDs of the custom role inputs', (page) =>
    PersonForm.CUSTOM_ROLE_ITEMS.resolveFor(page).evaluateAll(
      (items, prefix) => items.map((item) => (item.getAttribute('data-testid') ?? '').replace(prefix, '')),
      CUSTOM_ROLE_ITEM_PREFIX,
    ),
  );

/** Values of the custom role inputs, in screen order. */
export const CustomRoleValues = () =>
  question('Values of the custom role inputs', async (page) => {
    const values: string[] = [];

    for (const clientId of await CustomRoleIds().answeredBy(page)) {
      values.push((await ValueOf.the(PersonForm.customRoleInput(clientId)).answeredBy(page)) ?? '');
    }

    return values;
  });

/** Validation message shown for a field, or null when the field is valid. */
export const ValidationMessage = {
  of: (field: ValidatedField) => TextOf.the(PersonForm.validationError(field)),
};
