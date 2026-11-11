import { Page } from '@playwright/test';
import { test, expect, VISIT_UI_TAGS } from '../../../../fixtures/ui.fixture';
import { addDays, formatCpf, formatDateTime } from '../../helpers/format';
import { PersonFormData } from '../../helpers/models';
import { VisitFormData } from '../../helpers/visits';
import { Click } from '../../interactions/click';
import { Network } from '../../interactions/network';
import { Press } from '../../interactions/press';
import { Wait } from '../../interactions/wait';
import { buildPersonForm, TEST_DATA_PREFIX } from '../../payloads/person';
import { buildMovementForm, buildVisitForm } from '../../payloads/visit';
import { uniqueSuffix } from '../../helpers/unique';
import { RegisterPerson } from '../../tasks/registration';
import { IsDisplayed, IsEnabled, TextOf, ValueOf } from '../../questions/generic';
import { IdOfTheFinderResult, IsVisitRowSelected, ListedVisitIds, NowInTheBrowser, VisitRow, VisitSummary, VisitTableHeaders } from '../../questions/visits';
import { ask, perform } from '../../screenplay/core';
import { Dashboard } from '../../targets/dashboard';
import { FilterPatientFinder, FilterProfessionalFinder, ReadOnlyWarning, VisitDetails, VisitsFilter, VisitsList, VisitsListError } from '../../targets/visits';
import { OpenTheModule } from '../../tasks/navigation';
import { aRegisteredPatient, aRegisteredPerson, aVisit, anIdOfTheVisit, minutesAgo } from '../../tasks/visit-preconditions';
import { AcknowledgeTheMessage, CancelTheFinder, ClearTheVisitFilter, FilterVisits, FindTheVisits, OpenPatientVisits, OpenVisitDetails, RecordMovement, RegisterVisit, SearchInTheFinder, SelectVisit, VisitFilterCriteria, WaitForTheVisitDetails } from '../../tasks/visits';

interface VisitHistory {
  patient: PersonFormData;
  doctor: PersonFormData;
  older: { data: VisitFormData; id: string };
  newer: { data: VisitFormData; id: string };
}

/**
 * A patient with an older EMERGENCY visit, admitted three days ago, attended by
 * a doctor and already COMPLETED, and a newer OUTPATIENT visit admitted thirty
 * minutes ago and still OPEN. Each filter is checked by which of them remains.
 */
async function aPatientWithTwoVisits(page: Page): Promise<VisitHistory> {
  const patient = await aRegisteredPatient(page);
  const doctor = await aRegisteredPerson(page, ['DOCTOR']);
  const older = buildVisitForm(patient.name, await minutesAgo(page, 3 * 24 * 60), { type: 'EMERGENCY', professionalName: doctor.name });
  const newer = buildVisitForm(patient.name, await minutesAgo(page, 30), { type: 'OUTPATIENT' });

  await perform(
    page,
    RegisterVisit.with(older),
    RecordMovement.with(buildMovementForm('CARE_STARTED')),
    RecordMovement.with(buildMovementForm('DISCHARGE')),
    RegisterVisit.with(newer),
  );

  return {
    patient,
    doctor,
    older: { data: older, id: await anIdOfTheVisit(page, older) },
    newer: { data: newer, id: await anIdOfTheVisit(page, newer) },
  };
}

/** IDs listed after opening the list and applying the criteria. */
async function listedWith(page: Page, criteria: VisitFilterCriteria): Promise<string[]> {
  await perform(page, OpenPatientVisits(), FilterVisits.by(criteria));

  return ask(page, ListedVisitIds());
}

