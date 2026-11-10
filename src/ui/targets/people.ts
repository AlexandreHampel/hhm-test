import { Role, ValidatedField } from '../helpers/models';
import { roleKey } from '../helpers/roles';
import { Target } from '../screenplay/target';

/** Table columns, identified by the same stable IDs the grid uses. */
export type PeopleColumn = 'name' | 'cpf' | 'birth-date' | 'email' | 'phone' | 'roles' | 'custom-roles';

export const PEOPLE_COLUMNS: readonly PeopleColumn[] = ['name', 'cpf', 'birth-date', 'email', 'phone', 'roles', 'custom-roles'];

/** General registration page: header, role selection, toolbar and table. */
export const PeopleList = {
  PAGE: Target.the('General registration page').locatedByTestId('people-page'),
  TITLE: Target.the('Page title').locatedByTestId('people-title'),
  BACK_LINK: Target.the('Back to modules link').locatedByTestId('people-back-link'),
  ROLE_LABEL: Target.the('Person role label').locatedByTestId('people-role-label'),
  ROLE_SELECT: Target.the('Person role dropdown').locatedByTestId('people-role-select'),
  roleOption: (role: Role) => Target.the(`${role} role option`).locatedByTestId(`people-role-option-${roleKey(role)}`),

  ADD_BUTTON: Target.the('Add button').locatedByTestId('people-add-button'),
  EDIT_BUTTON: Target.the('Edit button').locatedByTestId('people-edit-button'),
  DELETE_BUTTON: Target.the('Delete button').locatedByTestId('people-delete-button'),

  LIST_SECTION: Target.the('People list section').locatedByTestId('people-list-section'),
  TABLE: Target.the('People table').locatedByTestId('people-table'),
  ROWS: Target.the('People table rows').locatedBy((page) =>
    page.getByTestId('people-table-body').locator('[data-testid^="people-row-"]'),
  ),
  row: (personId: string) => Target.the(`Row of person ${personId}`).locatedByTestId(`people-row-${personId}`),
  cell: (column: PeopleColumn, personId: string) =>
    Target.the(`${column} cell of person ${personId}`).locatedByTestId(`people-${column}-cell-${personId}`),
  roleBadge: (personId: string, role: Role) =>
    Target.the(`${role} badge of person ${personId}`).locatedByTestId(`people-role-badge-${personId}-${roleKey(role)}`),

  LOADING: Target.the('People loading indicator').locatedByTestId('people-loading'),
  LOADING_MESSAGE: Target.the('People loading message').locatedByTestId('people-loading-message'),
  PERSON_LOADING: Target.the('Person loading indicator').locatedByTestId('people-person-loading'),
  EMPTY_STATE: Target.the('Empty list message').locatedByTestId('people-empty-state'),
};

