import { Page } from '@playwright/test';
import { DisplayedMovement, DisplayedVisitRow, DisplayedVisitSummary } from '../helpers/visits';
import { question } from '../screenplay/core';
import { FinderTargets, VISIT_COLUMNS, VisitDetails, VisitsList } from '../targets/visits';
import { TextOf } from './generic';

const ROW_PREFIX = 'visits-row-';
const ENTRY_PREFIX = 'visits-movement-entry-';

/** Text content of the element, ignoring CSS text transforms such as upper-case headers. */
async function contentOf(page: Page, testId: string): Promise<string | null> {
  const locator = page.getByTestId(testId);

  return (await locator.count()) ? ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim() : null;
}

/** IDs of the visits listed on the current page of the table, in screen order. */
export const ListedVisitIds = () =>
  question('IDs of the listed visits', (page) =>
    VisitsList.ROWS.resolveFor(page).evaluateAll(
      (rows, prefix) => rows.map((row) => (row.getAttribute('data-testid') ?? '').replace(prefix, '')),
      ROW_PREFIX,
    ),
  );

/** Column headers of the visit table as written in the page, regardless of their CSS case. */
export const VisitTableHeaders = () =>
  question('Headers of the visit table', async (page) =>
    (await VisitsList.HEADERS.resolveFor(page).allTextContents()).map((header) => header.replace(/\s+/g, ' ').trim()),
  );

/** Everything a list row shows for a visit, or null when the row is not displayed. */
export const VisitRow = {
  of: (visitId: string) =>
    question(`Row of visit ${visitId}`, async (page): Promise<DisplayedVisitRow | null> => {
      if (!(await VisitsList.row(visitId).resolveFor(page).count())) {
        return null;
      }

      const [patient, type, admission, status, professional] = await Promise.all(
        VISIT_COLUMNS.map(async (column) => (await TextOf.the(VisitsList.cell(column, visitId)).answeredBy(page)) ?? ''),
      );

      return { patient, type, admission, status, professional };
    }),
};

/** ID of the only listed visit of the patient, or undefined when none is listed. Fails when several are. */
export const IdOfTheListedVisit = {
  ofPatient: (patientName: string) =>
    question(`ID of the listed visit of ${patientName}`, async (page) => {
      const matches: string[] = [];

      for (const visitId of await ListedVisitIds().answeredBy(page)) {
        if ((await TextOf.the(VisitsList.cell('patient', visitId)).answeredBy(page)) === patientName) {
          matches.push(visitId);
        }
      }

      if (matches.length > 1) {
        throw new Error(`Expected at most one listed visit of ${patientName}, found ${matches.join(', ')}`);
      }

      return matches[0];
    }),
};

/** Whether the row of the visit is selected. */
export const IsVisitRowSelected = {
  of: (visitId: string) =>
    question(`Whether the row of visit ${visitId} is selected`, async (page) =>
      (await VisitsList.row(visitId).resolveFor(page).getAttribute('aria-selected')) === 'true',
    ),
};

/** What the details summary shows, or null while the summary is not displayed. */
export const VisitSummary = () =>
  question('Visit summary', async (page): Promise<DisplayedVisitSummary | null> => {
    if (!(await VisitDetails.SUMMARY.resolveFor(page).isVisible())) {
      return null;
    }

    const text = async (target: Parameters<typeof TextOf.the>[0]) => (await TextOf.the(target).answeredBy(page)) ?? '';

    return {
      status: await text(VisitDetails.STATUS),
      patient: await text(VisitDetails.PATIENT),
      type: await text(VisitDetails.TYPE),
      admission: await text(VisitDetails.ADMISSION),
      professional: await text(VisitDetails.PROFESSIONAL),
      closedAt: await text(VisitDetails.CLOSED_AT),
      chiefComplaint: await text(VisitDetails.CHIEF_COMPLAINT),
      notes: await text(VisitDetails.NOTES),
    };
  });

/** IDs of the movements in the timeline, in screen order. */
export const TimelineMovementIds = () =>
  question('IDs of the movements in the timeline', (page) =>
    VisitDetails.TIMELINE_ENTRIES.resolveFor(page).evaluateAll(
      (entries, prefix) => entries.map((entry) => (entry.getAttribute('data-testid') ?? '').replace(prefix, '')),
      ENTRY_PREFIX,
    ),
  );

/** Every movement the timeline shows, in screen order. */
export const TimelineMovements = () =>
  question('Movements shown in the timeline', async (page): Promise<DisplayedMovement[]> => {
    const movements: DisplayedMovement[] = [];

    for (const id of await TimelineMovementIds().answeredBy(page)) {
      const part = (name: Parameters<typeof VisitDetails.entryPart>[0]) => TextOf.the(VisitDetails.entryPart(name, id)).answeredBy(page);

      movements.push({
        id,
        type: (await part('type')) ?? '',
        occurredAt: (await part('occurred-at')) ?? '',
        departments: await part('departments'),
        professional: await part('professional'),
        description: await part('description'),
      });
    }

    return movements;
  });

/** The `datetime` attribute of every timeline entry, in screen order: the exact instants behind the displayed minutes. */
export const TimelineInstants = () =>
  question('Instants of the movements in the timeline', async (page) => {
    const instants: string[] = [];

    for (const id of await TimelineMovementIds().answeredBy(page)) {
      instants.push((await VisitDetails.entryPart('occurred-at', id).resolveFor(page).getAttribute('datetime')) ?? '');
    }

    return instants;
  });

/** IDs of the people listed by a finder, in screen order. */
export const FinderResultIds = {
  of: (finder: FinderTargets) =>
    question(`IDs listed by the ${finder.DIALOG}`, (page) =>
      finder.ROWS.resolveFor(page).evaluateAll(
        (rows, prefix) => rows.map((row) => (row.getAttribute('data-testid') ?? '').replace(prefix, '')),
        finder.rowPrefix,
      ),
    ),
};

/** ID of the finder result showing exactly the given name, or undefined. */
export const IdOfTheFinderResult = {
  named: (finder: FinderTargets, name: string) =>
    question(`ID of the result named ${name} in the ${finder.DIALOG}`, async (page) => {
      for (const personId of await FinderResultIds.of(finder).answeredBy(page)) {
        if ((await TextOf.the(finder.cell('name', personId)).answeredBy(page)) === name) {
          return personId;
        }
      }

      return undefined;
    }),
};

/** Raw text content of a test ID, unaffected by CSS text transforms. */
export const ContentOf = {
  testId: (testId: string) => question(`Text content of ${testId}`, (page) => contentOf(page, testId)),
};

/** Current browser-local date and time, in the `YYYY-MM-DDTHH:mm` shape of a datetime-local input. */
export const NowInTheBrowser = () =>
  question('Now in the browser timezone', (page) =>
    page.evaluate(() => {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }),
  );
