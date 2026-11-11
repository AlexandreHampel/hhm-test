import { test, expect, VISIT_API_TAGS } from '../../../../fixtures/api.fixture';
import { expectStatus, readJson } from '../../helpers/http';
import { DAY_MS, HOUR_MS, isoAgo, shiftIso } from '../../helpers/time';
import { extractList, VisitsClient } from '../../clients/visits';
import { referenceId } from '../../helpers/references';
import { expectApiError, expectNewestAdmissionFirst, expectVisitContract, expectVisitToMatchPayload, idsOf } from '../../assertions/visits';
import { buildVisit, MALFORMED_IDS, UNKNOWN_OBJECT_ID } from '../../payloads/visit';
import { Person } from '../../helpers/models/person';
import { VISIT_STATUSES, VISIT_TYPES, Visit, VisitPayload, VisitType } from '../../helpers/models/visit';

/** Patient with three visits admitted 10, 5 and 1 days ago, oldest to newest. */
interface VisitHistory {
  patient: Person;
  admissions: string[];
  oldest: Visit;
  middle: Visit;
  newest: Visit;
}

/**
 * Creates three non-overlapping visits for one patient, admitted 10, 5 and 1
 * days ago. The first two are started and discharged with explicit timestamps so the history
 * stays chronologically consistent; the newest remains OPEN.
 */
async function createVisitHistory(visitsApi: VisitsClient, types: VisitType[] = ['OUTPATIENT', 'EMERGENCY', 'INPATIENT']): Promise<VisitHistory> {
  const patient = await visitsApi.registerPatient();
  const admissions = [isoAgo(10 * DAY_MS), isoAgo(5 * DAY_MS), isoAgo(1 * DAY_MS)];
  const visits: Visit[] = [];

  for (const [index, admissionDate] of admissions.entries()) {
    const visit = await visitsApi.openVisit(buildVisit(patient._id, { admissionDate, type: types[index] }));

    if (index < admissions.length - 1) {
      await visitsApi.appendMovement(visit._id, { type: 'CARE_STARTED', occurredAt: shiftIso(admissionDate, HOUR_MS) });
      await visitsApi.appendMovement(visit._id, { type: 'DISCHARGE', occurredAt: shiftIso(admissionDate, 2 * HOUR_MS) });
    }

    visits.push(await visitsApi.getVisit(visit._id));
  }

  const [oldest, middle, newest] = visits;

  return { patient, admissions, oldest, middle, newest };
}

