import { test, expect, VISIT_UI_TAGS } from '../../../../fixtures/ui.fixture';
import { formatCpf, formatDateTime, shiftDateTime } from '../../helpers/format';
import { uniqueSuffix } from '../../helpers/unique';
import { ACTIVE_STATUSES, CHIEF_COMPLAINT_MAX_LENGTH, NOTES_MAX_LENGTH, VISIT_STATUS_OPTIONS, VisitStatus } from '../../helpers/visits';
import { Click } from '../../interactions/click';
import { Clear, Enter } from '../../interactions/enter';
import { Network } from '../../interactions/network';
import { Select } from '../../interactions/select';
import { Wait } from '../../interactions/wait';
import { buildPersonForm, TEST_DATA_PREFIX } from '../../payloads/person';
import { buildVisitForm } from '../../payloads/visit';
import { IsDisplayed, RenderedTestIds, TextOf, TextsOf, ValueOf } from '../../questions/generic';
import { FinderResultIds, IdOfTheFinderResult, ListedVisitIds, NowInTheBrowser, VisitRow, VisitSummary } from '../../questions/visits';
import { ask, perform } from '../../screenplay/core';
import { Target } from '../../screenplay/target';
import { NewVisit, NewVisitError, PatientFinder, ProfessionalFinder, VisitDetails, VisitDetailsSuccess, VisitsList } from '../../targets/visits';
import { RegisterPerson } from '../../tasks/registration';
import { aRegisteredPatient, aRegisteredPerson, aVisitInStatus, minutesAgo } from '../../tasks/visit-preconditions';
import { AcknowledgeTheMessage, CancelTheFinder, ChooseInTheFinder, FillTheVisitForm, FindTheVisits, OpenPatientVisits, RegisterVisit, SearchInTheFinder, StartANewVisit, SubmitTheVisitForm, WaitForTheVisitDetails, WaitForTheVisitList } from '../../tasks/visits';

