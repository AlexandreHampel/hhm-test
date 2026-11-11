import { expect } from '@playwright/test';
import { Uncheck } from '../interactions/check';
import { Click } from '../interactions/click';
import { Clear, Enter } from '../interactions/enter';
import { Select } from '../interactions/select';
import { Wait } from '../interactions/wait';
import { CLOSING_MOVEMENTS, MovementFormData, VisitEditData, VisitFormData, VisitStatus, VisitType } from '../helpers/visits';
import { IsDisplayed, TextOf } from '../questions/generic';
import { IdOfTheFinderResult, IdOfTheListedVisit, IsVisitRowSelected } from '../questions/visits';
import { askUntilPresent, perform, Performable, task, taskWhere } from '../screenplay/core';
import { ClosingConfirmation, EditProfessionalFinder, EditVisitForm, FilterPatientFinder, FilterProfessionalFinder, FinderTargets, MovementForm, MovementProfessionalFinder, NewVisit, NewVisitError, PatientFinder, ProfessionalFinder, VisitDetails, VisitDetailsError, VisitDetailsSuccess, VisitFilterDateField, VisitFilterTextField, VisitMessageDialog, VisitsFilter, VisitsList } from '../targets/visits';
import { OpenTheDashboard, OpenTheModule } from './navigation';

// ---------- Navigation ----------

/** Waits for the visit list to finish loading. */
export const WaitForTheVisitList = () => task('Wait for the visit list', Wait.until(VisitsList.TABLE).isVisible(), Wait.until(VisitsList.LOADING).isHidden());

/** Opens Patient Visits from its dashboard card, the only way in: its routes redirect direct access to the landing page. */
export const OpenPatientVisits = () =>
  task('Open Patient Visits', OpenTheDashboard(), OpenTheModule.withId('patient-visits'), Wait.until(VisitsList.PAGE).isVisible(), WaitForTheVisitList());

/** Waits until the details page has loaded its summary. */
export const WaitForTheVisitDetails = () =>
  task('Wait for the visit details', Wait.until(VisitDetails.PAGE).isVisible(), Wait.until(VisitDetails.LOADING).isHidden(), Wait.until(VisitDetails.SUMMARY).isVisible());

// ---------- Visit list ----------

/** How a person is searched in a finder before choosing the result that shows the person's name. */
export type FinderSearch = { name: string } | { cpf: string };

/**
 * Filter criteria of the visit list. The patient and the professional are the
 * names of the people to choose in the filter finders; by default they are
 * searched by their full name. Dates are browser-local `YYYY-MM-DD` days.
 */
export type VisitFilterCriteria = Partial<Record<VisitFilterTextField, string>> & {
  patient?: string;
  patientSearch?: FinderSearch;
  professional?: string;
  type?: VisitType;
  status?: VisitStatus;
  admissionFrom?: string;
  admissionTo?: string;
};

/** Fills the filter dialog fields for the given criteria, choosing people through the filter finders. */
function filterEntries(criteria: VisitFilterCriteria): Performable[] {
  const entries: Performable[] = [];

  if (criteria.patient !== undefined) {
    entries.push(ChooseInTheFinder.of(FilterPatientFinder).named(criteria.patient, criteria.patientSearch));
  }

  if (criteria.professional !== undefined) {
    entries.push(ChooseInTheFinder.of(FilterProfessionalFinder).named(criteria.professional));
  }

  if (criteria.type !== undefined) {
    entries.push(Select.option(criteria.type).from(VisitsFilter.TYPE_SELECT));
  }

  if (criteria.status !== undefined) {
    entries.push(Select.option(criteria.status).from(VisitsFilter.STATUS_SELECT));
  }

  for (const [key, field] of [['admissionFrom', 'admission-from'], ['admissionTo', 'admission-to']] as const) {
    if (criteria[key] !== undefined) {
      entries.push(Enter.theValue(criteria[key]!).into(VisitsFilter.dateInput(field as VisitFilterDateField)));
    }
  }

  if (criteria['chief-complaint'] !== undefined) {
    entries.push(Enter.theValue(criteria['chief-complaint']).into(VisitsFilter.input('chief-complaint')));
  }

  return entries;
}

