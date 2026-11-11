import { Page } from '@playwright/test';
import { test, expect, VISIT_UI_TAGS } from '../../../../fixtures/ui.fixture';
import { NO_VIOLATIONS, testIdViolations } from '../../helpers/test-ids';
import { Click } from '../../interactions/click';
import { Navigate } from '../../interactions/navigate';
import { ResizeTheWindow } from '../../interactions/viewport';
import { Wait } from '../../interactions/wait';
import { HorizontalOverflow, IsDisplayed, IsEnabled, RenderedTestIds, StyleOf, TextOf } from '../../questions/generic';
import { ask, perform } from '../../screenplay/core';
import { Target } from '../../screenplay/target';
import { Dashboard, Landing } from '../../targets/dashboard';
import { PeopleList } from '../../targets/people';
import { UI_ROUTES } from '../../targets/routes';
import { FilterPatientFinder, MovementForm, NewVisit, PatientFinder, VisitDetails, VisitsFilter, VisitsList } from '../../targets/visits';
import { OpenGeneralRegistration, OpenTheDashboard, OpenTheModule } from '../../tasks/navigation';
import { aVisitInStatus } from '../../tasks/visit-preconditions';
import { FindTheVisits, OpenPatientVisits, OpenVisitDetails, SearchInTheFinder, StartANewVisit, StartAddingAMovement } from '../../tasks/visits';

const IDENTITY_PROPERTIES = ['background-color', 'color', 'font-family', 'font-size', 'font-weight', 'border-radius'] as const;

/** Computed style of the target, read on the page currently displayed. */
async function styleOf(page: Page, target: Target) {
  return ask(page, StyleOf.the(target).properties(IDENTITY_PROPERTIES));
}

/** Test IDs that contain a CPF: eleven digits, masked or not, or the digits of a known CPF. */
function testIdsExposingCpf(testIds: readonly string[], knownCpfs: readonly string[]): string[] {
  return testIds.filter((testId) => /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(testId) || knownCpfs.some((cpf) => testId.includes(cpf)));
}