test.describe('Visits API | Read visits', () => {
  test.describe('POSITIVE', () => {
    test('Returns the visit for an existing ID', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ visitsApi }) => {
      let payload!: VisitPayload;
      let created!: Visit;

      await test.step('Open a visit', async () => {
        const patient = await visitsApi.registerPatient();
        payload = buildVisit(patient._id, { type: 'INPATIENT' });
        created = await visitsApi.openVisit(payload);
      });

      await test.step('Get the visit by ID', async () => {
        const response = await visitsApi.findById(created._id);
        await expectStatus(response, 200);
        const found = await readJson<Visit>(response);
        expectVisitContract(found);
        expectVisitToMatchPayload(found, payload);
        expect(found._id).toBe(created._id);
      });
    });

    test('Lists every visit of one patient, newest admission first, and only that patient', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      let history!: VisitHistory;
      let otherPatientVisit!: Visit;

      await test.step('Create a visit history for a patient and a visit for another patient', async () => {
        history = await createVisitHistory(visitsApi);
        const otherPatient = await visitsApi.registerPatient();
        otherPatientVisit = await visitsApi.openVisit(buildVisit(otherPatient._id));
      });

      await test.step('The patient endpoint returns the three visits newest first', async () => {
        const visits = await visitsApi.listPatientVisits(history.patient._id);
        expect(idsOf(visits)).toEqual([history.newest._id, history.middle._id, history.oldest._id]);
        expect(idsOf(visits)).not.toContain(otherPatientVisit._id);

        for (const visit of visits) {
          expectVisitContract(visit);
          expect(referenceId(visit.patientId)).toBe(history.patient._id);
        }
      });
    });

    test('Returns an empty list for a patient without visits', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@BOUNDARY'],
    }, async ({ visitsApi }) => {
      await test.step('Register a patient and list their visits', async () => {
        const patient = await visitsApi.registerPatient();
        expect(await visitsApi.listPatientVisits(patient._id)).toEqual([]);
      });
    });

    test('Lists visits newest admission first by default', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      let history!: VisitHistory;

      await test.step('Create a visit history for a patient', async () => {
        history = await createVisitHistory(visitsApi);
      });

      await test.step('The list filtered by patient is ordered newest admission first', async () => {
        const visits = await visitsApi.listVisits({ patientId: history.patient._id });
        expect(idsOf(visits)).toEqual([history.newest._id, history.middle._id, history.oldest._id]);
      });

      await test.step('The unfiltered list follows the same deterministic order', async () => {
        expectNewestAdmissionFirst(await visitsApi.listVisits());
      });
    });

    for (const status of VISIT_STATUSES) {
      test(`Filters visits by status ${status}`, {
        tag: [...VISIT_API_TAGS, '@POSITIVE'],
      }, async ({ visitsApi }) => {
        let patient!: Person;
        let target!: Visit;

        await test.step(`Create a visit in status ${status}`, async () => {
          ({ patient, visit: target } = await visitsApi.createVisitInStatus(status));
        });

        await test.step(`Every visit returned by the ${status} filter has that status`, async () => {
          const visits = await visitsApi.listVisits({ status });

          for (const visit of visits) {
            expect(visit.status, `Visit ${visit._id} listed under ${status}`).toBe(status);
          }
        });

        await test.step('Combined with the patient filter, the target visit is returned exactly once', async () => {
          const visits = await visitsApi.listVisits({
            status,
            patientId: patient._id,
          });
          expect(idsOf(visits)).toEqual([target._id]);
        });

        await test.step('A different status combined with the patient filter excludes the target visit', async () => {
          const otherStatus = VISIT_STATUSES.find((candidate) => candidate !== status)!;
          const visits = await visitsApi.listVisits({
            status: otherStatus,
            patientId: patient._id,
          });
          expect(idsOf(visits)).toEqual([]);
        });
      });
    }

    test('Filters visits by type', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      let history!: VisitHistory;

      await test.step('Create OUTPATIENT, EMERGENCY and INPATIENT visits for one patient', async () => {
        history = await createVisitHistory(visitsApi, ['OUTPATIENT', 'EMERGENCY', 'INPATIENT']);
      });

      for (const [type, expected] of [
        ['OUTPATIENT', () => history.oldest],
        ['EMERGENCY', () => history.middle],
        ['INPATIENT', () => history.newest],
      ] as const) {
        await test.step(`The ${type} filter returns only the ${type} visit of the patient`, async () => {
          const visits = await visitsApi.listVisits({
            type,
            patientId: history.patient._id,
          });
          expect(idsOf(visits)).toEqual([expected()._id]);
        });
      }

      await test.step('Every visit returned by a type filter has that type', async () => {
        for (const type of VISIT_TYPES) {
          for (const visit of await visitsApi.listVisits({ type })) {
            expect(visit.type, `Visit ${visit._id} listed under ${type}`).toBe(type);
          }
        }
      });
    });

    test('Filters visits by patient', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      let first!: Visit;
      let second!: Visit;

      await test.step('Open one visit for each of two patients', async () => {
        first = await visitsApi.openVisit(buildVisit((await visitsApi.registerPatient())._id));
        second = await visitsApi.openVisit(buildVisit((await visitsApi.registerPatient())._id));
      });

      await test.step('Each patient filter returns only that patient visit', async () => {
        for (const visit of [first, second]) {
          const patientId = referenceId(visit.patientId)!;
          expect(idsOf(await visitsApi.listVisits({ patientId }))).toEqual([visit._id]);
        }
      });
    });

    test('Filters visits by responsible professional', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      let doctorId!: string;
      let attended!: Visit;
      let unattended!: Visit;

      await test.step('Open one visit attended by a doctor and one without a professional', async () => {
        doctorId = (await visitsApi.registerPerson(['DOCTOR']))._id;
        attended = await visitsApi.openVisit(buildVisit((await visitsApi.registerPatient())._id, { attendingProfessionalId: doctorId }));
        unattended = await visitsApi.openVisit(buildVisit((await visitsApi.registerPatient())._id));
      });

      await test.step('The professional filter returns only the attended visit', async () => {
        expect(idsOf(await visitsApi.listVisits({ professionalId: doctorId }))).toEqual([attended._id]);
      });

      await test.step('Combined with the patient of the other visit, it returns nothing', async () => {
        expect(await visitsApi.listVisits({ professionalId: doctorId, patientId: referenceId(unattended.patientId)! })).toEqual([]);
      });

      await test.step('A well-formed professional ID that attends nothing returns an empty list', async () => {
        expect(await visitsApi.listVisits({ professionalId: UNKNOWN_OBJECT_ID })).toEqual([]);
      });
    });

    test('Filters visits by admission date range', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@CONTRACT-ASSUMPTION'],
    }, async ({ visitsApi }) => {
      let history!: VisitHistory;

      await test.step('Create visits admitted 10, 5 and 1 days ago', async () => {
        history = await createVisitHistory(visitsApi);
      });

      await test.step('A range around the middle admission returns only the middle visit', async () => {
        const visits = await visitsApi.listVisits({
          patientId: history.patient._id,
          admissionFrom: isoAgo(6 * DAY_MS),
          admissionTo: isoAgo(4 * DAY_MS),
        });
        expect(idsOf(visits)).toEqual([history.middle._id]);
      });

      await test.step('An open-ended lower bound returns only the newer admissions', async () => {
        const visits = await visitsApi.listVisits({
          patientId: history.patient._id,
          admissionFrom: isoAgo(6 * DAY_MS),
        });
        expect(idsOf(visits)).toEqual([history.newest._id, history.middle._id]);
      });

      await test.step('An open-ended upper bound returns only the older admissions', async () => {
        const visits = await visitsApi.listVisits({
          patientId: history.patient._id,
          admissionTo: isoAgo(2 * DAY_MS),
        });
        expect(idsOf(visits)).toEqual([history.middle._id, history.oldest._id]);
      });

      await test.step('A range without admissions returns an empty list', async () => {
        const visits = await visitsApi.listVisits({
          patientId: history.patient._id,
          admissionFrom: isoAgo(9 * DAY_MS),
          admissionTo: isoAgo(6 * DAY_MS),
        });
        expect(visits).toEqual([]);
      });
    });

    test('Combines status, type and patient filters', {
      tag: [...VISIT_API_TAGS, '@POSITIVE'],
    }, async ({ visitsApi }) => {
      let history!: VisitHistory;

      await test.step('Create a patient with two COMPLETED visits and one OPEN visit', async () => {
        history = await createVisitHistory(visitsApi, ['EMERGENCY', 'EMERGENCY', 'EMERGENCY']);
      });

      await test.step('COMPLETED + EMERGENCY + patient returns the two closed visits newest first', async () => {
        const visits = await visitsApi.listVisits({
          status: 'COMPLETED',
          type: 'EMERGENCY',
          patientId: history.patient._id,
        });
        expect(idsOf(visits)).toEqual([history.middle._id, history.oldest._id]);
      });

      await test.step('COMPLETED + OUTPATIENT + patient returns nothing', async () => {
        const visits = await visitsApi.listVisits({
          status: 'COMPLETED',
          type: 'OUTPATIENT',
          patientId: history.patient._id,
        });
        expect(visits).toEqual([]);
      });
    });

    test('Paginates the visit list deterministically', {
      tag: [...VISIT_API_TAGS, '@POSITIVE', '@BOUNDARY', '@CONTRACT-ASSUMPTION'],
    }, async ({ visitsApi }) => {
      let history!: VisitHistory;

      await test.step('Create three visits for one patient', async () => {
        history = await createVisitHistory(visitsApi);
      });

      await test.step('Pages of one item walk the patient history newest first without repeats', async () => {
        const pages: string[] = [];

        for (const page of [1, 2, 3]) {
          const visits = await visitsApi.listVisits({
            patientId: history.patient._id,
            page: page,
            limit: 1,
          });
          expect(visits, `Page ${page} with limit 1`).toHaveLength(1);
          pages.push(visits[0]._id);
        }

        expect(pages).toEqual([history.newest._id, history.middle._id, history.oldest._id]);
      });

      await test.step('A page beyond the last one is empty', async () => {
        const visits = await visitsApi.listVisits({
          patientId: history.patient._id,
          page: 4,
          limit: 1,
        });
        expect(visits).toEqual([]);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Returns 404 for a well-formed visit ID that does not exist', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      await test.step('Get an unknown visit', async () => {
        await expectApiError(await visitsApi.findById(UNKNOWN_OBJECT_ID), 404, /visit/i);
      });
    });

    for (const malformedId of MALFORMED_IDS) {
      test(`Rejects the malformed visit ID "${malformedId}"`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE'],
      }, async ({ visitsApi }) => {
        await test.step('Get a visit by a malformed ID', async () => {
          await expectApiError(await visitsApi.findById(malformedId), [400, 404]);
        });
      });
    }

    test('Rejects listing visits of a malformed patient ID', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE'],
    }, async ({ visitsApi }) => {
      await test.step('List visits for a malformed patient ID', async () => {
        await expectApiError(await visitsApi.findByPatient('not-an-object-id'), [400, 404]);
      });
    });

    test('Does not return visits for a patient ID that does not exist', {
      tag: [...VISIT_API_TAGS, '@NEGATIVE', '@EDGE'],
    }, async ({ visitsApi }) => {
      await test.step('List visits for an unknown patient', async () => {
        const response = await visitsApi.findByPatient(UNKNOWN_OBJECT_ID);
        // "404 for missing resources" or an empty list are both acceptable.
        await expectStatus(response, [200, 404]);

        if (response.status() === 200) {
          expect(extractList(await readJson<unknown>(response), 'Visits by unknown patient')).toEqual([]);
        } else {
          await expectApiError(response, 404);
        }
      });
    });

    const invalidFilters: Array<{ label: string; query: Record<string, string>; tag?: string }> = [
      { label: 'an unsupported status', query: { status: 'ARCHIVED' } },
      { label: 'an unsupported type', query: { type: 'SURGERY' } },
      { label: 'a malformed patient ID', query: { patientId: 'not-an-object-id' } },
      { label: 'a malformed professional ID', query: { professionalId: 'not-an-object-id' } },
      {
        label: 'an unparseable admission start date',
        query: { admissionFrom: 'not-a-date' },
        tag: '@CONTRACT-ASSUMPTION',
      },
      {
        label: 'an unparseable admission end date',
        query: { admissionTo: 'not-a-date' },
        tag: '@CONTRACT-ASSUMPTION',
      },
    ];

    for (const { label, query, tag } of invalidFilters) {
      test(`Rejects a visit list filtered by ${label}`, {
        tag: [...VISIT_API_TAGS, '@NEGATIVE', ...(tag ? [tag] : [])],
      }, async ({ visitsApi }) => {
        await test.step(`List visits with ${label}`, async () => {
          await expectApiError(await visitsApi.findAll(query), [400, 422]);
        });
      });
    }
  });
});