/** Applies filter criteria through the filter dialog. Criteria not given keep their current value. */
export const FilterVisits = {
  by: (criteria: VisitFilterCriteria) => {
    const entries = filterEntries(criteria);

    return task(
      `Filter visits by ${Object.keys(criteria).filter((key) => key !== 'patientSearch').join(' and ')}`,
      Click.on(VisitsFilter.OPEN_BUTTON),
      Wait.until(VisitsFilter.DIALOG).isVisible(),
      ...entries,
      Click.on(VisitsFilter.APPLY_BUTTON),
      Wait.until(VisitsFilter.DIALOG).isHidden(),
      Wait.until(VisitsList.LOADING).isHidden(),
    );
  },
};

export const ClearTheVisitFilter = () =>
  task(
    'Clear the visit filter',
    Click.on(VisitsFilter.OPEN_BUTTON),
    Wait.until(VisitsFilter.DIALOG).isVisible(),
    Click.on(VisitsFilter.CLEAR_BUTTON),
    Wait.until(VisitsFilter.DIALOG).isHidden(),
    Wait.until(VisitsList.LOADING).isHidden(),
  );

/** Opens the list narrowed to the visits of one patient, chosen in the patient filter finder. */
export const FindTheVisits = {
  ofPatient: (patientName: string, criteria: VisitFilterCriteria = {}) =>
    task(`Find the visits of ${patientName}`, OpenPatientVisits(), FilterVisits.by({ patient: patientName, ...criteria })),
};

/** Selects a listed visit, waiting until the row shows it is selected. */
export const SelectVisit = {
  withId: (visitId: string) =>
    taskWhere(`Select visit ${visitId}`, async (page) => {
      await perform(page, Click.on(VisitsList.row(visitId)));
      await expect.poll(() => IsVisitRowSelected.of(visitId).answeredBy(page)).toBe(true);
    }),
};

/** Selects a listed visit and opens its details. */
export const OpenVisitDetails = {
  withId: (visitId: string) => task(`Open the details of visit ${visitId}`, SelectVisit.withId(visitId), Click.on(VisitsList.VIEW_DETAILS_BUTTON), WaitForTheVisitDetails()),
};

/** Finds the only visit of the patient matching the criteria and opens its details. */
export const OpenTheVisit = {
  ofPatient: (patientName: string, criteria: VisitFilterCriteria = {}) =>
    taskWhere(`Open the visit of ${patientName}`, async (page) => {
      await perform(page, FindTheVisits.ofPatient(patientName, criteria));
      const visitId = await askUntilPresent(page, IdOfTheListedVisit.ofPatient(patientName));
      await perform(page, OpenVisitDetails.withId(visitId));
    }),
};

// ---------- Person selectors ----------

export const SearchInTheFinder = {
  of: (finder: FinderTargets) => ({
    by: (search: FinderSearch) => ('cpf' in search ? SearchInTheFinder.of(finder).byCpf(search.cpf) : SearchInTheFinder.of(finder).byName(search.name)),
    byName: (text: string) =>
      task(`Search "${text}" by name in the ${finder.DIALOG}`, Click.on(finder.OPEN_BUTTON), Wait.until(finder.DIALOG).isVisible(), Enter.theValue(text).into(finder.NAME_INPUT), Click.on(finder.SEARCH_BUTTON)),
    byCpf: (text: string) =>
      task(`Search "${text}" by CPF in the ${finder.DIALOG}`, Click.on(finder.OPEN_BUTTON), Wait.until(finder.DIALOG).isVisible(), Enter.theValue(text).into(finder.CPF_INPUT), Click.on(finder.SEARCH_BUTTON)),
  }),
};

/** Searches a person (by default by its full name) and selects the result showing exactly that name. */
export const ChooseInTheFinder = {
  of: (finder: FinderTargets) => ({
    named: (name: string, search: FinderSearch = { name }) =>
      taskWhere(`Choose ${name} in the ${finder.INPUT}`, async (page) => {
        await perform(page, SearchInTheFinder.of(finder).by(search));
        const personId = await askUntilPresent(page, IdOfTheFinderResult.named(finder, name));
        await perform(page, Click.on(finder.row(personId)), Click.on(finder.SELECT_BUTTON), Wait.until(finder.DIALOG).isHidden());
      }),
  }),
};