test.describe('Visits UI | Visit list', () => {
  test.describe('POSITIVE', () => {
    test('Shows patient, type, admission, status and responsible professional of a visit (7.2)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const nurse = await aRegisteredPerson(page, ['NURSE']);
      const data = buildVisitForm(patient.name, await minutesAgo(page, 45), { type: 'INPATIENT', professionalName: nurse.name });
      const visitId = await aVisit(page, data);

      await test.step('The table has the documented columns', async () => {
        expect(await ask(page, VisitTableHeaders())).toEqual(['Patient', 'Type', 'Admission', 'Status', 'Responsible Professional']);
      });

      await test.step('The row shows the visit data', async () => {
        expect(await ask(page, VisitRow.of(visitId))).toEqual({
          patient: patient.name,
          type: 'Inpatient',
          admission: formatDateTime(data.admission),
          status: 'Open',
          professional: nurse.name,
        });
      });
    });

    test('Identifies each row by its visit without displaying the identifier (7.2, 7.5)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const data = buildVisitForm(patient.name, await minutesAgo(page, 10));
      const visitId = await aVisit(page, data);

      await test.step('The row does not show the visit identifier to the user', async () => {
        const rowText = (await ask(page, TextOf.the(VisitsList.row(visitId)))) ?? '';
        expect(rowText.toLowerCase(), `Row text: "${rowText}"`).not.toContain(visitId.toLowerCase());
      });

      await test.step('The identifier of the row is the one of the visit it shows', async () => {
        await perform(page, OpenVisitDetails.withId(visitId));
        expect((await ask(page, VisitSummary()))?.chiefComplaint).toBe(data.chiefComplaint);
      });
    });

    test('Shows a dash when no responsible professional is assigned', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const visitId = await aVisit(page, buildVisitForm(patient.name, await minutesAgo(page, 45)));

      await test.step('The professional cell shows a dash', async () => {
        expect((await ask(page, VisitRow.of(visitId)))?.professional).toBe('—');
      });
    });

    test('Lists the visits of a patient newest admission first (AC 4)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const history = await aPatientWithTwoVisits(page);

      await test.step('The newer visit is listed before the older one', async () => {
        expect(await listedWith(page, { patient: history.patient.name })).toEqual([history.newer.id, history.older.id]);
      });

      await test.step('The pagination summary counts both visits', async () => {
        expect(await ask(page, TextOf.the(VisitsList.PAGINATION_INFO))).toBe('1–2 of 2');
      });
    });

    test('Filters by a patient found in the filter by part of the name, ignoring case', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const history = await aPatientWithTwoVisits(page);
      const part = history.patient.name.slice(-8).toUpperCase();

      await test.step('Both visits of the patient are listed, and only them', async () => {
        const listed = await listedWith(page, { patient: history.patient.name, patientSearch: { name: part } });
        expect(listed.sort()).toEqual([history.newer.id, history.older.id].sort());
      });
    });

    for (const [label, format] of [['masked', formatCpf], ['digits-only', (cpf: string) => cpf]] as const) {
      test(`Filters by a patient found in the filter by ${label} CPF`, {
        tag: [...VISIT_UI_TAGS, '@POSITIVE'],
      }, async ({ page }) => {
        const history = await aPatientWithTwoVisits(page);

        await test.step('Both visits of the patient are listed, and only them', async () => {
          const listed = await listedWith(page, { patient: history.patient.name, patientSearch: { cpf: format(history.patient.cpf) } });
          expect(listed.sort()).toEqual([history.newer.id, history.older.id].sort());
        });
      });
    }

    test('Filters by visit type and by status (AC 4)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const history = await aPatientWithTwoVisits(page);
      const name = history.patient.name;

      await test.step('EMERGENCY lists only the older visit, OUTPATIENT only the newer one', async () => {
        expect(await listedWith(page, { patient: name, type: 'EMERGENCY' })).toEqual([history.older.id]);
        expect(await listedWith(page, { patient: name, type: 'OUTPATIENT' })).toEqual([history.newer.id]);
        expect(await listedWith(page, { patient: name, type: 'INPATIENT' })).toEqual([]);
      });

      await test.step('COMPLETED lists only the older visit, OPEN only the newer one', async () => {
        expect(await listedWith(page, { patient: name, status: 'COMPLETED' })).toEqual([history.older.id]);
        expect(await listedWith(page, { patient: name, status: 'OPEN' })).toEqual([history.newer.id]);
        expect(await listedWith(page, { patient: name, status: 'CANCELLED' })).toEqual([]);
      });
    });

    test('Filters by admission date range (AC 4)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const history = await aPatientWithTwoVisits(page);
      const today = (await ask(page, NowInTheBrowser())).slice(0, 10);
      const name = history.patient.name;

      await test.step('From yesterday lists only the newer visit', async () => {
        expect(await listedWith(page, { patient: name, admissionFrom: addDays(today, -1) })).toEqual([history.newer.id]);
      });

      await test.step('Up to two days ago lists only the older visit', async () => {
        expect(await listedWith(page, { patient: name, admissionTo: addDays(today, -2) })).toEqual([history.older.id]);
      });

      await test.step('A single day equal to the older admission date lists it: both bounds are inclusive', async () => {
        const olderDay = history.older.data.admission.slice(0, 10);
        expect(await listedWith(page, { patient: name, admissionFrom: olderDay, admissionTo: olderDay })).toEqual([history.older.id]);
      });
    });

    test('Filters by responsible professional and by chief complaint', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const history = await aPatientWithTwoVisits(page);

      await test.step('The doctor attending the older visit lists only it', async () => {
        expect(await listedWith(page, { professional: history.doctor.name })).toEqual([history.older.id]);
      });

      await test.step('Part of the newer chief complaint lists only the newer visit', async () => {
        expect(await listedWith(page, { 'chief-complaint': history.newer.data.chiefComplaint.slice(-8) })).toEqual([history.newer.id]);
      });
    });

    test('Offers only patients in the patient filter and only professionals in the professional filter', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const token = `Filter ${uniqueSuffix()}`;
      const patientOnly = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Patient`, roles: ['PATIENT'] });
      const nursePatient = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Nurse Patient`, roles: ['PATIENT', 'NURSE'] });
      const doctor = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Doctor`, roles: ['DOCTOR'] });

      await perform(page, RegisterPerson.with(patientOnly), RegisterPerson.with(nursePatient), RegisterPerson.with(doctor));
      await perform(page, OpenPatientVisits(), Click.on(VisitsFilter.OPEN_BUTTON), Wait.until(VisitsFilter.DIALOG).isVisible());

      await test.step('The patient filter offers the people holding PATIENT, including a nurse who is a patient', async () => {
        await perform(page, SearchInTheFinder.of(FilterPatientFinder).byName(token));
        await expect.poll(() => ask(page, IdOfTheFinderResult.named(FilterPatientFinder, patientOnly.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(FilterPatientFinder, nursePatient.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(FilterPatientFinder, doctor.name))).toBeUndefined();
        await perform(page, CancelTheFinder.of(FilterPatientFinder));
      });

      await test.step('The professional filter offers the doctor and the nurse, never a patient-only person', async () => {
        await perform(page, SearchInTheFinder.of(FilterProfessionalFinder).byName(token));
        await expect.poll(() => ask(page, IdOfTheFinderResult.named(FilterProfessionalFinder, doctor.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(FilterProfessionalFinder, nursePatient.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(FilterProfessionalFinder, patientOnly.name))).toBeUndefined();
      });
    });

    test('Combines filters and shows how many are active, until they are cleared', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const history = await aPatientWithTwoVisits(page);

      await test.step('Patient, type and status together narrow the list to one visit', async () => {
        expect(await listedWith(page, { patient: history.patient.name, type: 'EMERGENCY', status: 'COMPLETED' })).toEqual([history.older.id]);
        expect(await ask(page, TextOf.the(VisitsFilter.ACTIVE_COUNT))).toBe('3');
      });

      await test.step('Clearing the patient in its finder removes only that criterion', async () => {
        await perform(
          page,
          Click.on(VisitsFilter.OPEN_BUTTON),
          Wait.until(VisitsFilter.DIALOG).isVisible(),
          Click.on(FilterPatientFinder.CLEAR_BUTTON),
          Click.on(VisitsFilter.APPLY_BUTTON),
          Wait.until(VisitsFilter.DIALOG).isHidden(),
          Wait.until(VisitsList.LOADING).isHidden(),
        );
        expect(await ask(page, TextOf.the(VisitsFilter.ACTIVE_COUNT))).toBe('2');
      });

      await test.step('Clearing removes every criterion', async () => {
        await perform(page, ClearTheVisitFilter());
        expect(await ask(page, IsDisplayed.the(VisitsFilter.ACTIVE_COUNT))).toBe(false);
        await perform(page, Click.on(VisitsFilter.OPEN_BUTTON), Wait.until(VisitsFilter.DIALOG).isVisible());
        expect(await ask(page, ValueOf.the(FilterPatientFinder.INPUT))).toBe('');
        expect(await ask(page, ValueOf.the(VisitsFilter.TYPE_SELECT))).toBe('');
        expect(await ask(page, ValueOf.the(VisitsFilter.STATUS_SELECT))).toBe('');
      });
    });

    test('View Details needs a selected visit and opens the selected one', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const history = await aPatientWithTwoVisits(page);

      await perform(page, FindTheVisits.ofPatient(history.patient.name));

      await test.step('View Details is disabled while nothing is selected', async () => {
        expect(await ask(page, IsEnabled.the(VisitsList.VIEW_DETAILS_BUTTON))).toBe(false);
      });

      await test.step('Selecting the older visit enables View Details, which opens that visit', async () => {
        await perform(page, SelectVisit.withId(history.older.id));
        expect(await ask(page, IsEnabled.the(VisitsList.VIEW_DETAILS_BUTTON))).toBe(true);
        await perform(page, Click.on(VisitsList.VIEW_DETAILS_BUTTON), WaitForTheVisitDetails());
        expect((await ask(page, VisitSummary()))?.chiefComplaint).toBe(history.older.data.chiefComplaint);
      });

      await test.step('The older visit is completed, so it opens with the read-only warning', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(ReadOnlyWarning.DIALOG))).toBe(true);
        await perform(page, AcknowledgeTheMessage.of(ReadOnlyWarning));
      });
    });

    test('Escape clears the selected visit', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const visitId = await aVisit(page, buildVisitForm(patient.name, await minutesAgo(page, 10)));

      await perform(page, SelectVisit.withId(visitId), Press.key('Escape'));

      await test.step('The row is no longer selected and View Details is disabled again', async () => {
        await expect.poll(() => ask(page, IsVisitRowSelected.of(visitId))).toBe(false);
        expect(await ask(page, IsEnabled.the(VisitsList.VIEW_DETAILS_BUTTON))).toBe(false);
      });
    });

    test('Shows a loading indicator while visits load (7.2)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), Click.on(VisitsList.BACK_LINK), Wait.until(Dashboard.PAGE).isVisible());
      await perform(page, Network.becomesSlow(), OpenTheModule.withId('patient-visits'));

      await test.step('The loading indicator is shown, then the table', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitsList.LOADING))).toContain('Loading visits...');
        await perform(page, Network.becomesNormal(), Wait.until(VisitsList.LOADING).isHidden());
        expect(await ask(page, IsDisplayed.the(VisitsList.TABLE))).toBe(true);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Shows an empty-state message when no visit matches the filter (7.2)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      await test.step('Filter by a chief complaint nobody has', async () => {
        expect(await listedWith(page, { 'chief-complaint': `No such complaint ${Date.now()}` })).toEqual([]);
      });

      await test.step('The filtered empty-state message is shown', async () => {
        expect(await ask(page, TextOf.the(VisitsList.EMPTY_STATE))).toBe('No visits match the current filter.');
      });
    });

    test('Rejects an admission range that starts after it ends (boundary)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const today = (await ask(page, NowInTheBrowser())).slice(0, 10);

      await perform(page, OpenPatientVisits(), FilterVisits.by({ admissionFrom: today, admissionTo: addDays(today, -1) }));

      await test.step('The range is reported as invalid and nothing is listed', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitsListError.MESSAGE))).toBe('Admitted From must be on or before Admitted To.');
        await perform(page, AcknowledgeTheMessage.of(VisitsListError));
        expect(await ask(page, ListedVisitIds())).toEqual([]);
      });
    });

    test('Shows an error state when visits cannot be loaded (7.2)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      await test.step('Open the list once so the page itself is already downloaded', async () => {
        await perform(page, OpenPatientVisits(), Click.on(VisitsList.BACK_LINK), Wait.until(Dashboard.PAGE).isVisible());
      });

      await perform(page, Network.goesOffline(), OpenTheModule.withId('patient-visits'));

      await test.step('An error is reported and the list explains that visits could not be loaded', async () => {
        // Visits and the people offered by the filter finders load in parallel; the page shows one error message.
        await expect.poll(() => ask(page, TextOf.the(VisitsListError.MESSAGE))).toMatch(/Failed to load (visits|patients and professionals)/);
        await perform(page, AcknowledgeTheMessage.of(VisitsListError));
        expect(await ask(page, TextOf.the(VisitsList.EMPTY_STATE))).toBe('Visits could not be loaded.');
        expect(await ask(page, IsDisplayed.the(VisitDetails.PAGE))).toBe(false);
      });

      await perform(page, Network.comesBackOnline());
    });
  });
});
