import { test, expect, VISIT_UI_TAGS } from '../../../../fixtures/ui.fixture';
import { formatDateTime, parseDisplayedDateTime, shiftDateTime } from '../../helpers/format';
import { CLOSING_MOVEMENTS, ClosingMovement, MOVEMENT_TYPE_OPTIONS, VISIT_STATUS_OPTIONS, VisitStatus } from '../../helpers/visits';
import { Clear } from '../../interactions/enter';
import { Select } from '../../interactions/select';
import { Uncheck } from '../../interactions/check';
import { Wait } from '../../interactions/wait';
import { buildMovementForm } from '../../payloads/visit';
import { AttributeOf, IsDisplayed, NumberOf, TextOf, ValueOf } from '../../questions/generic';
import { NowInTheBrowser, TimelineInstants, TimelineMovements, VisitRow, VisitSummary } from '../../questions/visits';
import { ask, perform } from '../../screenplay/core';
import { Target } from '../../screenplay/target';
import { ClosingConfirmation, MovementForm, ReadOnlyWarning, VisitDetails, VisitDetailsError, VisitDetailsSuccess } from '../../targets/visits';
import { aRegisteredPerson, aVisitInStatus } from '../../tasks/visit-preconditions';
import { AcknowledgeTheMessage, CancelTheMovementForm, ConfirmTheClosingMovement, FillTheMovementForm, FindTheVisits, GoBackFromTheClosingConfirmation, OpenTheVisit, RecordMovement, StartAddingAMovement, SubmitTheMovementForm, WaitForTheVisitDetails } from '../../tasks/visits';

/** Timeline entries without their generated IDs, for comparisons with the entered data. */
async function timelineOf(page: Parameters<typeof ask>[0]) {
  return (await ask(page, TimelineMovements())).map(({ id: _id, ...shown }) => shown);
}

