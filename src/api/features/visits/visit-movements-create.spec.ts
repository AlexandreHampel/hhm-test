import { test, expect, VISIT_API_TAGS } from '../../../../fixtures/api.fixture';
import { expectStatus, readJson } from '../../helpers/http';
import { FUTURE_MARGIN_MS, isoFromNow, SAME_REQUEST_TOLERANCE_MS, toEpoch } from '../../helpers/time';
import { referenceId } from '../../helpers/references';
import { expectActiveVisit, expectApiError, expectClosedVisit, expectMovementContract, expectMovementToMatchPayload, idsOf } from '../../assertions/visits';
import { buildMovement, MALFORMED_IDS, UNKNOWN_OBJECT_ID } from '../../payloads/visit';
import { TEST_DATA_PREFIX } from '../../payloads/person';
import { Person } from '../../helpers/models/person';
import { ACTIVE_VISIT_STATUSES, CLOSED_VISIT_STATUSES, CLOSING_MOVEMENTS, ClosingMovementType, MOVEMENT_TYPES, MovementPayload, NON_CLOSING_MOVEMENT_TYPES, Visit, VisitMovement, VisitStatus } from '../../helpers/models/visit';

test.describe('Visit Movements API | Append movement and status transitions', () => {
  test.describe('POSITIVE', () => {
    test('Appends a triage movement linked to the visit and persists it', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;
      let payload!: MovementPayload;
      let movement!: VisitMovement;

      await test.step('Open a visit and register a nurse', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
        const nurse = await visitsApi.registerPerson(['NURSE']);
        payload = buildMovement('TRIAGE', {
          responsibleProfessionalId: nurse._id,
          description: 'Manchester triage: yellow',
        });
      });

      await test.step('Post the movement', async () => {
        const response = await visitsApi.addMovement(visit._id, payload);
        await expectStatus(response, 201);
        movement = await readJson<VisitMovement>(response);
      });

      await test.step('Response complies with the movement model and reflects the payload', async () => {
        expectMovementContract(movement, visit._id);
        expectMovementToMatchPayload(movement, payload);
      });

      await test.step('The movement is persisted in the visit timeline', async () => {
        const timeline = await visitsApi.getTimeline(visit._id);
        expect(idsOf(timeline)).toEqual([movement._id]);
        expectMovementToMatchPayload(timeline[0], payload);
      });
    });

    test('CARE_STARTED moves an OPEN visit to IN_PROGRESS (AC 8)', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Append CARE_STARTED', async () => {
        expectMovementContract(await visitsApi.appendMovement(visit._id, buildMovement('CARE_STARTED')), visit._id);
      });

      await test.step('The visit is IN_PROGRESS and still open', async () => {
        expectActiveVisit(await visitsApi.getVisit(visit._id), 'IN_PROGRESS');
      });
    });

    const closingScenarios: Array<{ from: VisitStatus; type: ClosingMovementType }> = [
      { from: 'IN_PROGRESS', type: 'DISCHARGE' },
      { from: 'OPEN', type: 'DISCHARGE' },
      { from: 'IN_PROGRESS', type: 'CANCELLATION' },
      { from: 'OPEN', type: 'CANCELLATION' },
    ];

    for (const { from, type } of closingScenarios) {
      const closedStatus = CLOSING_MOVEMENTS[type];

      test(`${type} closes a ${from} visit as ${closedStatus} and sets closedAt`, {
        tag: [...VISIT_API_TAGS, '@POSITIVE', ...(from === 'IN_PROGRESS' ? ['@SMOKE'] : [])],
      }, async ({ visitsApi }) => {
        let visit!: Visit;
        let movement!: VisitMovement;

        await test.step(`Create a ${from} visit`, async () => {
          ({ visit } = await visitsApi.createVisitInStatus(from));
        });

        await test.step(`Append ${type}`, async () => {
          movement = await visitsApi.appendMovement(visit._id, buildMovement(type));
          expectMovementContract(movement, visit._id);
        });

        await test.step(`The visit is ${closedStatus} with a closing timestamp`, async () => {
          const closed = await visitsApi.getVisit(visit._id);
          expectClosedVisit(closed, closedStatus);
          expect(toEpoch(closed.updatedAt)).toBeGreaterThanOrEqual(toEpoch(visit.updatedAt));
        });

        await test.step(`The timeline ends with the ${type} movement`, async () => {
          const timeline = await visitsApi.getTimeline(visit._id);
          expect(timeline.at(-1)?._id).toBe(movement._id);
        });
      });
    }

    for (const status of ACTIVE_VISIT_STATUSES) {
      for (const type of NON_CLOSING_MOVEMENT_TYPES) {
        test(`${type} keeps a ${status} visit ${status} (rule 7)`, {
          tag: [...VISIT_API_TAGS, '@POSITIVE'],
        }, async ({ visitsApi }) => {
          let visit!: Visit;

          await test.step(`Create a ${status} visit`, async () => {
            ({ visit } = await visitsApi.createVisitInStatus(status));
          });

          await test.step(`Append ${type}`, async () => {
            await visitsApi.appendMovement(visit._id, buildMovement(type));
          });

          await test.step(`The visit remains ${status} without closedAt`, async () => {
            expectActiveVisit(await visitsApi.getVisit(visit._id), status);
          });
        });
      }
    }

    test('Stores the responsible professional reference exactly as submitted', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Append CARE_STARTED with a doctor as responsible professional', async () => {
        const { visit } = await visitsApi.createVisitInStatus('OPEN');
        const doctor = await visitsApi.registerPerson(['DOCTOR']);
        const movement = await visitsApi.appendMovement(visit._id, buildMovement('CARE_STARTED', { responsibleProfessionalId: doctor._id }));
        expect(referenceId(movement.responsibleProfessionalId)).toBe(doctor._id);
        expect(referenceId((await visitsApi.getTimeline(visit._id))[0].responsibleProfessionalId)).toBe(doctor._id);
      });
    });

    test('Defaults occurredAt to server time when omitted', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;
      let movement!: VisitMovement;

      await test.step('Append a movement without occurredAt', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
        movement = await visitsApi.appendMovement(visit._id, { type: 'TRIAGE' });
      });

      await test.step('occurredAt is generated by the server at entry time and after the admission', async () => {
        const drift = Math.abs(toEpoch(movement.occurredAt) - toEpoch(movement.createdAt));
        expect(drift, `occurredAt ${movement.occurredAt} vs createdAt ${movement.createdAt}`).toBeLessThanOrEqual(
          SAME_REQUEST_TOLERANCE_MS,
        );
        expect(toEpoch(movement.occurredAt)).toBeGreaterThanOrEqual(toEpoch(visit.admissionDate));
      });
    });

    test('Records a department transfer with origin and destination', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;
      const payload = buildMovement('DEPARTMENT_TRANSFER', { departmentFrom: 'Emergency', departmentTo: 'Intensive Care Unit' });

      await test.step('Append a transfer from Emergency to the ICU', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('IN_PROGRESS'));
        expectMovementToMatchPayload(await visitsApi.appendMovement(visit._id, payload), payload);
      });

      await test.step('The timeline shows both departments', async () => {
        const [transfer] = await visitsApi.getTimeline(visit._id).then((timeline) =>
          timeline.filter((movement) => movement.type === 'DEPARTMENT_TRANSFER'));
        expectMovementToMatchPayload(transfer, payload);
      });
    });

    test('Accepts a first department transfer that only identifies the destination', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      await test.step('Append a transfer to Radiology without origin on a visit with no known department', async () => {
        const { visit } = await visitsApi.createVisitInStatus('OPEN');
        const payload = buildMovement('DEPARTMENT_TRANSFER', { departmentTo: 'Radiology' });
        const movement = await visitsApi.appendMovement(visit._id, payload);
        expect(movement.departmentTo).toBe('Radiology');
        expect(movement.departmentFrom ?? null).toBeNull();
      });
    });

    test('Records an OTHER movement with its mandatory description', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Append an OTHER movement with a description', async () => {
        const { visit } = await visitsApi.createVisitInStatus('OPEN');
        const payload = buildMovement('OTHER', { description: `${TEST_DATA_PREFIX} Social worker consultation` });
        expectMovementToMatchPayload(await visitsApi.appendMovement(visit._id, payload), payload);
      });
    });

    test('Links the movement to the visit in the URL, never to a visitId sent in the body', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      let target!: Visit;
      let other!: Visit;

      await test.step('Open two visits for two patients', async () => {
        ({ visit: target } = await visitsApi.createVisitInStatus('OPEN'));
        ({ visit: other } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Post a movement to the first visit whose body names the second visit', async () => {
        const response = await visitsApi.addMovement(target._id, { type: 'TRIAGE', visitId: other._id });
        // Ignoring or rejecting the conflicting body field are both acceptable.
        await expectStatus(response, [201, 400, 422]);

        if (response.status() === 201) {
          expect((await readJson<VisitMovement>(response)).visitId).toBe(target._id);
        }
      });

      await test.step('The second visit has no movements', async () => {
        expect(await visitsApi.getTimeline(other._id)).toEqual([]);
      });
    });

    test('Closing a visit leaves the patient and professional people records untouched (rule 16)', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi, peopleApi }) => {
      let patient!: Person;
      let doctor!: Person;
      let visit!: Visit;

      await test.step('Open an attended visit', async () => {
        doctor = await peopleApi.getPerson((await visitsApi.registerPerson(['DOCTOR']))._id);
        ({ patient, visit } = await visitsApi.createVisitInStatus('IN_PROGRESS', { attendingProfessionalId: doctor._id }));
        patient = await peopleApi.getPerson(patient._id);
      });

      await test.step('Discharge the patient with the doctor as responsible professional', async () => {
        await visitsApi.appendMovement(visit._id, buildMovement('DISCHARGE', { responsibleProfessionalId: doctor._id }));
      });

      await test.step('Both people records are unchanged', async () => {
        expect(await peopleApi.getPerson(patient._id)).toEqual(patient);
        expect(await peopleApi.getPerson(doctor._id)).toEqual(doctor);
      });
    });

    test('A repeated CARE_STARTED never regresses or closes an IN_PROGRESS visit', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Create an IN_PROGRESS visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('IN_PROGRESS'));
      });

      await test.step('Append a second CARE_STARTED', async () => {
        const response = await visitsApi.addMovement(visit._id, buildMovement('CARE_STARTED'));
        // The requirement does not define this transition: recording it or rejecting it with 409 are accepted.
        await expectStatus(response, [201, 409]);
      });

      await test.step('The visit is still IN_PROGRESS', async () => {
        expectActiveVisit(await visitsApi.getVisit(visit._id), 'IN_PROGRESS');
      });
    });
  });

  test.describe('NEGATIVE', () => {
    const invalidMovements: Array<{ label: string; payload: Record<string, unknown>; message?: RegExp; tag: string }> = [
      { label: 'an unsupported movement type', payload: { type: 'SURGERY' }, message: /type/i, tag: '@NEGATIVE' },
      { label: 'a blank movement type', payload: { type: '' }, message: /type/i, tag: '@BOUNDARY' },
      { label: 'a missing movement type', payload: { description: 'No type' }, message: /type/i, tag: '@NEGATIVE' },
      { label: 'a lowercase movement type', payload: { type: 'triage' }, message: /type/i, tag: '@EDGE' },
      { label: 'a transfer without destination', payload: { type: 'DEPARTMENT_TRANSFER', departmentFrom: 'Emergency' }, message: /department/i, tag: '@NEGATIVE' },
      { label: 'a transfer with a blank destination', payload: { type: 'DEPARTMENT_TRANSFER', departmentTo: '   ' }, message: /department/i, tag: '@BOUNDARY' },
      { label: 'an OTHER movement without description', payload: { type: 'OTHER' }, message: /description/i, tag: '@NEGATIVE' },
      { label: 'an OTHER movement with a blank description', payload: { type: 'OTHER', description: '  ' }, message: /description/i, tag: '@BOUNDARY' },
      { label: 'an unparseable occurredAt', payload: { type: 'TRIAGE', occurredAt: 'not-a-date' }, tag: '@NEGATIVE' },
      { label: 'a non-existent calendar occurredAt (Feb 30)', payload: { type: 'TRIAGE', occurredAt: '2024-02-30T10:00:00Z' }, tag: '@EDGE' },
      { label: 'a malformed responsible professional ID', payload: { type: 'TRIAGE', responsibleProfessionalId: 'not-an-object-id' }, message: /professional/i, tag: '@NEGATIVE' },
    ];

    for (const { label, payload, message, tag } of invalidMovements) {
      test(`Rejects ${label} without partial writes`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE', tag],
      }, async ({ visitsApi }) => {
        let visit!: Visit;

        await test.step('Create an IN_PROGRESS visit', async () => {
          ({ visit } = await visitsApi.createVisitInStatus('IN_PROGRESS'));
        });

        await test.step(`Post ${label}`, async () => {
          await expectApiError(await visitsApi.addMovement(visit._id, payload), [400, 422], message);
        });

        await test.step('No movement is added and the visit is unchanged', async () => {
          expect(idsOf(await visitsApi.getTimeline(visit._id))).toHaveLength(1);
          expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
        });
      });
    }

    test('Rejects a responsible professional that does not exist', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Post a triage movement referencing an unknown professional', async () => {
        const response = await visitsApi.addMovement(visit._id, buildMovement('TRIAGE', { responsibleProfessionalId: UNKNOWN_OBJECT_ID }));
        await expectApiError(response, [400, 404, 422], /professional/i);
      });

      await test.step('No movement is added', async () => {
        expect(await visitsApi.getTimeline(visit._id)).toEqual([]);
      });
    });

    test('Rejects a closing movement with an invalid timestamp without closing the visit (rule 12)', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Create an IN_PROGRESS visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('IN_PROGRESS'));
      });

      await test.step('Post a DISCHARGE dated in the future', async () => {
        const response = await visitsApi.addMovement(visit._id, buildMovement('DISCHARGE', { occurredAt: isoFromNow(FUTURE_MARGIN_MS) }));
        await expectApiError(response, [400, 409, 422]);
      });

      await test.step('The visit is still IN_PROGRESS without closedAt and no DISCHARGE was stored', async () => {
        expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
        const timeline = await visitsApi.getTimeline(visit._id);
        expect(timeline.map((movement) => movement.type)).toEqual(['CARE_STARTED']);
      });
    });

    test('Returns 404 when appending a movement to a visit that does not exist', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Post a triage movement to an unknown visit', async () => {
        await expectApiError(await visitsApi.addMovement(UNKNOWN_OBJECT_ID, buildMovement('TRIAGE')), 404, /visit/i);
      });
    });

    for (const malformedId of MALFORMED_IDS) {
      test(`Rejects appending a movement to the malformed visit ID "${malformedId}"`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        await test.step('Post a triage movement to a malformed visit ID', async () => {
          await expectApiError(await visitsApi.addMovement(malformedId, buildMovement('TRIAGE')), [400, 404]);
        });
      });
    }

    for (const status of CLOSED_VISIT_STATUSES) {
      test(`Rejects every movement type on a ${status} visit with 409 (rule 8, AC 11)`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE', ...(status === 'COMPLETED' ? ['@SMOKE'] : [])],
      }, async ({ visitsApi }) => {
        let visit!: Visit;
        let timelineBefore!: VisitMovement[];

        await test.step(`Create a ${status} visit`, async () => {
          ({ visit } = await visitsApi.createVisitInStatus(status));
          timelineBefore = await visitsApi.getTimeline(visit._id);
        });

        for (const type of MOVEMENT_TYPES) {
          await test.step(`Post ${type}`, async () => {
            await expectApiError(await visitsApi.addMovement(visit._id, buildMovement(type)), 409);
          });
        }

        await test.step('The visit and its timeline are unchanged', async () => {
          expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
          expect(await visitsApi.getTimeline(visit._id)).toEqual(timelineBefore);
        });
      });
    }

    test('Simultaneous DISCHARGE and CANCELLATION close the visit exactly once and consistently', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;
      let outcomes: Array<{ type: ClosingMovementType; status: number }> = [];

      await test.step('Create an IN_PROGRESS visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('IN_PROGRESS'));
      });

      await test.step('Fire DISCHARGE and CANCELLATION at the same time', async () => {
        const types: ClosingMovementType[] = ['DISCHARGE', 'CANCELLATION', 'DISCHARGE', 'CANCELLATION'];
        const responses = await Promise.all(types.map((type) => visitsApi.addMovement(visit._id, buildMovement(type))));
        outcomes = responses.map((response, index) => ({ type: types[index], status: response.status() }));
      });

      await test.step('Exactly one closing movement succeeds and the others get 409', async () => {
        const winners = outcomes.filter((outcome) => outcome.status === 201);
        expect(winners, JSON.stringify(outcomes)).toHaveLength(1);
        expect(outcomes.filter((outcome) => outcome.status === 409), JSON.stringify(outcomes)).toHaveLength(outcomes.length - 1);
      });

      await test.step('The final status matches the single stored closing movement', async () => {
        const closingTypes = (await visitsApi.getTimeline(visit._id))
          .map((movement) => movement.type)
          .filter((type): type is ClosingMovementType => type in CLOSING_MOVEMENTS);
        expect(closingTypes).toHaveLength(1);
        expectClosedVisit(await visitsApi.getVisit(visit._id), CLOSING_MOVEMENTS[closingTypes[0]]);
      });
    });
  });
});