/** Registration form shown in the add and edit dialog. */
export const PersonForm = {
  DIALOG: Target.the('Person form dialog').locatedByTestId('people-form-dialog'),
  TITLE: Target.the('Person form title').locatedByTestId('people-form-title'),
  NAME_INPUT: Target.the('Name input').locatedByTestId('people-name-input'),
  CPF_INPUT: Target.the('CPF input').locatedByTestId('people-cpf-input'),
  BIRTH_DATE_INPUT: Target.the('Birth date input').locatedByTestId('people-birth-date-input'),
  EMAIL_INPUT: Target.the('Email input').locatedByTestId('people-email-input'),
  PHONE_INPUT: Target.the('Phone input').locatedByTestId('people-phone-input'),
  ROLES_GROUP: Target.the('Roles group').locatedByTestId('people-roles-group'),
  roleCheckbox: (role: Role) => Target.the(`${role} checkbox`).locatedByTestId(`people-roles-checkbox-${roleKey(role)}`),

  CUSTOM_ROLES_GROUP: Target.the('Custom roles group').locatedByTestId('people-custom-roles-group'),
  CUSTOM_ROLE_ITEMS: Target.the('Custom role entries').locatedBy((page) =>
    page.getByTestId('people-custom-roles-group').locator('[data-testid^="people-custom-roles-item-"]'),
  ),
  customRoleInput: (clientId: string) => Target.the(`Custom role input ${clientId}`).locatedByTestId(`people-custom-roles-input-${clientId}`),
  customRoleRemoveButton: (clientId: string) =>
    Target.the(`Remove button of custom role ${clientId}`).locatedByTestId(`people-custom-roles-remove-${clientId}`),
  customRoleError: (clientId: string) =>
    Target.the(`Validation message of custom role ${clientId}`).locatedByTestId(`people-custom-roles-input-validation-error-${clientId}`),
  ADD_CUSTOM_ROLE_BUTTON: Target.the('Add custom role button').locatedByTestId('people-custom-roles-add-button'),

  validationError: (field: ValidatedField) =>
    Target.the(`${field} validation message`).locatedByTestId(`people-${field}-validation-error`),
  CUSTOM_ROLES_REQUIRED_ERROR: Target.the('Missing custom role message').locatedByTestId('people-custom-roles-required-validation-error'),
  CUSTOM_ROLES_DUPLICATE_ERROR: Target.the('Duplicate custom role message').locatedByTestId('people-custom-roles-duplicate-validation-error'),
  SUMMARY_ERROR: Target.the('Form validation summary').locatedByTestId('people-form-validation-error'),

  SAVE_BUTTON: Target.the('Save button').locatedByTestId('people-save-button'),
  CANCEL_BUTTON: Target.the('Cancel button').locatedByTestId('people-cancel-button'),
  CLOSE_BUTTON: Target.the('Close button').locatedByTestId('people-form-close-button'),
};

/** Field identifiers offered by the people filter. */
export type PeopleFilterField = 'name' | 'cpf' | 'birth-date' | 'email' | 'phone' | 'custom-role';

/** Filter dialog opened from the toolbar. */
export const PeopleFilter = {
  OPEN_BUTTON: Target.the('Filter button').locatedByTestId('people-filter-button'),
  ACTIVE_COUNT: Target.the('Active filter count').locatedByTestId('people-filter-active-count'),
  DIALOG: Target.the('Filter dialog').locatedByTestId('people-filter-form-dialog'),
  input: (field: PeopleFilterField) => Target.the(`${field} filter input`).locatedByTestId(`people-filter-${field}-input`),
  APPLY_BUTTON: Target.the('Apply filter button').locatedByTestId('people-filter-apply-button'),
  CLEAR_BUTTON: Target.the('Clear filter button').locatedByTestId('people-filter-clear-button'),
  CANCEL_BUTTON: Target.the('Cancel filter button').locatedByTestId('people-filter-cancel-button'),
};

/** Message dialogs share one component, so their targets derive from the prefix given by the page. */
function messageDialog(name: string, prefix: string, confirmAction: string) {
  return {
    DIALOG: Target.the(`${name} dialog`).locatedByTestId(`${prefix}-dialog`),
    TITLE: Target.the(`${name} title`).locatedByTestId(`${prefix}-title`),
    MESSAGE: Target.the(`${name} message`).locatedByTestId(`${prefix}-message`),
    CANCEL_BUTTON: Target.the(`${name} cancel button`).locatedByTestId(`${prefix}-cancel-button`),
    CONFIRM_BUTTON: Target.the(`${name} confirm button`).locatedByTestId(`${prefix}-${confirmAction}-button`),
  };
}

export type MessageDialogTargets = ReturnType<typeof messageDialog>;

export const DeleteConfirmation = messageDialog('Delete confirmation', 'people-delete', 'confirm');
export const SuccessMessage = messageDialog('Success', 'people-success', 'ok');
export const ErrorMessage = messageDialog('Error', 'people-error', 'ok');
