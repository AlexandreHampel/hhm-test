import { MOVEMENT_TYPE_OPTIONS, MovementType, VISIT_TYPE_OPTIONS, VisitType } from '../helpers/visits';
import { Target } from '../screenplay/target';

/** Visit list columns, identified by the same IDs the grid uses. */
export type VisitColumn = 'patient' | 'type' | 'admission-date' | 'status' | 'professional';

export const VISIT_COLUMNS: readonly VisitColumn[] = ['patient', 'type', 'admission-date', 'status', 'professional'];

/** Text fields offered by the visit list filter. Patient and professional are chosen with finders. */
export type VisitFilterTextField = 'chief-complaint';

/** Date fields offered by the visit list filter. */
export type VisitFilterDateField = 'admission-from' | 'admission-to';

/** Message dialogs share one component, so their targets derive from the prefix given by the page. */
function messageDialog(name: string, prefix: string, confirmAction = 'ok') {
  return {
    DIALOG: Target.the(`${name} dialog`).locatedByTestId(`${prefix}-dialog`),
    TITLE: Target.the(`${name} title`).locatedByTestId(`${prefix}-title`),
    MESSAGE: Target.the(`${name} message`).locatedByTestId(`${prefix}-message`),
    CANCEL_BUTTON: Target.the(`${name} cancel button`).locatedByTestId(`${prefix}-cancel-button`),
    CONFIRM_BUTTON: Target.the(`${name} confirm button`).locatedByTestId(`${prefix}-${confirmAction}-button`),
  };
}

export type VisitMessageDialog = ReturnType<typeof messageDialog>;

/**
 * Read-only field whose value is chosen in a search dialog. Every person
 * selector of the module is one, so their targets derive from the prefix.
 */
function finder(name: string, prefix: string) {
  return {
    INPUT: Target.the(`${name} field`).locatedByTestId(`${prefix}-input`),
    OPEN_BUTTON: Target.the(`${name} search button`).locatedByTestId(`${prefix}-open-button`),
    CLEAR_BUTTON: Target.the(`${name} clear button`).locatedByTestId(`${prefix}-clear-button`),
    DIALOG: Target.the(`${name} search dialog`).locatedByTestId(`${prefix}-finder-form-dialog`),
    TITLE: Target.the(`${name} search dialog title`).locatedByTestId(`${prefix}-finder-form-title`),
    NAME_INPUT: Target.the(`${name} name search input`).locatedByTestId(`${prefix}-finder-name-input`),
    CPF_INPUT: Target.the(`${name} CPF search input`).locatedByTestId(`${prefix}-finder-cpf-input`),
    SEARCH_BUTTON: Target.the(`${name} search submit button`).locatedByTestId(`${prefix}-finder-search-button`),
    SEARCH_ERROR: Target.the(`${name} search validation message`).locatedByTestId(`${prefix}-finder-search-validation-error`),
    SELECTION_ERROR: Target.the(`${name} selection validation message`).locatedByTestId(`${prefix}-finder-selection-validation-error`),
    ROWS: Target.the(`${name} search results`).locatedBy((page) =>
      page.getByTestId(`${prefix}-finder-table-body`).locator(`[data-testid^="${prefix}-finder-row-"]`),
    ),
    row: (personId: string) => Target.the(`${name} result ${personId}`).locatedByTestId(`${prefix}-finder-row-${personId}`),
    cell: (column: 'name' | 'cpf' | 'roles', personId: string) =>
      Target.the(`${column} of ${name} result ${personId}`).locatedByTestId(`${prefix}-finder-${column}-cell-${personId}`),
    EMPTY_STATE: Target.the(`${name} empty results message`).locatedByTestId(`${prefix}-finder-empty-state`),
    SELECT_BUTTON: Target.the(`${name} select button`).locatedByTestId(`${prefix}-finder-select-button`),
    CANCEL_BUTTON: Target.the(`${name} cancel button`).locatedByTestId(`${prefix}-finder-cancel-button`),
    rowPrefix: `${prefix}-finder-row-`,
  };
}

export type FinderTargets = ReturnType<typeof finder>;