test.describe('Visits UI | New visit', () => {
  test.describe('POSITIVE', () => {
    test('Creates a visit with every field and opens its details (AC 1)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const doctor = await aRegisteredPerson(page, ['DOCTOR']);
      const data = buildVisitForm(patient.name, await minutesAgo(page, 90), { type: 'EMERGENCY', professionalName: doctor.name });

      await perform(page, OpenPatientVisits(), StartANewVisit(), FillTheVisitForm.with(data), SubmitTheVisitForm());

      await test.step('The details page of the new visit confirms the creation', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitDetailsSuccess.MESSAGE))).toBe('Visit created successfully');
        await perform(page, AcknowledgeTheMessage.of(VisitDetailsSuccess), WaitForTheVisitDetails());
      });

      await test.step('The summary shows the entered data, an Open status and no closing date', async () => {
        expect(await ask(page, VisitSummary())).toEqual({
          status: 'Open',
          patient: `${patient.name} · CPF ${formatCpf(patient.cpf)}`,
          type: 'Emergency',
          admission: formatDateTime(data.admission),
          professional: doctor.name,
          closedAt: '—',
          chiefComplaint: data.chiefComplaint,
          notes: data.notes,
        });
      });

      await test.step('Opening a visit does not imply that care has started: the history is empty (rule 4)', async () => {
        expect(await ask(page, TextOf.the(VisitDetails.TIMELINE_EMPTY))).toBe('No movements recorded yet.');
      });

      await test.step('The visit is listed with the same data', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name));
        const [visitId] = await ask(page, ListedVisitIds());
        expect(await ask(page, VisitRow.of(visitId))).toEqual({
          patient: patient.name,
          type: 'Emergency',
          admission: formatDateTime(data.admission),
          status: 'Open',
          professional: doctor.name,
        });
      });
    });

    test('Creates a visit with only the required fields, admitted now by default', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const chiefComplaint = `${TEST_DATA_PREFIX} Fever ${uniqueSuffix()}`;
      let prefilled!: string;

      await perform(page, OpenPatientVisits(), StartANewVisit());

      await test.step('The admission is prefilled with the current date and time', async () => {
        const now = await ask(page, NowInTheBrowser());
        prefilled = (await ask(page, ValueOf.the(NewVisit.ADMISSION_INPUT))) ?? '';
        expect([now, shiftDateTime(now, -1)]).toContain(prefilled);
      });

      await perform(
        page,
        ChooseInTheFinder.of(PatientFinder).named(patient.name),
        Select.option('OUTPATIENT').from(NewVisit.TYPE_SELECT),
        Enter.theValue(chiefComplaint).into(NewVisit.CHIEF_COMPLAINT_INPUT),
        SubmitTheVisitForm(),
        Wait.until(VisitDetailsSuccess.DIALOG).isVisible(),
        AcknowledgeTheMessage.of(VisitDetailsSuccess),
        WaitForTheVisitDetails(),
      );

      await test.step('Optional fields are shown as not informed', async () => {
        const summary = await ask(page, VisitSummary());
        expect(summary?.professional).toBe('Not assigned');
        expect(summary?.notes).toBe('—');
        expect(summary?.chiefComplaint).toBe(chiefComplaint);
        expect(summary?.admission).toBe(formatDateTime(prefilled));
      });
    });

    test('Offers the three visit types', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), StartANewVisit());

      await test.step('The type dropdown offers Outpatient, Emergency and Inpatient after its placeholder', async () => {
        const options = Target.the('Visit type options').locatedBy((current) => current.getByTestId('visits-type-select').locator('option'));
        expect(await ask(page, TextsOf.the(options))).toEqual(['Select a type', 'Outpatient', 'Emergency', 'Inpatient']);
      });
    });

    test('Lists only people holding the PATIENT role, including those with other roles (AC 19)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const token = `Selector ${uniqueSuffix()}`;
      const multiRolePatient = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Patient Doctor`, roles: ['PATIENT', 'DOCTOR'] });
      const doctor = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Doctor`, roles: ['DOCTOR'] });
      const nurse = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Nurse`, roles: ['NURSE'] });

      await perform(page, RegisterPerson.with(multiRolePatient), RegisterPerson.with(doctor), RegisterPerson.with(nurse));
      await perform(page, OpenPatientVisits(), StartANewVisit(), SearchInTheFinder.of(PatientFinder).byName(token));

      await test.step('Only the person holding PATIENT is offered', async () => {
        await expect.poll(async () => (await ask(page, FinderResultIds.of(PatientFinder))).length).toBe(1);
        expect(await ask(page, IdOfTheFinderResult.named(PatientFinder, multiRolePatient.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(PatientFinder, doctor.name))).toBeUndefined();
        expect(await ask(page, IdOfTheFinderResult.named(PatientFinder, nurse.name))).toBeUndefined();
      });
    });

    test('Finds a patient by CPF, with or without the mask', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);

      await perform(page, OpenPatientVisits(), StartANewVisit());

      for (const [label, cpf] of [['masked', formatCpf(patient.cpf)], ['digits only', patient.cpf]] as const) {
        await test.step(`Searching the ${label} CPF lists the patient`, async () => {
          await perform(page, SearchInTheFinder.of(PatientFinder).byCpf(cpf));
          await expect.poll(() => ask(page, IdOfTheFinderResult.named(PatientFinder, patient.name))).toBeTruthy();
          await perform(page, CancelTheFinder.of(PatientFinder));
        });
      }
    });

    test('Offers only professionals, never the visit patient, as responsible professional', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const token = `Staff ${uniqueSuffix()}`;
      const nursePatient = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Nurse Patient`, roles: ['PATIENT', 'NURSE'] });
      const doctor = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Doctor`, roles: ['DOCTOR'] });
      const patientOnly = buildPersonForm({ name: `${TEST_DATA_PREFIX} ${token} Patient`, roles: ['PATIENT'] });

      await perform(page, RegisterPerson.with(nursePatient), RegisterPerson.with(doctor), RegisterPerson.with(patientOnly));
      await perform(page, OpenPatientVisits(), StartANewVisit());

      await test.step('Before choosing a patient, every professional is offered, but not a patient-only person', async () => {
        await perform(page, SearchInTheFinder.of(ProfessionalFinder).byName(token));
        await expect.poll(() => ask(page, IdOfTheFinderResult.named(ProfessionalFinder, doctor.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(ProfessionalFinder, nursePatient.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(ProfessionalFinder, patientOnly.name))).toBeUndefined();
        await perform(page, CancelTheFinder.of(ProfessionalFinder));
      });

      await test.step('Once the nurse is the patient, she is no longer offered as her own professional', async () => {
        await perform(page, ChooseInTheFinder.of(PatientFinder).named(nursePatient.name), SearchInTheFinder.of(ProfessionalFinder).byName(token));
        await expect.poll(() => ask(page, IdOfTheFinderResult.named(ProfessionalFinder, doctor.name))).toBeTruthy();
        expect(await ask(page, IdOfTheFinderResult.named(ProfessionalFinder, nursePatient.name))).toBeUndefined();
      });
    });

    for (const status of ['COMPLETED', 'CANCELLED'] as const) {
      test(`Offers a patient whose previous visit is ${status} as available and opens a new visit (AC 23)`, {
        tag: [...VISIT_UI_TAGS, '@POSITIVE'],
      }, async ({ page }) => {
        const { patient } = await aVisitInStatus(page, status);

        await test.step('The patient is offered by the patient selector', async () => {
          await perform(page, OpenPatientVisits(), StartANewVisit(), SearchInTheFinder.of(PatientFinder).byName(patient.name));
          await expect.poll(() => ask(page, IdOfTheFinderResult.named(PatientFinder, patient.name))).toBeTruthy();
        });

        await perform(page, RegisterVisit.with(buildVisitForm(patient.name, await minutesAgo(page, 5))));

        await test.step('The patient now holds the closed visit and the new open one', async () => {
          await perform(page, FindTheVisits.ofPatient(patient.name));
          const statuses = [];

          for (const visitId of await ask(page, ListedVisitIds())) {
            statuses.push((await ask(page, VisitRow.of(visitId)))?.status);
          }

          expect(statuses.sort()).toEqual([VISIT_STATUS_OPTIONS[status].label, 'Open'].sort());
        });
      });
    }

    test('Does not let users register patients from the New Visit form (AC 24)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);

      await perform(page, OpenPatientVisits(), StartANewVisit(), SearchInTheFinder.of(PatientFinder).byName(patient.name));

      await test.step('Neither the form nor the patient selector offers to add, create or register a person', async () => {
        const buttons = Target.the('Buttons of the New Visit page').locatedBy((current) => current.getByTestId('visits-new-page').locator('button'));
        const labels = await ask(page, TextsOf.the(buttons));
        expect(labels.filter((label) => /add|new|create|register/i.test(label))).toEqual([]);
      });

      await test.step('No General Registration form or control is rendered', async () => {
        expect((await ask(page, RenderedTestIds())).filter((testId) => testId.startsWith('people-'))).toEqual([]);
      });
    });

    test('Cancel returns to the list without creating a visit', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);

      await perform(page, OpenPatientVisits(), StartANewVisit(), FillTheVisitForm.with(buildVisitForm(patient.name, await minutesAgo(page, 10))));
      await perform(page, Click.on(NewVisit.CANCEL_BUTTON), WaitForTheVisitList());

      await test.step('The list is displayed and the patient has no visit', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name));
        expect(await ask(page, ListedVisitIds())).toEqual([]);
      });
    });

    test('Accepts a chief complaint of exactly 500 characters (boundary)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const head = `${TEST_DATA_PREFIX} ${uniqueSuffix()} `;
      const chiefComplaint = head + 'x'.repeat(CHIEF_COMPLAINT_MAX_LENGTH - head.length);

      await perform(page, RegisterVisit.with(buildVisitForm(patient.name, await minutesAgo(page, 10), { chiefComplaint })));

      await test.step('The whole 500-character complaint is stored and shown', async () => {
        expect((await ask(page, VisitSummary()))?.chiefComplaint).toBe(chiefComplaint);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Requires a patient, a visit type and a chief complaint before saving', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@SMOKE'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), StartANewVisit(), SubmitTheVisitForm());

      await test.step('Each missing field is reported and the form stays open', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisit.validationError('patient')))).toBe('Patient is required.');
        expect(await ask(page, TextOf.the(NewVisit.validationError('type')))).toBe('Visit type is required.');
        expect(await ask(page, TextOf.the(NewVisit.validationError('chief-complaint')))).toBe('Chief complaint is required.');
        expect(await ask(page, TextOf.the(NewVisit.SUMMARY_ERROR))).toBe('Please correct the highlighted fields before saving.');
        expect(await ask(page, IsDisplayed.the(NewVisit.FORM))).toBe(true);
        expect(await ask(page, IsDisplayed.the(VisitDetails.PAGE))).toBe(false);
      });
    });

    test('Rejects a whitespace-only chief complaint (boundary)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);

      await perform(
        page,
        OpenPatientVisits(),
        StartANewVisit(),
        FillTheVisitForm.with(buildVisitForm(patient.name, await minutesAgo(page, 10), { chiefComplaint: '    ' })),
        SubmitTheVisitForm(),
      );

      await test.step('The chief complaint is reported as required and no visit is created', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisit.validationError('chief-complaint')))).toBe('Chief complaint is required.');
        await perform(page, FindTheVisits.ofPatient(patient.name));
        expect(await ask(page, ListedVisitIds())).toEqual([]);
      });
    });

    test('Rejects an admission date in the future', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);
      const inOneHour = shiftDateTime(await ask(page, NowInTheBrowser()), 60);

      await perform(
        page,
        OpenPatientVisits(),
        StartANewVisit(),
        FillTheVisitForm.with(buildVisitForm(patient.name, inOneHour)),
        SubmitTheVisitForm(),
      );

      await test.step('The admission is reported as being in the future and no visit is created', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisit.validationError('admission-date')))).toBe('Admission date cannot be in the future.');
        await perform(page, FindTheVisits.ofPatient(patient.name));
        expect(await ask(page, ListedVisitIds())).toEqual([]);
      });
    });

    test('Requires an admission date and time', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), StartANewVisit(), Clear.theValueOf(NewVisit.ADMISSION_INPUT), SubmitTheVisitForm());

      await test.step('The admission is reported as required', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisit.validationError('admission-date')))).toBe('Admission date and time are required.');
      });
    });

    for (const { field, target, limit } of [
      { field: 'chief complaint', target: NewVisit.CHIEF_COMPLAINT_INPUT, limit: CHIEF_COMPLAINT_MAX_LENGTH },
      { field: 'notes', target: NewVisit.NOTES_INPUT, limit: NOTES_MAX_LENGTH },
    ]) {
      test(`Never holds more than ${limit} characters in the ${field} (boundary)`, {
        tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
      }, async ({ page }) => {
        await perform(page, OpenPatientVisits(), StartANewVisit(), Enter.theValue('y'.repeat(limit + 1)).into(target));

        await test.step(`The field keeps at most ${limit} characters`, async () => {
          expect(((await ask(page, ValueOf.the(target))) ?? '').length).toBeLessThanOrEqual(limit);
        });
      });
    }

    test('Asks for at least three characters before searching a patient (boundary)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), StartANewVisit(), SearchInTheFinder.of(PatientFinder).byName('QA'));

      await test.step('Two characters are rejected with a message', async () => {
        await expect.poll(() => ask(page, TextOf.the(PatientFinder.SEARCH_ERROR))).toBe('Enter at least 3 characters.');
      });

      await test.step('Three characters are accepted', async () => {
        await perform(page, Enter.theValue(TEST_DATA_PREFIX.slice(0, 3)).into(PatientFinder.NAME_INPUT), Click.on(PatientFinder.SEARCH_BUTTON));
        await expect.poll(() => ask(page, IsDisplayed.the(PatientFinder.SEARCH_ERROR))).toBe(false);
      });
    });

    test('Asks to choose a result before confirming the patient selector', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const patient = await aRegisteredPatient(page);

      await perform(page, OpenPatientVisits(), StartANewVisit(), SearchInTheFinder.of(PatientFinder).byName(patient.name), Click.on(PatientFinder.SELECT_BUTTON));

      await test.step('A selection message is shown and the selector stays open', async () => {
        await expect.poll(() => ask(page, TextOf.the(PatientFinder.SELECTION_ERROR))).toBe('Select a record.');
        expect(await ask(page, IsDisplayed.the(PatientFinder.DIALOG))).toBe(true);
      });
    });

    for (const status of ACTIVE_STATUSES) {
      test(`Does not offer a patient with an ${status} visit for a new visit (AC 20, rule 2)`, {
        tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@SMOKE'],
      }, async ({ page }) => {
        const { patient } = await aVisitInStatus(page, status as VisitStatus);

        await perform(page, OpenPatientVisits(), StartANewVisit());

        for (const [label, search] of [['name', SearchInTheFinder.of(PatientFinder).byName(patient.name)], ['CPF', SearchInTheFinder.of(PatientFinder).byCpf(patient.cpf)]] as const) {
          await test.step(`Searching the patient by ${label} finds nobody`, async () => {
            await perform(page, search);
            await expect.poll(() => ask(page, TextOf.the(PatientFinder.EMPTY_STATE))).toBe('No patients found.');
            expect(await ask(page, IdOfTheFinderResult.named(PatientFinder, patient.name))).toBeUndefined();
            await perform(page, CancelTheFinder.of(PatientFinder));
          });
        }

        await test.step('The patient field stays empty', async () => {
          expect(await ask(page, ValueOf.the(PatientFinder.INPUT))).toBe('');
        });
      });
    }

    test('Shows the conflict when another user opens a visit for the same patient first (AC 21)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page, anotherSession }) => {
      const patient = await aRegisteredPatient(page);
      const mine = buildVisitForm(patient.name, await minutesAgo(page, 20));
      const theirs = buildVisitForm(patient.name, await minutesAgo(page, 15));

      await perform(page, OpenPatientVisits(), StartANewVisit(), FillTheVisitForm.with(mine));
      await perform(anotherSession, RegisterVisit.with(theirs));
      await perform(page, SubmitTheVisitForm());

      await test.step('The API conflict is reported', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisitError.MESSAGE))).toContain('(409)');
        expect(await ask(page, TextOf.the(NewVisitError.MESSAGE))).toContain('already has an active visit');
        await perform(page, AcknowledgeTheMessage.of(NewVisitError));
      });

      await test.step('The form now flags the patient as unavailable', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisit.validationError('patient')))).toBe('This patient already has an active visit.');
      });

      await test.step('Only the visit of the other user exists', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name));
        const visitIds = await ask(page, ListedVisitIds());
        expect(visitIds).toHaveLength(1);
        await perform(page, FindTheVisits.ofPatient(patient.name, { 'chief-complaint': theirs.chiefComplaint }));
        expect(await ask(page, ListedVisitIds())).toEqual(visitIds);
      });
    });

    test('Shows a loading indicator while patients and professionals load', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), Network.becomesSlow(), Click.on(VisitsList.NEW_BUTTON));

      await test.step('The loading indicator is shown, then the form', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisit.LOADING))).toContain('Loading patients...');
        await perform(page, Network.becomesNormal(), Wait.until(NewVisit.FORM).isVisible());
      });
    });

    test('Offers a retry when patients and professionals cannot be loaded', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      await test.step('Open the form once so the page itself is already downloaded', async () => {
        await perform(page, OpenPatientVisits(), StartANewVisit(), Click.on(NewVisit.BACK_LINK), WaitForTheVisitList());
      });

      await perform(page, Network.goesOffline(), Click.on(VisitsList.NEW_BUTTON));

      await test.step('An error and a retry action are shown instead of the form', async () => {
        await expect.poll(() => ask(page, TextOf.the(NewVisitError.MESSAGE))).toContain('Failed to load patients and professionals');
        await perform(page, AcknowledgeTheMessage.of(NewVisitError));
        expect(await ask(page, IsDisplayed.the(NewVisit.LOAD_ERROR_STATE))).toBe(true);
        expect(await ask(page, IsDisplayed.the(NewVisit.FORM))).toBe(false);
      });

      await test.step('Retrying once the connection is back shows the form', async () => {
        await perform(page, Network.comesBackOnline(), Click.on(NewVisit.RETRY_BUTTON), Wait.until(NewVisit.FORM).isVisible());
      });
    });
  });
});
