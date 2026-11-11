import { test, expect, VISIT_API_TAGS } from '../../../../fixtures/api.fixture';
import { expectStatus } from '../../helpers/http';
import { VISITS_ENDPOINTS } from '../../clients/endpoints';
import { HttpMethod } from '../../clients/visits';
import { expectClosedVisit, idsOf } from '../../assertions/visits';
import { buildMovement } from '../../payloads/visit';
import { CLOSED_VISIT_STATUSES, Visit, VisitMovement } from '../../helpers/models/visit';

/**
 * Rule 15, section 6 and AC 13: visits and movements are never physically
 * deleted and movements are append-only. Only the HTTP status is asserted for
 * endpoints that must not exist, because an unmatched route is not required to
 * return the business error body.
 */
test.describe('Visits API | Append-only history and no deletion', () => {
  test.describe('NEGATIVE', () => {
    test('Does not expose DELETE for visits and keeps the visit', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@SMOKE'],
    }, async ({ visitsApi }) => {
      let visit!: Visit;

      await test.step('Open a visit', async () => {
        ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
      });

      await test.step('Send DELETE to the visit resource', async () => {
        await expectStatus(await visitsApi.send('DELETE', VISITS_ENDPOINTS.byId(visit._id)), [404, 405]);
      });

      await test.step('The visit is still retrievable and unchanged', async () => {
        expect(await visitsApi.getVisit(visit._id)).toEqual(visit);
      });
    });

    for (const method of ['PUT', 'PATCH', 'DELETE'] as HttpMethod[]) {
      test(`Does not expose ${method} for a single movement and keeps it unchanged`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        let visit!: Visit;
        let movement!: VisitMovement;

        await test.step('Open a visit and record a transfer', async () => {
          ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
          movement = await visitsApi.appendMovement(visit._id, buildMovement('DEPARTMENT_TRANSFER', { departmentTo: 'Oncology' }));
        });

        await test.step(`Send ${method} to the movement resource`, async () => {
          const response = await visitsApi.send(method, VISITS_ENDPOINTS.movementById(visit._id, movement._id), {
            type: 'DISCHARGE',
            departmentTo: 'Tampered',
          });
          await expectStatus(response, [404, 405]);
        });

        await test.step('The movement and the visit are unchanged', async () => {
          expect(await visitsApi.getTimeline(visit._id)).toEqual([movement]);
          expect((await visitsApi.getVisit(visit._id)).status).toBe('OPEN');
        });
      });
    }

    for (const method of ['PUT', 'PATCH', 'DELETE'] as HttpMethod[]) {
      test(`Does not expose ${method} for the movement collection and keeps the history`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        let visit!: Visit;
        let timeline!: VisitMovement[];

        await test.step('Create a visit with triage and care-start movements', async () => {
          ({ visit } = await visitsApi.createVisitInStatus('OPEN'));
          await visitsApi.appendMovement(visit._id, buildMovement('TRIAGE'));
          await visitsApi.appendMovement(visit._id, buildMovement('CARE_STARTED'));
          timeline = await visitsApi.getTimeline(visit._id);
        });

        await test.step(`Send ${method} to the movements collection`, async () => {
          const response = await visitsApi.send(method, VISITS_ENDPOINTS.movements(visit._id), [buildMovement('OTHER')]);
          await expectStatus(response, [404, 405]);
        });

        await test.step('The history is unchanged', async () => {
          expect(await visitsApi.getTimeline(visit._id)).toEqual(timeline);
        });
      });
    }
  });

  test.describe('POSITIVE', () => {
    for (const status of CLOSED_VISIT_STATUSES) {
      test(`Keeps a ${status} visit and its complete history available`, {
        tag: [...VISIT_API_TAGS, '@POSITIVE'],
      }, async ({ visitsApi }) => {
        let visit!: Visit;
        let patientId!: string;

        await test.step(`Create a ${status} visit`, async () => {
          const created = await visitsApi.createVisitInStatus(status);
          visit = created.visit;
          patientId = created.patient._id;
        });

        await test.step('The visit is retrievable by ID, by patient and through the list filter', async () => {
          expectClosedVisit(await visitsApi.getVisit(visit._id), status);
          expect(idsOf(await visitsApi.listPatientVisits(patientId))).toEqual([visit._id]);
          expect(idsOf(await visitsApi.listVisits({ patientId, status }))).toEqual([visit._id]);
        });

        await test.step('The timeline ends with the closing movement', async () => {
          const timeline = await visitsApi.getTimeline(visit._id);
          expect(timeline.at(-1)?.type).toBe(status === 'COMPLETED' ? 'DISCHARGE' : 'CANCELLATION');
        });
      });
    }
  });
});