/** Patient Visits list: header, toolbar and table. */
export const VisitsList = {
  PAGE: Target.the('Patient Visits page').locatedByTestId('visits-page'),
  TITLE: Target.the('Patient Visits title').locatedByTestId('visits-title'),
  BACK_LINK: Target.the('Back to modules link').locatedByTestId('visits-back-link'),
  NEW_BUTTON: Target.the('New Visit button').locatedByTestId('visits-new-button'),
  VIEW_DETAILS_BUTTON: Target.the('View Details button').locatedByTestId('visits-view-details-button'),
  LIST_SECTION: Target.the('Visit list section').locatedByTestId('visits-list-section'),
  TABLE: Target.the('Visit table').locatedByTestId('visits-table'),
  HEADERS: Target.the('Visit table headers').locatedBy((page) => page.getByTestId('visits-table-head').locator('th')),
  header: (column: VisitColumn) => Target.the(`${column} column header`).locatedByTestId(`visits-table-header-${column}`),
  ROWS: Target.the('Visit table rows').locatedBy((page) => page.getByTestId('visits-table-body').locator('[data-testid^="visits-row-"]')),
  row: (visitId: string) => Target.the(`Row of visit ${visitId}`).locatedByTestId(`visits-row-${visitId}`),
  cell: (column: VisitColumn, visitId: string) => Target.the(`${column} cell of visit ${visitId}`).locatedByTestId(`visits-${column}-cell-${visitId}`),
  statusBadge: (visitId: string) => Target.the(`Status badge of visit ${visitId}`).locatedByTestId(`visits-status-badge-${visitId}`),
  LOADING: Target.the('Visit list loading indicator').locatedByTestId('visits-loading'),
  EMPTY_STATE: Target.the('Visit list empty message').locatedByTestId('visits-empty-state'),
  PAGINATION_INFO: Target.the('Visit list pagination summary').locatedByTestId('visits-pagination-info'),
};

/** Filter dialog of the visit list. */
export const VisitsFilter = {
  OPEN_BUTTON: Target.the('Visit filter button').locatedByTestId('visits-filter-button'),
  ACTIVE_COUNT: Target.the('Active visit filter count').locatedByTestId('visits-filter-active-count'),
  DIALOG: Target.the('Visit filter dialog').locatedByTestId('visits-filter-form-dialog'),
  input: (field: VisitFilterTextField) => Target.the(`${field} filter input`).locatedByTestId(`visits-filter-${field}-input`),
  dateInput: (field: VisitFilterDateField) => Target.the(`${field} filter date`).locatedByTestId(`visits-filter-${field}-input`),
  TYPE_SELECT: Target.the('Visit type filter').locatedByTestId('visits-filter-type-select'),
  STATUS_SELECT: Target.the('Status filter').locatedByTestId('visits-filter-status-select'),
  APPLY_BUTTON: Target.the('Apply visit filter button').locatedByTestId('visits-filter-apply-button'),
  CLEAR_BUTTON: Target.the('Clear visit filter button').locatedByTestId('visits-filter-clear-button'),
  CANCEL_BUTTON: Target.the('Cancel visit filter button').locatedByTestId('visits-filter-cancel-button'),
};

/** Person selectors of the visit list filter: the value is the person chosen in the finder. */
export const FilterPatientFinder = finder('Patient filter', 'visits-filter-patient');
export const FilterProfessionalFinder = finder('Responsible professional filter', 'visits-filter-professional');

export const VisitsListError = messageDialog('Visit list error', 'visits-error');

