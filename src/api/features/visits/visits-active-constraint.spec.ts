import { test, expect, VISIT_API_TAGS } from '../../../../fixtures/api.fixture';
import { DAY_MS, isoAgo } from '../../helpers/time';
import { expectActiveVisit, expectApiError, expectClosedVisit, expectVisitContract, idsOf } from '../../assertions/visits';
import { buildVisit } from '../../payloads/visit';
import { Person } from '../../helpers/models/person';
import { ACTIVE_VISIT_STATUSES, CLOSING_MOVEMENTS, ClosingMovementType, Visit } from '../../helpers/models/visit';

/**
 * Business rules 2 and 3, acceptance criteria 3, 21, 22 and 23:
 * a patient may have many historical visits but at most one active visit.
 */
test.describe('Visits API | Single active visit per patient', () => {
  test.describe('POSITIVE', () => {
    for (const [closingType, closedStatus] of Object.entries(CLOSING_MOVEMENTS) as Array<[ClosingMovementType, string]>) {
      test(`Allows a new visit once the previous one is ${closedStatus}`, {
        tag: [...VISIT_API_TAGS, '@POSITIVE', '@SMOKE'],
      }, async ({ visitsApi }) => {
        let patient!: Person;
        let first!: Visit;
        let second!: Visit;

        await test.step('Register a patient and open a first visit', async () => {
          patient = await visitsApi.registerPatient();
          first = await visitsApi.openVisit(buildVisit(patient._id, { admissionDate: isoAgo(2 * DAY_MS) }));
        });

        await test.step(`Close the first visit with ${closingType}`, async () => {
          expectClosedVisit(await visitsApi.closeVisit(first._id, closingType), closedStatus as Visit['status']);
        });

        await test.step('Open a second visit for the same patient', async () => {
          second = await visitsApi.openVisit(buildVisit(patient._id, { admissionDate: undefined }));
          expectVisitContract(second);
          expectActiveVisit(second, 'OPEN');
          expect(second._id).not.toBe(first._id);
        });

        await test.step('The patient holds both visits and the closed one is preserved', async () => {
          const visits = await visitsApi.listPatientVisits(patient._id);
          expect(idsOf(visits).sort()).toEqual([first._id, second._id].sort());
          expectClosedVisit(visits.find((visit) => visit._id === first._id)!, closedStatus as Visit['status']);
        });
      });
    }

    test('Keeps several historical visits linked to a single people record', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi, peopleApi }) => {
      let patient!: Person;
      const visitIds: string[] = [];

      await test.step('Register a patient', async () => {
        patient = await visitsApi.registerPatient();
      });

      await test.step('Complete one visit, cancel another and keep a third open', async () => {
        const completed = await visitsApi.openVisit(buildVisit(patient._id, { admissionDate: isoAgo(3 * DAY_MS) }));
        await visitsApi.closeVisit(completed._id, 'DISCHARGE');
        const cancelled = await visitsApi.openVisit(buildVisit(patient._id, { admissionDate: undefined }));
        await visitsApi.closeVisit(cancelled._id, 'CANCELLATION');
        const open = await visitsApi.openVisit(buildVisit(patient._id, { admissionDate: undefined }));
        visitIds.push(completed._id, cancelled._id, open._id);
      });

      await test.step('The patient lists three visits with exactly one active', async () => {
        const visits = await visitsApi.listPatientVisits(patient._id);
        expect(idsOf(visits).sort()).toEqual([...visitIds].sort());
        const active = visits.filter((visit) => (ACTIVE_VISIT_STATUSES as readonly string[]).includes(visit.status));
        expect(idsOf(active)).toEqual([visitIds[2]]);
      });

      await test.step('The personal data is neither duplicated nor modified', async () => {
        const all = await peopleApi.listAll();
        expect(all.filter((person: Person) => person.cpf === patient.cpf)).toHaveLength(1);
        expect(await peopleApi.getPerson(patient._id)).toEqual(patient);
      });
    });

    test('Allows different patients to hold active visits at the same time', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Open one visit for each of two patients', async () => {
        const first = await visitsApi.registerPatient();
        const second = await visitsApi.registerPatient();
        const [firstVisit, secondVisit] = await Promise.all([
          visitsApi.openVisit(buildVisit(first._id)),
          visitsApi.openVisit(buildVisit(second._id)),
        ]);
        expectActiveVisit(firstVisit, 'OPEN');
        expectActiveVisit(secondVisit, 'OPEN');
      });
    });
  });

  test.describe('NEGATIVE', () => {
    for (const activeStatus of ACTIVE_VISIT_STATUSES) {
      test(`Rejects a second visit with 409 while the first one is ${activeStatus}`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE', '@SMOKE'],
      }, async ({ visitsApi }) => {
        let patient!: Person;
        let existing!: Visit;

        await test.step(`Create a patient whose visit is ${activeStatus}`, async () => {
          ({ patient, visit: existing } = await visitsApi.createVisitInStatus(activeStatus));
        });

        await test.step('Post a second visit for the same patient', async () => {
          const response = await visitsApi.create(buildVisit(patient._id, { type: 'EMERGENCY' }));
          await expectApiError(response, 409, /active/i);
        });

        await test.step('No record is created and the existing visit is unchanged', async () => {
          const visits = await visitsApi.listPatientVisits(patient._id);
          expect(idsOf(visits)).toEqual([existing._id]);
          expect(await visitsApi.getVisit(existing._id)).toEqual(existing);
        });
      });
    }

    test('Rejects simultaneous creation requests, keeping exactly one active visit', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      const attempts = 5;
      let patient!: Person;
      let statuses: number[] = [];

      await test.step('Register a patient', async () => {
        patient = await visitsApi.registerPatient();
      });

      await test.step(`Fire ${attempts} simultaneous create requests for the patient`, async () => {
        const responses = await Promise.all(
          Array.from({ length: attempts }, () => visitsApi.create(buildVisit(patient._id))),
        );
        statuses = responses.map((response) => response.status());
      });

      await test.step('Exactly one request succeeds and the others get 409 Conflict', async () => {
        const created = statuses.filter((status) => status === 201);
        const conflicts = statuses.filter((status) => status === 409);
        expect(created, `Statuses: ${statuses}`).toHaveLength(1);
        expect(conflicts, `Statuses: ${statuses}`).toHaveLength(attempts - 1);
      });

      await test.step('Exactly one visit exists for the patient', async () => {
        const visits = await visitsApi.listPatientVisits(patient._id);
        expect(visits, `Visits: ${idsOf(visits)}`).toHaveLength(1);
        expectActiveVisit(visits[0], 'OPEN');
      });
    });
  });
});