export const CancelTheFinder = {
  of: (finder: FinderTargets) => task(`Cancel the ${finder.DIALOG}`, Click.on(finder.CANCEL_BUTTON), Wait.until(finder.DIALOG).isHidden()),
};

// ---------- New visit ----------

/** Opens the New Visit form and waits until the patients and professionals are loaded into it. */
export const StartANewVisit = () =>
  task('Start a new visit', Click.on(VisitsList.NEW_BUTTON), Wait.until(NewVisit.PAGE).isVisible(), Wait.until(NewVisit.FORM).isVisible());

/** Fills the New Visit form. Empty values leave the field empty: an empty professional is not assigned. */
export const FillTheVisitForm = {
  with: (data: VisitFormData) =>
    task(
      `Fill the New Visit form for ${data.patientName || 'no patient'}`,
      ...(data.patientName ? [ChooseInTheFinder.of(PatientFinder).named(data.patientName)] : []),
      Select.option(data.type).from(NewVisit.TYPE_SELECT),
      ...(data.professionalName ? [ChooseInTheFinder.of(ProfessionalFinder).named(data.professionalName)] : []),
      Enter.theValue(data.admission).into(NewVisit.ADMISSION_INPUT),
      Enter.theValue(data.chiefComplaint).into(NewVisit.CHIEF_COMPLAINT_INPUT),
      Enter.theValue(data.notes).into(NewVisit.NOTES_INPUT),
    ),
};

/** Clicks Save Visit without expecting any outcome. */
export const SubmitTheVisitForm = () => task('Submit the New Visit form', Click.on(NewVisit.SAVE_BUTTON));

/**
 * Creates a visit through the New Visit form, from the dashboard to
 * acknowledging the success message on the details page it opens. It is how
 * scenarios prepare the visits they need.
 */
export const RegisterVisit = {
  with: (data: VisitFormData) =>
    taskWhere(`Register a visit for ${data.patientName} through the form`, async (page) => {
      await perform(page, OpenPatientVisits(), StartANewVisit(), FillTheVisitForm.with(data), SubmitTheVisitForm());

      await expect
        .poll(async () => (await IsDisplayed.the(VisitDetailsSuccess.DIALOG).answeredBy(page)) || (await IsDisplayed.the(NewVisitError.DIALOG).answeredBy(page)), {
          message: `Waiting for the outcome of registering a visit for ${data.patientName}`,
        })
        .toBe(true);

      const error = await TextOf.the(NewVisitError.MESSAGE).answeredBy(page);

      if (error) {
        throw new Error(`Registering a visit for ${data.patientName} failed: ${error}`);
      }

      await perform(page, WaitForTheVisitDetails(), AcknowledgeTheMessage.of(VisitDetailsSuccess));
    }),
};

// ---------- Details: edit ----------

export const StartEditingTheVisit = () => task('Start editing the visit', Click.on(VisitDetails.EDIT_BUTTON), Wait.until(EditVisitForm.DIALOG).isVisible());

/** Changes the given editable fields. An empty professional name clears the assignment. */
export const FillTheEditForm = {
  with: (changes: Partial<VisitEditData>) =>
    task(
      `Change ${Object.keys(changes).join(', ')} of the visit`,
      ...(changes.type ? [Select.option(changes.type).from(EditVisitForm.TYPE_SELECT)] : []),
      ...(changes.professionalName === undefined
        ? []
        : changes.professionalName
          ? [ChooseInTheFinder.of(EditProfessionalFinder).named(changes.professionalName)]
          : [Click.on(EditProfessionalFinder.CLEAR_BUTTON)]),
      ...(changes.chiefComplaint === undefined ? [] : [Enter.theValue(changes.chiefComplaint).into(EditVisitForm.CHIEF_COMPLAINT_INPUT)]),
      ...(changes.notes === undefined ? [] : [Enter.theValue(changes.notes).into(EditVisitForm.NOTES_INPUT)]),
    ),
};

export const SubmitTheEditForm = () => task('Submit the Edit Visit form', Click.on(EditVisitForm.SAVE_BUTTON));

