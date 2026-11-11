import { test, expect, VISIT_API_TAGS } from '../../../../fixtures/api.fixture';
import { expectStatus, readJson } from '../../helpers/http';
import { toEpoch } from '../../helpers/time';
import { referenceId } from '../../helpers/references';
import { expectActiveVisit, expectApiError, expectSameInstant, expectVisitContract, idsOf } from '../../assertions/visits';
import { buildVisitUpdate, MALFORMED_IDS, UNKNOWN_OBJECT_ID } from '../../payloads/visit';
import { TEST_DATA_PREFIX } from '../../payloads/person';
import { Person } from '../../helpers/models/person';
import { ACTIVE_VISIT_STATUSES, CLOSED_VISIT_STATUSES, Visit, VisitUpdatePayload } from '../../helpers/models/visit';

test.describe('Visits API | Update visit', () => {
  test.describe('POSITIVE', () => {
    for (const status of ACTIVE_VISIT_STATUSES) {
      test(`Updates type, professional, chief complaint and notes while the visit is ${status}`, {
        tag: [...VISIT_API_TAGS, '@POSITIVE', ...(status === 'OPEN' ? ['@SMOKE'] : [])],
      }, async ({ visitsApi }) => {
        let original!: Visit;
        let changes!: VisitUpdatePayload;
        let updated!: Visit;

        await test.step(`Create a ${status} visit and register a nurse`, async () => {
          ({ visit: original } = await visitsApi.createVisitInStatus(status, { type: 'OUTPATIENT' }));
          const nurse = await visitsApi.registerPerson(['NURSE']);
          changes = {
            type: 'EMERGENCY',
            attendingProfessionalId: nurse._id,
            chiefComplaint: `${TEST_DATA_PREFIX} Chest pain radiating to left arm`,
            notes: 'Escalated after initial assessment',
          };
        });

        await test.step('Put the editable fields', async () => {
          const response = await visitsApi.update(original._id, buildVisitUpdate(original, { ...changes }));
          await expectStatus(response, 200);
          updated = await readJson<Visit>(response);
        });

        await test.step('Response reflects the changes and keeps identity, patient, status and admission', async () => {
          expectVisitContract(updated);
          expect(updated.type).toBe(changes.type);
          expect(referenceId(updated.attendingProfessionalId)).toBe(changes.attendingProfessionalId);
          expect(updated.chiefComplaint).toBe(changes.chiefComplaint);
          expect(updated.notes).toBe(changes.notes);
          expect(updated._id).toBe(original._id);
          expect(referenceId(updated.patientId)).toBe(referenceId(original.patientId));
          expectActiveVisit(updated, status);
          expectSameInstant(updated.admissionDate, original.admissionDate, 'admissionDate');
          expect(updated.createdAt).toBe(original.createdAt);
          expect(toEpoch(updated.updatedAt)).toBeGreaterThanOrEqual(toEpoch(original.updatedAt));
        });

        await test.step('Changes are persisted', async () => {
          const persisted = await visitsApi.getVisit(original._id);
          expect(persisted.type).toBe(changes.type);
          expect(referenceId(persisted.attendingProfessionalId)).toBe(changes.attendingProfessionalId);
          expect(persisted.chiefComplaint).toBe(changes.chiefComplaint);
          expect(persisted.notes).toBe(changes.notes);
        });
      });
    }

    test('Editing a visit does not append movements to its timeline', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit and record a triage movement', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
        await visitsApi.appendMovement(visit._id, { type: 'TRIAGE' });
      });

      await test.step('Update the chief complaint', async () => {
        const response = await visitsApi.update(visit._id, buildVisitUpdate(visit, { chiefComplaint: `${TEST_DATA_PREFIX} Updated complaint` }));
        await expectStatus(response, 200);
      });

      await test.step('The timeline still holds only the triage movement', async () => {
        const timeline = await visitsApi.getTimeline(visit._id);
        expect(timeline.map((movement) => movement.type)).toEqual(['TRIAGE']);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Rejects changing the patient association and keeps the original patient (rule 13)', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@SMOKE'],
    }, async ({ visitsApi }) => {
      let patient!: Person;
      let visit!: Visit;
      let otherPatient!: Person;

      await test.step('Open a visit and register another patient', async () => {
        ({ patient, visit } = await visitsApi.createVisitInStatus('OPEN'));
        otherPatient = await visitsApi.registerPatient();
      });

      await test.step('Put the other patient on the visit', async () => {
        const response = await visitsApi.update(visit._id, buildVisitUpdate(visit, { patientId: otherPatient._id }));
        await expectApiError(response, [400, 409, 422], /patient/i);
      });

      await test.step('The visit still belongs to the original patient and the other patient has none', async () => {
        expect(referenceId((await visitsApi.getVisit(visit._id)).patientId)).toBe(patient._id);
        expect(await visitsApi.listPatientVisits(otherPatient._id)).toEqual([]);
        expect(idsOf(await visitsApi.listPatientVisits(patient._id))).toEqual([visit._id]);
      });
    });

    const invalidChanges: Array<{ label: string; changes: Record<string, unknown>; message?: RegExp }> = [
      { label: 'an empty chief complaint', changes: { chiefComplaint: '' }, message: /complaint/i },
      { label: 'a whitespace-only chief complaint', changes: { chiefComplaint: '   ' }, message: /complaint/i },
      { label: 'an unsupported type', changes: { type: 'SURGERY' }, message: /type/i },
      { label: 'a malformed professional ID', changes: { attendingProfessionalId: 'not-an-object-id' }, message: /professional/i },
    ];

    for (const { label, changes, message } of invalidChanges) {
      test(`Rejects an update with ${label} and leaves the visit unchanged`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        let visit!: Visit;

        await test.step('Open a visit', async () => {
          ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
        });

        await test.step(`Put ${label}`, async () => {
          const response = await visitsApi.update(visit._id, buildVisitUpdate(visit, changes));
          await expectApiError(response, [400, 422], message);
        });

        await test.step('The persisted visit is unchanged', async () => {
          expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
        });
      });
    }

    test('Rejects an attending professional that does not exist and leaves the visit unchanged', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Put an unknown professional', async () => {
        const response = await visitsApi.update(visit._id, buildVisitUpdate(visit, { attendingProfessionalId: UNKNOWN_OBJECT_ID }));
        await expectApiError(response, [400, 404, 422], /professional/i);
      });

      await test.step('The persisted visit is unchanged', async () => {
        expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
      });
    });

    test('Rejects a patient-only person as attending professional on update', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@CONTRACT-ASSUMPTION'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Put another patient as the attending professional', async () => {
        const otherPatient = await visitsApi.registerPatient();
        const response = await visitsApi.update(visit._id, buildVisitUpdate(visit, { attendingProfessionalId: otherPatient._id }));
        await expectApiError(response, [400, 422], /professional/i);
      });

      await test.step('The persisted visit is unchanged', async () => {
        expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
      });
    });

    test('Never closes or reopens a visit through the update endpoint', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Put a COMPLETED status with a closing timestamp', async () => {
        const response = await visitsApi.update(
          visit._id,
          buildVisitUpdate(visit, { status: 'COMPLETED', closedAt: new Date().toISOString() }),
        );
        // Status changes only through movements: rejecting or ignoring the fields are both acceptable.
        await expectStatus(response, [200, 400, 409, 422]);
      });

      await test.step('The visit is still OPEN, without closedAt and without movements', async () => {
        expectActiveVisit(await visitsApi.getVisit(visit._id), 'OPEN');
        expect(await visitsApi.getTimeline(visit._id)).toEqual([]);
      });
    });

    for (const status of CLOSED_VISIT_STATUSES) {
      test(`Rejects editing a ${status} visit with 409 (rule 8)`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        let visit!: Visit;

        await test.step(`Create a ${status} visit`, async () => {
          ({ visit } = await visitsApi.createVisitInStatus(status));
        });

        await test.step('Put new notes and chief complaint', async () => {
          const response = await visitsApi.update(visit._id, buildVisitUpdate(visit, {
            chiefComplaint: `${TEST_DATA_PREFIX} Late edit`,
            notes: 'Edited after closing',
          }));
          await expectApiError(response, 409);
        });

        await test.step('The closed visit is unchanged', async () => {
          expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
        });
      });
    }

    test('Returns 404 when updating a well-formed visit ID that does not exist', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Put a valid change on an unknown visit', async () => {
        const response = await visitsApi.update(UNKNOWN_OBJECT_ID, { type: 'OUTPATIENT', chiefComplaint: `${TEST_DATA_PREFIX} Nobody home` });
        await expectApiError(response, 404, /visit/i);
      });
    });

    for (const malformedId of MALFORMED_IDS) {
      test(`Rejects updating the malformed visit ID "${malformedId}"`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        await test.step('Put a valid change on a malformed visit ID', async () => {
          const response = await visitsApi.update(malformedId, { type: 'OUTPATIENT', chiefComplaint: `${TEST_DATA_PREFIX} Malformed` });
          await expectApiError(response, [400, 404]);
        });
      });
    }
  });
});