/** New Visit page and form. */
export const NewVisit = {
  PAGE: Target.the('New Visit page').locatedByTestId('visits-new-page'),
  TITLE: Target.the('New Visit title').locatedByTestId('visits-new-title'),
  BACK_LINK: Target.the('Back to Patient Visits link').locatedByTestId('visits-new-back-link'),
  LOADING: Target.the('New Visit loading indicator').locatedByTestId('visits-new-loading'),
  LOAD_ERROR_STATE: Target.the('New Visit load error state').locatedByTestId('visits-new-load-error-state'),
  RETRY_BUTTON: Target.the('New Visit retry button').locatedByTestId('visits-new-retry-button'),
  FORM: Target.the('New Visit form').locatedByTestId('visits-form'),
  TYPE_SELECT: Target.the('Visit type dropdown').locatedByTestId('visits-type-select'),
  typeOption: (type: VisitType) => Target.the(`${type} visit type option`).locatedByTestId(`visits-type-option-${VISIT_TYPE_OPTIONS[type].key}`),
  ADMISSION_INPUT: Target.the('Admission date and time input').locatedByTestId('visits-admission-date-input'),
  CHIEF_COMPLAINT_INPUT: Target.the('Chief complaint input').locatedByTestId('visits-chief-complaint-input'),
  NOTES_INPUT: Target.the('Notes input').locatedByTestId('visits-notes-input'),
  validationError: (field: 'patient' | 'type' | 'admission-date' | 'chief-complaint' | 'notes') =>
    Target.the(`${field} validation message`).locatedByTestId(`visits-${field}-validation-error`),
  SUMMARY_ERROR: Target.the('New Visit form validation summary').locatedByTestId('visits-form-validation-error'),
  SAVE_BUTTON: Target.the('Save Visit button').locatedByTestId('visits-save-button'),
  CANCEL_BUTTON: Target.the('Cancel button').locatedByTestId('visits-cancel-button'),
};

export const PatientFinder = finder('Patient selector', 'visits-patient');
export const ProfessionalFinder = finder('Responsible professional selector', 'visits-professional');
export const NewVisitError = messageDialog('New Visit error', 'visits-new-error');

/** Visit details page: summary and movement timeline. */
export const VisitDetails = {
  PAGE: Target.the('Visit details page').locatedByTestId('visits-details-page'),
  TITLE: Target.the('Visit details title').locatedByTestId('visits-details-title'),
  BACK_LINK: Target.the('Back to Patient Visits link').locatedByTestId('visits-details-back-link'),
  STATUS: Target.the('Visit status badge').locatedByTestId('visits-details-status'),
  LOADING: Target.the('Visit details loading indicator').locatedByTestId('visits-details-loading'),
  NOT_FOUND: Target.the('Visit not found message').locatedByTestId('visits-details-not-found'),
  LOAD_ERROR_STATE: Target.the('Visit load error state').locatedByTestId('visits-details-load-error-state'),
  RETRY_BUTTON: Target.the('Visit details retry button').locatedByTestId('visits-details-retry-button'),
  SUMMARY: Target.the('Visit summary').locatedByTestId('visits-details-summary'),
  EDIT_BUTTON: Target.the('Edit Visit button').locatedByTestId('visits-edit-button'),
  PATIENT: Target.the('Summary patient').locatedByTestId('visits-details-patient'),
  TYPE: Target.the('Summary type').locatedByTestId('visits-details-type'),
  ADMISSION: Target.the('Summary admission').locatedByTestId('visits-details-admission-date'),
  PROFESSIONAL: Target.the('Summary responsible professional').locatedByTestId('visits-details-professional'),
  CLOSED_AT: Target.the('Summary closed at').locatedByTestId('visits-details-closed-at'),
  CHIEF_COMPLAINT: Target.the('Summary chief complaint').locatedByTestId('visits-details-chief-complaint'),
  NOTES: Target.the('Summary notes').locatedByTestId('visits-details-notes'),
  CURRENT_DEPARTMENT: Target.the('Current department').locatedByTestId('visits-details-current-department'),
  ADD_MOVEMENT_BUTTON: Target.the('Add Movement button').locatedByTestId('visits-movement-add-button'),
  TIMELINE: Target.the('Movement timeline').locatedByTestId('visits-movement-timeline'),
  TIMELINE_EMPTY: Target.the('Empty movement timeline message').locatedByTestId('visits-movement-timeline-empty'),
  // Entry parts share the entry prefix (visits-movement-entry-type-...), so entries are the timeline items themselves.
  TIMELINE_ENTRIES: Target.the('Movement timeline entries').locatedBy((page) => page.getByTestId('visits-movement-timeline').locator(':scope > li')),
  entry: (movementId: string) => Target.the(`Movement ${movementId}`).locatedByTestId(`visits-movement-entry-${movementId}`),
  entryPart: (part: 'type' | 'occurred-at' | 'departments' | 'professional' | 'description' | 'recorded-at', movementId: string) =>
    Target.the(`${part} of movement ${movementId}`).locatedByTestId(`visits-movement-entry-${part}-${movementId}`),
};