test.describe('Visits UI | Navigation, identity and test IDs', () => {
  test.describe('POSITIVE', () => {
    test('Lists Patient Visits in the module catalog (AC 15)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      await perform(page, OpenTheDashboard());

      await test.step('The Patient Visits card shows its name and icon', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(Dashboard.card('patient-visits')))).toBe(true);
        await expect.poll(() => ask(page, TextOf.the(Dashboard.name('patient-visits')))).toBe('Patient Visits');
        expect(await ask(page, RenderedTestIds())).toContain('app-module-icon-patient-visits');
      });

      await test.step('General Registration is still offered next to it (AC 17)', async () => {
        expect(await ask(page, IsDisplayed.the(Dashboard.card('general-registration')))).toBe(true);
      });
    });

    test('Opens the visit list from its dashboard card (AC 15)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      await perform(page, OpenTheDashboard(), OpenTheModule.withId('patient-visits'));

      await test.step('The Patient Visits list is displayed with its actions', async () => {
        await expect.poll(() => ask(page, TextOf.the(VisitsList.TITLE))).toBe('Patient Visits');
        expect(await ask(page, IsDisplayed.the(VisitsList.NEW_BUTTON))).toBe(true);
        expect(await ask(page, IsDisplayed.the(VisitsList.VIEW_DETAILS_BUTTON))).toBe(true);
      });
    });

    test('Returns to the dashboard from the visit list', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), Click.on(VisitsList.BACK_LINK), Wait.until(Dashboard.PAGE).isVisible());

      await test.step('The dashboard is displayed again', async () => {
        expect(await ask(page, IsDisplayed.the(Dashboard.card('patient-visits')))).toBe(true);
      });
    });

    test('Keeps General Registration operational next to the new module (AC 17)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenPatientVisits(), Click.on(VisitsList.BACK_LINK), Wait.until(Dashboard.PAGE).isVisible(), OpenGeneralRegistration());

      await test.step('General Registration opens with its own actions', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleList.PAGE))).toBe(true);
        expect(await ask(page, IsEnabled.the(PeopleList.ADD_BUTTON))).toBe(true);
      });
    });

    test('Uses the visual identity of the established modules (AC 14)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      let reference!: Record<string, unknown>;

      await test.step('Read the identity of General Registration', async () => {
        await perform(page, OpenGeneralRegistration());
        reference = {
          page: await styleOf(page, PeopleList.PAGE),
          title: await styleOf(page, PeopleList.TITLE),
          backLink: await styleOf(page, PeopleList.BACK_LINK),
          primaryAction: await styleOf(page, PeopleList.ADD_BUTTON),
          body: await styleOf(page, Target.the('Page body').locatedBy((current) => current.locator('body'))),
        };
      });

      await test.step('Patient Visits renders the same page, title, navigation and primary action styles', async () => {
        await perform(page, OpenPatientVisits());
        expect({
          page: await styleOf(page, VisitsList.PAGE),
          title: await styleOf(page, VisitsList.TITLE),
          backLink: await styleOf(page, VisitsList.BACK_LINK),
          primaryAction: await styleOf(page, VisitsList.NEW_BUTTON),
          body: await styleOf(page, Target.the('Page body').locatedBy((current) => current.locator('body'))),
        }).toEqual(reference);
      });

      await test.step('Roboto is the typeface', async () => {
        expect((reference.title as Record<string, string>)['font-family']).toContain('Roboto');
      });
    });

    for (const [width, height] of [[390, 844], [768, 1024]] as const) {
      test(`Fits a ${width}px wide screen without horizontal scrolling (AC 14)`, {
        tag: [...VISIT_UI_TAGS, '@POSITIVE', '@EDGE'],
      }, async ({ page }) => {
        const { patient, visitId } = await aVisitInStatus(page, 'IN_PROGRESS');

        await perform(page, ResizeTheWindow.to(width, height));

        await test.step('The visit list fits the screen', async () => {
          await perform(page, OpenPatientVisits());
          expect(await ask(page, HorizontalOverflow())).toBe(0);
        });

        await test.step('The New Visit form fits the screen', async () => {
          await perform(page, StartANewVisit());
          expect(await ask(page, HorizontalOverflow())).toBe(0);
        });

        await test.step('The visit details fit the screen', async () => {
          await perform(page, FindTheVisits.ofPatient(patient.name), OpenVisitDetails.withId(visitId));
          expect(await ask(page, HorizontalOverflow())).toBe(0);
        });
      });
    }
  });

  test.describe('NEGATIVE', () => {
    const routes = [
      { name: 'visit list', route: UI_ROUTES.visits },
      { name: 'New Visit', route: UI_ROUTES.newVisit },
      { name: 'visit details', route: UI_ROUTES.visitDetails('ffffffffffffffffffffffff') },
    ];

    for (const { name, route } of routes) {
      test(`Opening the ${name} route directly redirects to the landing page`, {
        tag: [...VISIT_UI_TAGS, '@NEGATIVE', '@EDGE'],
      }, async ({ page }) => {
        await perform(page, Navigate.to(route));

        await test.step('The landing page is shown instead of the module page', async () => {
          await expect.poll(() => ask(page, IsDisplayed.the(Landing.ACCESS_SYSTEM_BUTTON))).toBe(true);
          expect(await ask(page, IsDisplayed.the(VisitsList.PAGE))).toBe(false);
          expect(await ask(page, IsDisplayed.the(NewVisit.PAGE))).toBe(false);
          expect(await ask(page, IsDisplayed.the(VisitDetails.PAGE))).toBe(false);
        });
      });
    }
  });

  test.describe('TEST IDS', () => {
    test('Exposes the documented module-prefixed test IDs (7.5, AC 16)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient, visitId } = await aVisitInStatus(page, 'IN_PROGRESS');

      await test.step('The list exposes visits-new-button', async () => {
        await perform(page, OpenPatientVisits());
        expect(await ask(page, RenderedTestIds())).toContain('visits-new-button');
      });

      await test.step('The New Visit form exposes a visits-patient control and visits-save-button', async () => {
        await perform(page, StartANewVisit());
        const testIds = await ask(page, RenderedTestIds());
        expect(testIds).toContain('visits-save-button');
        expect(testIds.some((testId) => testId.startsWith('visits-patient-')), 'A visits-patient-* selector control is rendered').toBe(true);
      });

      await test.step('The details page exposes visits-movement-add-button and visits-movement-timeline', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name), OpenVisitDetails.withId(visitId));
        const testIds = await ask(page, RenderedTestIds());
        expect(testIds).toContain('visits-movement-add-button');
        expect(testIds).toContain('visits-movement-timeline');
      });
    });

    test('Keeps every rendered test ID unique, kebab case and free of array indexes (7.5)', {
      tag: [...VISIT_UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const { patient, visitId } = await aVisitInStatus(page, 'IN_PROGRESS');

      await test.step('Visit list with rows', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name));
        expect(testIdViolations(await ask(page, RenderedTestIds()))).toEqual(NO_VIOLATIONS);
      });

      await test.step('Visit list with the filter dialog and its patient finder showing results', async () => {
        await perform(page, Click.on(VisitsFilter.OPEN_BUTTON), Wait.until(VisitsFilter.DIALOG).isVisible(), SearchInTheFinder.of(FilterPatientFinder).byName(patient.name));
        expect(testIdViolations(await ask(page, RenderedTestIds()))).toEqual(NO_VIOLATIONS);
      });

      await test.step('New Visit form with the patient selector showing results', async () => {
        await perform(page, OpenPatientVisits(), StartANewVisit(), SearchInTheFinder.of(PatientFinder).byName(patient.name));
        expect(testIdViolations(await ask(page, RenderedTestIds()))).toEqual(NO_VIOLATIONS);
      });

      await test.step('Details page with its timeline and the Add Movement dialog', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name), OpenVisitDetails.withId(visitId), StartAddingAMovement());
        expect(await ask(page, IsDisplayed.the(MovementForm.DIALOG))).toBe(true);
        expect(testIdViolations(await ask(page, RenderedTestIds()))).toEqual(NO_VIOLATIONS);
      });
    });

    test('Never exposes a CPF in a test ID (7.5)', {
      tag: [...VISIT_UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      const { patient, visitId } = await aVisitInStatus(page, 'IN_PROGRESS');
      const renderedOnEveryPage: string[] = [];

      await test.step('Collect the test IDs of the list, the filter and New Visit patient selectors and the details page', async () => {
        await perform(page, FindTheVisits.ofPatient(patient.name));
        renderedOnEveryPage.push(...(await ask(page, RenderedTestIds())));
        await perform(page, Click.on(VisitsFilter.OPEN_BUTTON), Wait.until(VisitsFilter.DIALOG).isVisible(), SearchInTheFinder.of(FilterPatientFinder).byName(patient.name));
        renderedOnEveryPage.push(...(await ask(page, RenderedTestIds())));
        await perform(page, OpenPatientVisits());
        await perform(page, StartANewVisit(), SearchInTheFinder.of(PatientFinder).byName(patient.name));
        renderedOnEveryPage.push(...(await ask(page, RenderedTestIds())));
        await perform(page, FindTheVisits.ofPatient(patient.name), OpenVisitDetails.withId(visitId));
        renderedOnEveryPage.push(...(await ask(page, RenderedTestIds())));
      });

      await test.step('No test ID contains a CPF', async () => {
        expect(testIdsExposingCpf(renderedOnEveryPage, [patient.cpf])).toEqual([]);
      });
    });
  });
});