test.describe('Visits UI | Movements and timeline', () => {
  test.describe('POSITIVE', () => {
    test('Records a triage with professional and description and keeps the visit Open (AC 6)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const nurse = await aRegisteredPerson(page, ['NURSE']);
      const { patient, data } = await aVisitInStatus(page, 'OPEN');
      const triage = buildMovementForm('TRIAGE', { occurredAt: shiftDateTime(data.admission, 10), professionalName: nurse.name, description: 'Manchester triage: yellow' });
      const expected = { type: 'Triage', occurredAt: formatDateTime(triage.occurredAt!), departments: null, professional: `Professional: ${nurse.name}`, description: triage.description };

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), FillTheMovementForm.with(triage), SubmitTheMovementForm());

      await test.step('The movement is confirmed', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitDetailsSuccess.MESSAGE))).toBe('Triage recorded successfully');
        await perform(page, AcknowledgeTheMessage.of(VisitDetailsSuccess), WaitForTheVisitDetails());
      });

      await test.step('The timeline shows the triage with its time, professional and description', async () => {
        expect(await timelineOf(page)).toEqual([expected]);
      });

      await test.step('A triage does not change the visit status (rule 7)', async () => {
        expect((await ask(page, VisitSummary()))?.status).toBe('Open');
      });

      await test.step('The movement is persisted with the visit', async () => {
        await perform(page, OpenTheVisit.ofPatient(patient.name));
        expect(await timelineOf(page)).toEqual([expected]);
      });
    });

    test('Care Started moves an Open visit to In Progress (AC 8)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const { patient, visitId } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(buildMovementForm('CARE_STARTED')));

      await test.step('The details show the visit In Progress and still open', async () => {
        const summary = await ask(page, VisitSummary());
        expect(summary?.status).toBe('In Progress');
        expect(summary?.closedAt).toBe('—');
        expect(await ask(page, IsDisplayed.the(VisitDetails.ADD_MOVEMENT_BUTTON))).toBe(true);
      });

      await test.step('The list shows the new status', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name));
        expect((await ask(page, VisitRow.of(visitId)))?.status).toBe('In Progress');
      });
    });

    const closings: Array<{ from: VisitStatus; type: ClosingMovement }> = [
      { from: 'IN_PROGRESS', type: 'DISCHARGE' },
      { from: 'IN_PROGRESS', type: 'CANCELLATION' },
      { from: 'OPEN', type: 'CANCELLATION' },
    ];

    for (const { from, type } of closings) {
      const closedLabel = VISIT_STATUS_OPTIONS[CLOSING_MOVEMENTS[type]].label;

      test(`${MOVEMENT_TYPE_OPTIONS[type].label} of an ${from} visit asks for confirmation and closes it as ${closedLabel} (AC ${type === 'DISCHARGE' ? 9 : 10})`, {
        tag: [...VISIT_UI_TAGS, '@POSITIVE', ...(from === 'IN_PROGRESS' ? ['@SMOKE'] : [])],
      }, async ({ page }) => {
        const { patient } = await aVisitInStatus(page, from);
        let before!: string;

        await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), FillTheMovementForm.with(buildMovementForm(type)), SubmitTheMovementForm());

        await test.step('An explicit confirmation explains that the visit will be closed (7.4)', async () => {
          await expect.poll(() => ask(page, TextOf.the(ClosingConfirmation.TITLE))).toBe(type === 'DISCHARGE' ? 'Confirm Discharge' : 'Confirm Cancellation');
          expect(await ask(page, TextOf.the(ClosingConfirmation.MESSAGE))).toContain(`closes this visit as ${closedLabel}`);
        });

        await test.step('Confirming records the movement', async () => {
          before = await ask(page, NowInTheBrowser());
          await perform(page, ConfirmTheClosingMovement());
          await expect.poll(() => ask(page, TextOf.the(VisitDetailsSuccess.MESSAGE))).toBe(`${MOVEMENT_TYPE_OPTIONS[type].label} recorded successfully`);
          await perform(page, AcknowledgeTheMessage.of(VisitDetailsSuccess), WaitForTheVisitDetails());
        });

        await test.step(`The visit is ${closedLabel}, closed now and read-only`, async () => {
          const after = await ask(page, NowInTheBrowser());
          const summary = await ask(page, VisitSummary());
          const closedAt = parseDisplayedDateTime(summary?.closedAt ?? '') ?? '';
          expect(summary?.status).toBe(closedLabel);
          expect(closedAt >= before && closedAt <= after, `Closed at ${summary?.closedAt}, expected between ${before} and ${after}`).toBe(true);
          expect(await ask(page, IsDisplayed.the(VisitDetails.ADD_MOVEMENT_BUTTON))).toBe(false);
          expect(await ask(page, IsDisplayed.the(VisitDetails.EDIT_BUTTON))).toBe(false);
        });

        await test.step('No read-only warning is added: the success message already confirmed the closing', async () => {
          expect(await ask(page, IsDisplayed.the(ReadOnlyWarning.DIALOG))).toBe(false);
        });

        await test.step('The closing movement ends the timeline', async () => {
          expect((await timelineOf(page)).at(-1)?.type).toBe(MOVEMENT_TYPE_OPTIONS[type].label);
        });
      });
    }

    test('Going back from the closing confirmation records nothing (7.4)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'IN_PROGRESS');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), FillTheMovementForm.with(buildMovementForm('DISCHARGE')), SubmitTheMovementForm());
      await perform(page, Wait.until(ClosingConfirmation.DIALOG).isVisible(), GoBackFromTheClosingConfirmation());

      await test.step('The movement form is still open with the discharge selected', async () => {
        expect(await ask(page, IsDisplayed.the(MovementForm.DIALOG))).toBe(true);
        expect(await ask(page, ValueOf.the(MovementForm.TYPE_SELECT))).toBe('DISCHARGE');
      });

      await test.step('After cancelling the form, the visit is still In Progress with an unchanged history', async () => {
        await perform(page, CancelTheMovementForm());
        expect((await ask(page, VisitSummary()))?.status).toBe('In Progress');
        expect((await timelineOf(page)).map((movement) => movement.type)).toEqual(['Care Started']);
      });
    });

    test('Shows department fields only for transfers and requires a description only for Other (7.4)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement());

      await test.step('Triage shows no department fields and an optional description', async () => {
        await perform(page, Select.option('TRIAGE').from(MovementForm.TYPE_SELECT));
        expect(await ask(page, IsDisplayed.the(MovementForm.DEPARTMENT_TO_INPUT))).toBe(false);
        expect(await ask(page, IsDisplayed.the(MovementForm.DEPARTMENT_FROM_INPUT))).toBe(false);
        expect(await ask(page, TextOf.the(MovementForm.DESCRIPTION_LABEL))).toBe('Description');
      });

      await test.step('Department Transfer shows origin and destination fields', async () => {
        await perform(page, Select.option('DEPARTMENT_TRANSFER').from(MovementForm.TYPE_SELECT));
        expect(await ask(page, IsDisplayed.the(MovementForm.DEPARTMENT_FROM_INPUT))).toBe(true);
        expect(await ask(page, IsDisplayed.the(MovementForm.DEPARTMENT_TO_INPUT))).toBe(true);
      });

      await test.step('Other marks the description as mandatory', async () => {
        await perform(page, Select.option('OTHER').from(MovementForm.TYPE_SELECT));
        expect(await ask(page, TextOf.the(MovementForm.DESCRIPTION_LABEL))).toBe('Description *');
        expect(await ask(page, IsDisplayed.the(MovementForm.DEPARTMENT_TO_INPUT))).toBe(false);
      });
    });

    test('Records transfers and starts each new transfer from the current department (rule 9)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'IN_PROGRESS');

      await perform(page, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(buildMovementForm('DEPARTMENT_TRANSFER', { departmentFrom: 'Emergency', departmentTo: 'Radiology' })));

      await test.step('The first transfer shows both departments and sets the current department', async () => {
        expect((await timelineOf(page)).at(-1)?.departments).toBe('Emergency → Radiology');
        expect(await ask(page, TextOf.the(VisitDetails.CURRENT_DEPARTMENT))).toBe('Current department: Radiology');
      });

      await test.step('The next transfer offers the current department as a read-only origin', async () => {
        await perform(page, StartAddingAMovement(), Select.option('DEPARTMENT_TRANSFER').from(MovementForm.TYPE_SELECT));
        expect(await ask(page, ValueOf.the(MovementForm.DEPARTMENT_FROM_INPUT))).toBe('Radiology');
        expect(await ask(page, AttributeOf.the('readonly').of(MovementForm.DEPARTMENT_FROM_INPUT))).not.toBeNull();
        await perform(page, CancelTheMovementForm());
      });

      await perform(page, RecordMovement.with(buildMovementForm('DEPARTMENT_TRANSFER', { departmentTo: 'Cardiology' })));

      await test.step('The second transfer goes from the current department to the new one', async () => {
        expect((await timelineOf(page)).at(-1)?.departments).toBe('Radiology → Cardiology');
        expect(await ask(page, TextOf.the(VisitDetails.CURRENT_DEPARTMENT))).toBe('Current department: Cardiology');
      });
    });

    test('Records a first transfer whose origin is unknown', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(buildMovementForm('DEPARTMENT_TRANSFER', { departmentTo: 'Radiology' })));

      await test.step('Only the destination is recorded', async () => {
        expect((await timelineOf(page)).at(-1)?.departments).toBe('Unknown department → Radiology');
      });
    });

    test('Records an Other movement with its description', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');
      const other = buildMovementForm('OTHER');

      await perform(page, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(other));

      await test.step('The entry shows the Other type and the description', async () => {
        const [entry] = await timelineOf(page);
        expect(entry.type).toBe('Other');
        expect(entry.description).toBe(other.description);
      });
    });

    test('Lists the timeline in chronological order, including backdated entries (AC 7)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      const { patient, data } = await aVisitInStatus(page, 'OPEN');
      const triageAt = shiftDateTime(data.admission, 10);
      const careAt = shiftDateTime(data.admission, 40);

      await perform(
        page,
        OpenTheVisit.ofPatient(patient.name),
        RecordMovement.with(buildMovementForm('TRIAGE', { occurredAt: triageAt })),
        RecordMovement.with(buildMovementForm('CARE_STARTED', { occurredAt: careAt })),
        RecordMovement.with(buildMovementForm('OTHER')),
      );

      await test.step('Entries follow the moment each event took place', async () => {
        const timeline = await timelineOf(page);
        expect(timeline.map((movement) => movement.type)).toEqual(['Triage', 'Care Started', 'Other']);
        expect(timeline.slice(0, 2).map((movement) => movement.occurredAt)).toEqual([formatDateTime(triageAt), formatDateTime(careAt)]);
      });

      await test.step('The instants behind the displayed times are in ascending order', async () => {
        const instants = (await ask(page, TimelineInstants())).map((instant) => Date.parse(instant));
        expect(instants).toEqual([...instants].sort((a, b) => a - b));
      });
    });

    test('Accepts a movement dated exactly at the admission (boundary)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const { patient, data } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(buildMovementForm('TRIAGE', { occurredAt: data.admission })));

      await test.step('The triage is recorded at the admission time', async () => {
        expect((await timelineOf(page))[0].occurredAt).toBe(formatDateTime(data.admission));
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Offers no way to edit or delete recorded movements (AC 13)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'IN_PROGRESS');

      await perform(page, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(buildMovementForm('TRIAGE')));

      await test.step('The timeline holds no controls at all', async () => {
        const controls = Target.the('Controls inside the movement timeline').locatedBy((current) =>
          current.getByTestId('visits-movement-timeline').locator('button, a, input, select, textarea, [contenteditable="true"], [role="button"]'),
        );
        expect(await ask(page, NumberOf.the(controls))).toBe(0);
      });
    });

    test('Requires a movement type', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), SubmitTheMovementForm());

      await test.step('The type is reported as required and nothing is recorded', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('type')))).toBe('Movement type is required.');
        expect(await ask(page, TextOf.the(MovementForm.SUMMARY_ERROR))).toBe('Please correct the highlighted fields before recording the movement.');
        await perform(page, CancelTheMovementForm());
        expect(await ask(page, IsDisplayed.the(VisitDetails.TIMELINE_EMPTY))).toBe(true);
      });
    });

    test('Requires a destination for a department transfer (rule 9)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(
        page,
        OpenTheVisit.ofPatient(patient.name),
        StartAddingAMovement(),
        FillTheMovementForm.with({ type: 'DEPARTMENT_TRANSFER', departmentFrom: 'Emergency', departmentTo: '   ' }),
        SubmitTheMovementForm(),
      );

      await test.step('The destination is reported as required', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('department-to')))).toBe('Destination department is required for a transfer.');
        expect(await ask(page, IsDisplayed.the(MovementForm.DIALOG))).toBe(true);
      });
    });

    test('Rejects a transfer to the department the patient is already in, ignoring case', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(
        page,
        OpenTheVisit.ofPatient(patient.name),
        RecordMovement.with(buildMovementForm('DEPARTMENT_TRANSFER', { departmentTo: 'Radiology' })),
        StartAddingAMovement(),
        FillTheMovementForm.with({ type: 'DEPARTMENT_TRANSFER', departmentTo: 'radiology' }),
        SubmitTheMovementForm(),
      );

      await test.step('The same-department transfer is rejected', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('same-department')))).toBe('The destination must be different from the origin department.');
      });
    });

    test('Requires a description for Other movements (boundary)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), FillTheMovementForm.with({ type: 'OTHER', description: '   ' }), SubmitTheMovementForm());

      await test.step('The description is reported as required', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('description')))).toBe('Description is required for movements of type Other.');
      });
    });

    test('Rejects a movement earlier than the latest movement (rule 11, boundary)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const { patient, data } = await aVisitInStatus(page, 'OPEN');
      const triageAt = shiftDateTime(data.admission, 30);

      await perform(
        page,
        OpenTheVisit.ofPatient(patient.name),
        RecordMovement.with(buildMovementForm('TRIAGE', { occurredAt: triageAt })),
        StartAddingAMovement(),
        FillTheMovementForm.with(buildMovementForm('CARE_STARTED', { occurredAt: shiftDateTime(triageAt, -1) })),
        SubmitTheMovementForm(),
      );

      await test.step('The movement is reported as too early, naming the latest movement time', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('occurred-at-too-early')))).toContain(`The movement cannot be earlier than ${formatDateTime(triageAt)}`);
      });

      await test.step('Nothing is recorded and the visit is still Open', async () => {
        await perform(page, CancelTheMovementForm());
        expect((await timelineOf(page)).map((movement) => movement.type)).toEqual(['Triage']);
        expect((await ask(page, VisitSummary()))?.status).toBe('Open');
      });
    });

    test('Rejects a movement earlier than the admission (rule 11, boundary)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ page }) => {
      const { patient, data } = await aVisitInStatus(page, 'OPEN');

      await perform(
        page,
        OpenTheVisit.ofPatient(patient.name),
        StartAddingAMovement(),
        FillTheMovementForm.with(buildMovementForm('TRIAGE', { occurredAt: shiftDateTime(data.admission, -1) })),
        SubmitTheMovementForm(),
      );

      await test.step('The movement is reported as too early', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('occurred-at-too-early')))).toContain('The movement cannot be earlier than');
      });
    });

    test('Rejects a movement in the future (rule 11)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');
      const inOneHour = shiftDateTime(await ask(page, NowInTheBrowser()), 60);

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), FillTheMovementForm.with(buildMovementForm('TRIAGE', { occurredAt: inOneHour })), SubmitTheMovementForm());

      await test.step('The movement is reported as being in the future', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('occurred-at-future')))).toBe('The movement cannot be in the future.');
      });
    });

    test('Requires a date and time when the current time is not used', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(
        page,
        OpenTheVisit.ofPatient(patient.name),
        StartAddingAMovement(),
        Select.option('TRIAGE').from(MovementForm.TYPE_SELECT),
        Uncheck.the(MovementForm.USE_CURRENT_TIME_CHECKBOX),
        Clear.theValueOf(MovementForm.OCCURRED_AT_INPUT),
        SubmitTheMovementForm(),
      );

      await test.step('The date and time are reported as required', async () => {
        await expect.poll(() => ask(page, TextOf.the(MovementForm.validationError('occurred-at-required')))).toBe('Date and time are required.');
      });
    });

    test('Cancelling the movement form records nothing', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), FillTheMovementForm.with(buildMovementForm('CARE_STARTED')), CancelTheMovementForm());

      await test.step('The history is still empty and the visit still Open', async () => {
        expect(await ask(page, IsDisplayed.the(VisitDetails.TIMELINE_EMPTY))).toBe(true);
        expect((await ask(page, VisitSummary()))?.status).toBe('Open');
      });
    });

    test('Reports the conflict when another user closes the visit while a movement is being added (AC 11)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ page, anotherSession }) => {
      const { patient } = await aVisitInStatus(page, 'OPEN');

      await perform(page, OpenTheVisit.ofPatient(patient.name), StartAddingAMovement(), FillTheMovementForm.with(buildMovementForm('TRIAGE')));
      await perform(anotherSession, OpenTheVisit.ofPatient(patient.name), RecordMovement.with(buildMovementForm('DISCHARGE')));
      await perform(page, SubmitTheMovementForm());

      await test.step('The API conflict is reported', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitDetailsError.MESSAGE))).toContain('(409)');
        await perform(page, AcknowledgeTheMessage.of(VisitDetailsError));
      });

      await test.step('The page shows the visit Completed with only the discharge recorded', async () => {
        await expect.poll(async () => (await ask(page, VisitSummary()))?.status).toBe('Completed');
        expect((await timelineOf(page)).map((movement) => movement.type)).toEqual(['Discharge']);
        expect(await ask(page, IsDisplayed.the(VisitDetails.ADD_MOVEMENT_BUTTON))).toBe(false);
        expect(await ask(page, IsDisplayed.the(ReadOnlyWarning.DIALOG)), 'The conflict message already explains the change').toBe(false);
      });
    });
  });
});