export const VisitDetailsSuccess = messageDialog('Visit details success', 'visits-details-success');

/** Standard warning shown when a visit that is already closed is opened: it is read-only. */
export const ReadOnlyWarning = messageDialog('Read-only visit warning', 'visits-details-read-only');
export const VisitDetailsError = messageDialog('Visit details error', 'visits-details-error');

/** Edit Visit dialog. */
export const EditVisitForm = {
  DIALOG: Target.the('Edit Visit dialog').locatedByTestId('visits-edit-form-dialog'),
  PATIENT: Target.the('Read-only patient of the edit form').locatedByTestId('visits-edit-patient'),
  TYPE_SELECT: Target.the('Edit visit type dropdown').locatedByTestId('visits-edit-type-select'),
  CHIEF_COMPLAINT_INPUT: Target.the('Edit chief complaint input').locatedByTestId('visits-edit-chief-complaint-input'),
  NOTES_INPUT: Target.the('Edit notes input').locatedByTestId('visits-edit-notes-input'),
  CHIEF_COMPLAINT_ERROR: Target.the('Edit chief complaint validation message').locatedByTestId('visits-edit-chief-complaint-validation-error'),
  SUMMARY_ERROR: Target.the('Edit form validation summary').locatedByTestId('visits-edit-form-validation-error'),
  SAVE_BUTTON: Target.the('Edit save button').locatedByTestId('visits-edit-save-button'),
  CANCEL_BUTTON: Target.the('Edit cancel button').locatedByTestId('visits-edit-cancel-button'),
};

export const EditProfessionalFinder = finder('Edit responsible professional selector', 'visits-edit-professional');

/** Add Movement dialog. */
export const MovementForm = {
  DIALOG: Target.the('Add Movement dialog').locatedByTestId('visits-movement-form-dialog'),
  TYPE_SELECT: Target.the('Movement type dropdown').locatedByTestId('visits-movement-type-select'),
  typeOption: (type: MovementType) => Target.the(`${type} movement option`).locatedByTestId(`visits-movement-type-option-${MOVEMENT_TYPE_OPTIONS[type].key}`),
  USE_CURRENT_TIME_CHECKBOX: Target.the('Use current date and time checkbox').locatedByTestId('visits-movement-use-current-time-checkbox'),
  OCCURRED_AT_INPUT: Target.the('Occurred at input').locatedByTestId('visits-movement-occurred-at-input'),
  DEPARTMENT_FROM_INPUT: Target.the('Origin department input').locatedByTestId('visits-movement-department-from-input'),
  DEPARTMENT_TO_INPUT: Target.the('Destination department input').locatedByTestId('visits-movement-department-to-input'),
  DESCRIPTION_LABEL: Target.the('Description label').locatedByTestId('visits-movement-description-label'),
  DESCRIPTION_INPUT: Target.the('Description input').locatedByTestId('visits-movement-description-input'),
  validationError: (
    rule: 'type' | 'occurred-at-required' | 'occurred-at-too-early' | 'occurred-at-future' | 'department-to' | 'same-department' | 'description',
  ) => Target.the(`${rule} movement validation message`).locatedByTestId(`visits-movement-${rule}-validation-error`),
  SUMMARY_ERROR: Target.the('Movement form validation summary').locatedByTestId('visits-movement-form-validation-error'),
  SAVE_BUTTON: Target.the('Record Movement button').locatedByTestId('visits-movement-save-button'),
  CANCEL_BUTTON: Target.the('Movement cancel button').locatedByTestId('visits-movement-cancel-button'),
};

export const MovementProfessionalFinder = finder('Movement responsible professional selector', 'visits-movement-professional');

/** Confirmation required before a discharge or a cancellation closes the visit. */
export const ClosingConfirmation = messageDialog('Closing movement confirmation', 'visits-movement-confirm', 'proceed');