export const SaveTheEdit = () =>
  task('Save the visit changes', SubmitTheEditForm(), Wait.until(EditVisitForm.DIALOG).isHidden(), Wait.until(VisitDetailsSuccess.MESSAGE).isVisible(), AcknowledgeTheMessage.of(VisitDetailsSuccess));

export const CancelTheEdit = () => task('Cancel the visit edit', Click.on(EditVisitForm.CANCEL_BUTTON), Wait.until(EditVisitForm.DIALOG).isHidden());

// ---------- Details: movements ----------

export const StartAddingAMovement = () => task('Start adding a movement', Click.on(VisitDetails.ADD_MOVEMENT_BUTTON), Wait.until(MovementForm.DIALOG).isVisible());

/** Fills the Add Movement form. Without `occurredAt` the current date and time are kept. */
export const FillTheMovementForm = {
  with: (movement: MovementFormData) =>
    task(
      `Fill a ${movement.type} movement`,
      Select.option(movement.type).from(MovementForm.TYPE_SELECT),
      ...(movement.occurredAt ? [Uncheck.the(MovementForm.USE_CURRENT_TIME_CHECKBOX), Enter.theValue(movement.occurredAt).into(MovementForm.OCCURRED_AT_INPUT)] : []),
      ...(movement.departmentFrom !== undefined ? [Enter.theValue(movement.departmentFrom).into(MovementForm.DEPARTMENT_FROM_INPUT)] : []),
      ...(movement.departmentTo !== undefined ? [Enter.theValue(movement.departmentTo).into(MovementForm.DEPARTMENT_TO_INPUT)] : []),
      ...(movement.professionalName ? [ChooseInTheFinder.of(MovementProfessionalFinder).named(movement.professionalName)] : []),
      ...(movement.description !== undefined ? [Enter.theValue(movement.description).into(MovementForm.DESCRIPTION_INPUT)] : []),
    ),
};

export const SubmitTheMovementForm = () => task('Submit the movement form', Click.on(MovementForm.SAVE_BUTTON));

export const CancelTheMovementForm = () => task('Cancel the movement form', Click.on(MovementForm.CANCEL_BUTTON), Wait.until(MovementForm.DIALOG).isHidden());

export const ConfirmTheClosingMovement = () => task('Confirm the closing movement', Click.on(ClosingConfirmation.CONFIRM_BUTTON));

export const GoBackFromTheClosingConfirmation = () =>
  task('Go back from the closing confirmation', Click.on(ClosingConfirmation.CANCEL_BUTTON), Wait.until(ClosingConfirmation.DIALOG).isHidden());

/** Records a movement from the details page, confirming it when it closes the visit, up to acknowledging the success message. */
export const RecordMovement = {
  with: (movement: MovementFormData) =>
    taskWhere(`Record a ${movement.type} movement`, async (page) => {
      await perform(page, StartAddingAMovement(), FillTheMovementForm.with(movement), SubmitTheMovementForm());

      if (movement.type in CLOSING_MOVEMENTS) {
        await perform(page, Wait.until(ClosingConfirmation.DIALOG).isVisible(), ConfirmTheClosingMovement());
      }

      await expect
        .poll(async () => (await IsDisplayed.the(VisitDetailsSuccess.DIALOG).answeredBy(page)) || (await IsDisplayed.the(VisitDetailsError.DIALOG).answeredBy(page)), {
          message: `Waiting for the outcome of recording a ${movement.type} movement`,
        })
        .toBe(true);

      const error = await TextOf.the(VisitDetailsError.MESSAGE).answeredBy(page);

      if (error) {
        throw new Error(`Recording a ${movement.type} movement failed: ${error}`);
      }

      await perform(page, AcknowledgeTheMessage.of(VisitDetailsSuccess), WaitForTheVisitDetails());
    }),
};

// ---------- Messages ----------

export const AcknowledgeTheMessage = {
  of: (dialog: VisitMessageDialog) => task(`Acknowledge the ${dialog.DIALOG}`, Click.on(dialog.CONFIRM_BUTTON), Wait.until(dialog.DIALOG).isHidden()),
};

/** Empties a text field, for validation scenarios. */
export const EmptyTheField = {
  of: (target: Parameters<typeof Clear.theValueOf>[0]) => task(`Empty the ${target}`, Clear.theValueOf(target)),
};
