import { test, expect, VISIT_UI_TAGS } from '../../../../fixtures/ui.fixture';
import { formatCpf, formatDateTime, parseDisplayedDateTime } from '../../helpers/format';
import { uniqueSuffix } from '../../helpers/unique';
import { ACTIVE_STATUSES, CLOSED_STATUSES, VISIT_STATUS_OPTIONS } from '../../helpers/visits';
import { Click } from '../../interactions/click';
import { Enter } from '../../interactions/enter';
import { Network } from '../../interactions/network';
import { Press } from '../../interactions/press';
import { Wait } from '../../interactions/wait';
import { TEST_DATA_PREFIX } from '../../payloads/person';
import { buildMovementForm } from '../../payloads/visit';
import { IsDisplayed, RenderedTestIds, TextOf, ValueOf } from '../../questions/generic';
import { TimelineMovements, VisitSummary } from '../../questions/visits';
import { ask, perform } from '../../screenplay/core';
import { EditVisitForm, ReadOnlyWarning, VisitDetails, VisitDetailsError, VisitDetailsSuccess, VisitsList } from '../../targets/visits';
import { aRegisteredPerson, aVisitInStatus } from '../../tasks/visit-preconditions';
import { AcknowledgeTheMessage, CancelTheEdit, FillTheEditForm, FilterVisits, OpenTheVisit, OpenVisitDetails, RecordMovement, SaveTheEdit, SelectVisit, StartEditingTheVisit, SubmitTheEditForm, WaitForTheVisitDetails, WaitForTheVisitList } from '../../tasks/visits';

