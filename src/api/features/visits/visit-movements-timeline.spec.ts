import { test, expect, VISIT_API_TAGS } from '../../../../fixtures/api.fixture';
import { FUTURE_MARGIN_MS, isoFromNow, MINUTE_MS, shiftIso, toEpoch } from '../../helpers/time';
import { expectApiError, expectChronologicalTimeline, expectClosedVisit, expectMovementContract, expectMovementToMatchPayload, idsOf } from '../../assertions/visits';
import { buildMovement, MALFORMED_IDS, UNKNOWN_OBJECT_ID } from '../../payloads/visit';
import { MovementPayload, Visit, VisitMovement } from '../../helpers/models/visit';

test.describe('Visit Movements API | Chronological timeline', () => {
  test.describe('POSITIVE', () => {
    test('Returns the full history in ascending occurredAt order (AC 7)', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;
      let payloads!: MovementPayload[];
      const created: VisitMovement[] = [];

      await test.step('Open a visit admitted two hours ago', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
        const at = (minutes: number) => shiftIso(visit.admissionDate, minutes * MINUTE_MS);
        payloads = [
          buildMovement('TRIAGE', { occurredAt: at(5) }),
          buildMovement('CARE_STARTED', { occurredAt: at(15) }),
          buildMovement('DEPARTMENT_TRANSFER', { occurredAt: at(30), departmentFrom: 'Emergency', departmentTo: 'Cardiology' }),
          buildMovement('OTHER', { occurredAt: at(45) }),
          buildMovement('DISCHARGE', { occurredAt: at(60) }),
        ];
      });

      await test.step('Append triage, care start, transfer, other and discharge', async () => {
        for (const payload of payloads) {
          created.push(await visitsApi.appendMovement(visit._id, payload));
        }
      });

      await test.step('The timeline lists every movement once, in chronological order', async () => {
        const timeline = await visitsApi.getTimeline(visit._id);
        expect(idsOf(timeline)).toEqual(idsOf(created));
        expectChronologicalTimeline(timeline);

        for (const [index, movement] of timeline.entries()) {
          expectMovementContract(movement, visit._id);
          expectMovementToMatchPayload(movement, payloads[index]);
        }
      });

      await test.step('The closed visit keeps its complete history readable', async () => {
        expectClosedVisit(await visitsApi.getVisit(visit._id), 'COMPLETED');
      });
    });

    test('Returns an empty timeline for a visit without movements', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      await test.step('Open a visit and read its timeline', async () => {
        const { visit } = await visitsApi.createVisitInStatus('OPEN');
        expect(await visitsApi.getTimeline(visit._id)).toEqual([]);
      });
    });

    test('Keeps timelines of different visits separate', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Each visit timeline holds only its own movements', async () => {
        const { visit: first } = await visitsApi.createVisitInStatus('OPEN');
        const { visit: second } = await visitsApi.createVisitInStatus('OPEN');
        const firstMovement = await visitsApi.appendMovement(first._id, buildMovement('TRIAGE'));
        const secondMovement = await visitsApi.appendMovement(second._id, buildMovement('CANCELLATION'));
        expect(idsOf(await visitsApi.getTimeline(first._id))).toEqual([firstMovement._id]);
        expect(idsOf(await visitsApi.getTimeline(second._id))).toEqual([secondMovement._id]);
      });
    });

    test('Accepts a movement dated exactly at the admission time', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      await test.step('Append a triage with occurredAt equal to admissionDate', async () => {
        const { visit } = await visitsApi.createVisitInStatus('OPEN');
        const payload = buildMovement('TRIAGE', { occurredAt: visit.admissionDate });
        expectMovementToMatchPayload(await visitsApi.appendMovement(visit._id, payload), payload);
      });
    });

    test('Accepts a movement dated exactly at the latest movement and orders the tie by entry time', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;
      let first!: VisitMovement;
      let second!: VisitMovement;

      await test.step('Append two movements with the same occurredAt', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
        const occurredAt = shiftIso(visit.admissionDate, 10 * MINUTE_MS);
        first = await visitsApi.appendMovement(visit._id, buildMovement('TRIAGE', { occurredAt }));
        second = await visitsApi.appendMovement(visit._id, buildMovement('CARE_STARTED', { occurredAt }));
      });

      await test.step('Both are listed, the earlier entry first (createdAt and _id tie-breakers)', async () => {
        const timeline = await visitsApi.getTimeline(visit._id);
        expect(idsOf(timeline)).toEqual([first._id, second._id]);
        expectChronologicalTimeline(timeline);
      });
    });

    test('Appends a movement without occurredAt after earlier explicitly dated movements', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      await test.step('The server-dated movement is listed last', async () => {
        const { visit } = await visitsApi.createVisitInStatus('OPEN');
        const dated = await visitsApi.appendMovement(visit._id, buildMovement('TRIAGE', { occurredAt: shiftIso(visit.admissionDate, MINUTE_MS) }));
        const serverDated = await visitsApi.appendMovement(visit._id, buildMovement('CARE_STARTED'));
        const timeline = await visitsApi.getTimeline(visit._id);
        expect(idsOf(timeline)).toEqual([dated._id, serverDated._id]);
        expect(toEpoch(serverDated.occurredAt)).toBeGreaterThan(toEpoch(dated.occurredAt));
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Rejects a movement dated one millisecond before the admission (rule 11)', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Post a triage dated 1 ms before admission', async () => {
        const response = await visitsApi.addMovement(visit._id, buildMovement('TRIAGE', { occurredAt: shiftIso(visit.admissionDate, -1) }));
        await expectApiError(response, [400, 409, 422]);
      });

      await test.step('No movement is stored', async () => {
        expect(await visitsApi.getTimeline(visit._id)).toEqual([]);
      });
    });

    test('Rejects a movement dated in the future (rule 11)', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Post a triage dated one hour from now', async () => {
        const response = await visitsApi.addMovement(visit._id, buildMovement('TRIAGE', { occurredAt: isoFromNow(FUTURE_MARGIN_MS) }));
        await expectApiError(response, [400, 409, 422]);
      });

      await test.step('No movement is stored and the visit is unchanged', async () => {
        expect(await visitsApi.getTimeline(visit._id)).toEqual([]);
        expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
      });
    });

    test('Rejects a movement dated one millisecond before the latest movement (rule 11)', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;
      let latest!: VisitMovement;

      await test.step('Open a visit and record a triage 30 minutes after admission', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
        latest = await visitsApi.appendMovement(visit._id, buildMovement('TRIAGE', { occurredAt: shiftIso(visit.admissionDate, 30 * MINUTE_MS) }));
      });

      await test.step('Post CARE_STARTED dated 1 ms before the triage', async () => {
        const response = await visitsApi.addMovement(visit._id, buildMovement('CARE_STARTED', { occurredAt: shiftIso(latest.occurredAt, -1) }));
        await expectApiError(response, [400, 409, 422]);
      });

      await test.step('The timeline holds only the triage and the visit did not start care', async () => {
        expect(idsOf(await visitsApi.getTimeline(visit._id))).toEqual([latest._id]);
        expect((await visitsApi.getVisit(visit._id)).status).toBe('OPEN');
      });
    });

    test('Returns 404 for the timeline of a visit that does not exist', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Get the movements of an unknown visit', async () => {
        await expectApiError(await visitsApi.findMovements(UNKNOWN_OBJECT_ID), 404, /visit/i);
      });
    });

    for (const malformedId of MALFORMED_IDS) {
      test(`Rejects the timeline of the malformed visit ID "${malformedId}"`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        await test.step('Get the movements of a malformed visit ID', async () => {
          await expectApiError(await visitsApi.findMovements(malformedId), [400, 404]);
        });
      });
    }
  });
});