test.describe('Visits UI | Visit details and edit', () => {
  test.describe('POSITIVE', () => {
    for (const status of ACTIVE_STATUSES) {
      test(`Offers Edit Visit and Add Movement while the visit is ${status} (7.4)`, {
        tag: [...VISIT_UI_TAGS, '@POSITIVE'],
      }, async ({ page }) => {
        const { patient, data } = await aVisitInStatus(page, status);

        await perform(page, OpenTheVisit.ofPatient(patient.name));

        await test.step('The summary shows the patient association and the status', async () => {
          const summary = await ask(page, VisitSummary());
          expect(summary?.patient).toBe(`${patient.name} · CPF ${formatCpf(patient.cpf)}`);
          expect(summary?.status).toBe(VISIT_STATUS_OPTIONS[status].label);
          expect(summary?.admission).toBe(formatDateTime(data.admission));
          expect(summary?.closedAt).toBe('—');
        });

        await test.step('Both actions are offered and no read-only warning is shown', async () => {
          expect(await ask(page, IsDisplayed.the(VisitDetails.EDIT_BUTTON))).toBe(true);
          expect(await ask(page, IsDisplayed.the(VisitDetails.ADD_MOVEMENT_BUTTON))).toBe(true);
          expect(await ask(page, IsDisplayed.the(ReadOnlyWarning.DIALOG))).toBe(false);
        });
      });

      test(`Edits type, professional, chief complaint and notes of an ${status} visit (AC 5)`, {
        tag: [...VISIT_UI_TAGS, '@POSITIVE', ...(status === 'OPEN' ? ['@SMOKE'] : [])],
      }, async ({ page }) => {
        const { patient, data } = await aVisitInStatus(page, status);
        const doctor = await aRegisteredPerson(page, ['DOCTOR']);
        const changes = {
          type: 'INPATIENT' as const,
          professionalName: doctor.name,
          chiefComplaint: `${TEST_DATA_PREFIX} Worsening pain ${uniqueSuffix()}`,
          notes: 'Transferred from a partner clinic',
        };

        await perform(page, OpenTheVisit.ofPatient(patient.name), StartEditingTheVisit());

        await test.step('The edit form starts with the current values', async () => {
          expect(await ask(page, ValueOf.the(EditVisitForm.TYPE_SELECT))).toBe(data.type);
          expect(await ask(page, ValueOf.the(EditVisitForm.CHIEF_COMPLAINT_INPUT))).toBe(data.chiefComplaint);
          expect(await ask(page, ValueOf.the(EditVisitForm.NOTES_INPUT))).toBe(data.notes);
        });

        await perform(page, FillTheEditForm.with(changes), SubmitTheEditForm());

        await test.step('The change is confirmed', async () => {
          await expect.poll(() => ask(page, TextOf.the(VisitDetailsSuccess.MESSAGE))).toBe('Visit updated successfully');
          await perform(page, AcknowledgeTheMessage.of(VisitDetailsSuccess), WaitForTheVisitDetails());
        });

        await test.step('The summary shows the new values and keeps patient, status and admission', async () => {
          expect(await ask(page, VisitSummary())).toEqual({
            status: VISIT_STATUS_OPTIONS[status].label,
            patient: `${patient.name} · CPF ${formatCpf(patient.cpf)}`,
            type: 'Inpatient',
            admission: formatDateTime(data.admission),
            professional: doctor.name,
            closedAt: '—',
            chiefComplaint: changes.chiefComplaint,
            notes: changes.notes,
          });
        });

        await test.step('The changes are persisted', async () => {
          await perform(page, OpenTheVisit.ofPatient(patient.name));
          const summary = await ask(page, VisitSummary());
          expect(summary?.type).toBe('Inpatient');
          expect(summary?.professional).toBe(doctor.name);
          expect(summary?.chiefComplaint).toBe(changes.chiefComplaint);
        });
      });
    }

    test('Shows the patient as read-only in the edit form (AC 5, rule 13)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartEditingTheVisit());

      await test.step('The patient is displayed as text, without any selector to change it', async () => {
        expect(await ask(page, TextOf.the(EditVisitForm.PATIENT))).toBe(patient.name);
        expect(await EditVisitForm.PATIENT.resolveFor(page).evaluate((element) => element.tagName)).not.toMatch(/^(INPUT|SELECT|TEXTAREA)$/);
        const editTestIds = (await ask(page, RenderedTestIds())).filter((testId) => testId.startsWith('visits-edit-patient'));
        expect(editTestIds).toEqual(['visits-edit-patient']);
      });
    });

    test('Removes the responsible professional', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const doctor = await aRegisteredPerson(page, ['DOCTOR']);
      const { patient } = await aVisitInStatus(page, 'OPEN', { professionalName: doctor.name });

      await perform(page, OpenTheVisit.ofPatient(patient.name));
      expect((await ask(page, VisitSummary()))?.professional).toBe(doctor.name);

      await perform(page, StartEditingTheVisit(), FillTheEditForm.with({ professionalName: '' }), SaveTheEdit());

      await test.step('The visit no longer has a responsible professional', async () => {
        expect((await ask(page, VisitSummary()))?.professional).toBe('Not assigned');
      });
    });

    test('Discards the changes when the edit is cancelled', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient, data } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartEditingTheVisit(), FillTheEditForm.with({ type: 'EMERGENCY', notes: 'Should not be saved' }), CancelTheEdit());

      await test.step('The summary still shows the original values', async () => {
        const summary = await ask(page, VisitSummary());
        expect(summary?.type).toBe('Outpatient');
        expect(summary?.notes).toBe(data.notes);
      });
    });

    test('Returns to the visit list from the details page', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), Click.on(VisitDetails.BACK_LINK), WaitForTheVisitList());

      await test.step('The visit list is displayed', async () => {
        expect(await ask(page, TextOf.the(VisitsList.TITLE))).toBe('Patient Visits');
      });
    });

    test('Shows a loading indicator while the visit loads (7.4)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const { visitId } = await aVisitInStatus(page, 'OPEN');

      await perform(page, SelectVisit.withId(visitId), Network.becomesSlow(), Click.on(VisitsList.VIEW_DETAILS_BUTTON));

      await test.step('The loading indicator is shown, then the summary', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitDetails.LOADING))).toContain('Loading visit...');
        await perform(page, Network.becomesNormal(), WaitForTheVisitDetails());
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Rejects a blank chief complaint in the edit form', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const { patient, data } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartEditingTheVisit(), Enter.theValue('   ').into(EditVisitForm.CHIEF_COMPLAINT_INPUT), SubmitTheEditForm());

      await test.step('The chief complaint is reported as required and the dialog stays open', async () => {
        await expect.poll(() => ask(page, TextOf.the(EditVisitForm.CHIEF_COMPLAINT_ERROR))).toBe('Chief complaint is required.');
        expect(await ask(page, TextOf.the(EditVisitForm.SUMMARY_ERROR))).toBe('Please correct the highlighted fields before saving.');
        expect(await ask(page, IsDisplayed.the(EditVisitForm.DIALOG))).toBe(true);
      });

      await test.step('After cancelling, the visit keeps its chief complaint', async () => {
        await perform(page, CancelTheEdit());
        expect((await ask(page, VisitSummary()))?.chiefComplaint).toBe(data.chiefComplaint);
      });
    });

    for (const status of CLOSED_STATUSES) {
      test(`Opens a ${status} visit with a read-only warning and its complete history (AC 11, 7.4)`, {
        tag: [...VISIT_UI_TAGS, '@NEGATIVE', ...(status === 'COMPLETED' ? ['@SMOKE'] : [])],
      }, async ({ page }) => {
        const { patient } = await aVisitInStatus(page, status);
        const label = VISIT_STATUS_OPTIONS[status].label;

        await perform(page, OpenTheVisit.ofPatient(patient.name));

        await test.step('A warning states that the visit was closed, when, and that it is read-only', async () => {
          const summary = await ask(page, VisitSummary());
          expect(parseDisplayedDateTime(summary?.closedAt ?? ''), `Closed at: ${summary?.closedAt}`).not.toBeNull();
          await expect.poll(() => ask(page, TextOf.the(ReadOnlyWarning.TITLE))).toBe('Read-only Visit');
          expect(await ask(page, TextOf.the(ReadOnlyWarning.MESSAGE))).toBe(`This visit was ${label.toLowerCase()} on ${summary?.closedAt}. It is read-only.`);
        });

        await perform(page, AcknowledgeTheMessage.of(ReadOnlyWarning));

        await test.step(`The visit is ${label} and neither Edit Visit nor Add Movement is offered`, async () => {
          expect((await ask(page, VisitSummary()))?.status).toBe(label);
          expect(await ask(page, IsDisplayed.the(VisitDetails.EDIT_BUTTON))).toBe(false);
          expect(await ask(page, IsDisplayed.the(VisitDetails.ADD_MOVEMENT_BUTTON))).toBe(false);
        });

        await test.step('The complete history remains available, ending with the closing movement', async () => {
          const types = (await ask(page, TimelineMovements())).map((movement) => movement.type);
          expect(types).toEqual(status === 'COMPLETED' ? ['Care Started', 'Discharge'] : ['Cancellation']);
        });
      });
    }

    test('Closes the read-only warning with Escape', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'CANCELLED');

      await perform(page, OpenTheVisit.ofPatient(patient.name), Wait.until(ReadOnlyWarning.DIALOG).isVisible(), Press.key('Escape'));

      await test.step('The warning is closed and the read-only details stay on screen', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(ReadOnlyWarning.DIALOG))).toBe(false);
        expect((await ask(page, VisitSummary()))?.status).toBe('Cancelled');
      });
    });

    test('Reports the conflict when another user closes the visit during an edit (AC 11)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page, anotherSession }) => {
      const { patient, data } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartEditingTheVisit(), FillTheEditForm.with({ notes: 'Edited too late' }));
      await perform(anotherSession, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(buildMovementForm('CANCELLATION')));
      await perform(page, SubmitTheEditForm());

      await test.step('The API conflict is reported', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitDetailsError.MESSAGE))).toContain('(409)');
        await perform(page, AcknowledgeTheMessage.of(VisitDetailsError));
      });

      await test.step('The page now shows the visit closed, read-only and without the edit', async () => {
        await expect.poll(async () => (await ask(page, VisitSummary()))?.status).toBe('Cancelled');
        expect(await ask(page, IsDisplayed.the(ReadOnlyWarning.DIALOG)), 'The conflict message already explains the change').toBe(false);
        expect(await ask(page, IsDisplayed.the(EditVisitForm.DIALOG))).toBe(false);
        expect(await ask(page, IsDisplayed.the(VisitDetails.EDIT_BUTTON))).toBe(false);
        expect((await ask(page, VisitSummary()))?.notes).toBe(data.notes);
      });
    });

    test('Offers a retry when the visit cannot be loaded', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      const { patient, visitId } = await aVisitInStatus(page, 'OPEN');

      await test.step('Open the details once so the page itself is already downloaded, then return without reloading', async () => {
        await perform(page, OpenVisitDetails.withId(visitId), Click.on(VisitDetails.BACK_LINK), WaitForTheVisitList(), FilterVisits.by({ patient: patient.name }));
      });

      await perform(page, SelectVisit.withId(visitId), Network.goesOffline(), Click.on(VisitsList.VIEW_DETAILS_BUTTON));

      await test.step('An error and a retry action are shown instead of the summary', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitDetailsError.MESSAGE))).toContain('Failed to load visit');
        await perform(page, AcknowledgeTheMessage.of(VisitDetailsError));
        expect(await ask(page, IsDisplayed.the(VisitDetails.LOAD_ERROR_STATE))).toBe(true);
        expect(await ask(page, IsDisplayed.the(VisitDetails.SUMMARY))).toBe(false);
      });

      await test.step('Retrying once the connection is back shows the visit', async () => {
        await perform(page, Network.comesBackOnline(), Click.on(VisitDetails.RETRY_BUTTON), Wait.until(VisitDetails.SUMMARY).isVisible());
        expect((await ask(page, VisitSummary()))?.patient).toContain(patient.name);
      });
    });
  });
});

