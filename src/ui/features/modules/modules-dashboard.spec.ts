import { test, expect, DASHBOARD_TAGS } from '../../../../fixtures/ui.fixture';
import { NO_VIOLATIONS, testIdViolations } from '../../helpers/test-ids';
import { RecordConsoleErrors } from '../../interactions/console';
import { Navigate } from '../../interactions/navigate';
import { ConsoleErrors, CurrentPath, IsDisplayed, NumberOf, RenderedTestIds, TextOf } from '../../questions/generic';
import { ask, perform } from '../../screenplay/core';
import { AppShell, Dashboard, Landing } from '../../targets/dashboard';
import { PeopleList } from '../../targets/people';
import { PROTOTYPE_PATIENTS_ROUTE, UI_ROUTES } from '../../targets/routes';
import { OpenGeneralRegistration, OpenTheDashboard, OpenTheLandingPage, OpenTheModule, ReturnToTheDashboard } from '../../tasks/navigation';

test.describe('Modules UI | Dashboard', () => {
  test.describe('POSITIVE', () => {
    test('Lists the General Registration module with its name and description', {
      tag: [...DASHBOARD_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      await perform(page, OpenTheDashboard());

      await test.step('The General Registration card shows its name, description and open action', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(Dashboard.card('general-registration')))).toBe(true);
        await expect.poll(() => ask(page, TextOf.the(Dashboard.name('general-registration')))).toBe('General Registration');
        await expect.poll(() => ask(page, TextOf.the(Dashboard.description('general-registration')))).toBe('Manage people, patients and healthcare professionals.');
        await expect.poll(() => ask(page, IsDisplayed.the(Dashboard.openButton('general-registration')))).toBe(true);
      });

      await test.step('No placeholder module is displayed', async () => {
        await expect.poll(() => ask(page, NumberOf.the(Dashboard.MODULE_CARDS))).toBe(1);
      });
    });

    test('Opens General Registration from the dashboard', {
      tag: [...DASHBOARD_TAGS, '@POSITIVE', '@SMOKE'],
    }, async ({ page }) => {
      await perform(page, OpenTheDashboard(), OpenTheModule.withId('general-registration'));

      await test.step('The General Registration page is displayed', async () => {
        await expect.poll(() => ask(page, CurrentPath())).toBe(UI_ROUTES.people);
        await expect.poll(() => ask(page, TextOf.the(PeopleList.TITLE))).toBe('General Registration');
      });
    });

    test('Returns to the dashboard from General Registration', {
      tag: [...DASHBOARD_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenGeneralRegistration(), ReturnToTheDashboard());

      await test.step('The dashboard is displayed', async () => {
        await expect.poll(() => ask(page, CurrentPath())).toBe(UI_ROUTES.dashboard);
        await expect.poll(() => ask(page, IsDisplayed.the(Dashboard.PAGE))).toBe(true);
      });
    });

    test('Keeps the landing page available at the root route', {
      tag: [...DASHBOARD_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenTheLandingPage());

      await test.step('The landing page is rendered', async () => {
        await expect.poll(() => ask(page, TextOf.the(Landing.MAIN_HEADING))).toContain('Hospital Management');
      });
    });

    test('Exposes unique dashboard test IDs derived from module IDs', {
      tag: [...DASHBOARD_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      await perform(page, OpenTheDashboard());

      await test.step('Mandatory dashboard test IDs are present', async () => {
        const testIds = await ask(page, RenderedTestIds());

        for (const required of ['app-page', 'app-modules-list', 'app-module-general-registration', 'app-module-open-general-registration']) {
          expect(testIds, `Missing test ID ${required}`).toContain(required);
        }
      });

      await test.step('Every rendered test ID is unique and kebab case', async () => {
        expect(testIdViolations(await ask(page, RenderedTestIds()))).toEqual(NO_VIOLATIONS);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('No longer serves the prototype patients page', {
      tag: [...DASHBOARD_TAGS, '@NEGATIVE', '@LEGACY_ROUTE'],
    }, async ({ page }) => {
      await perform(page, RecordConsoleErrors(), Navigate.to(PROTOTYPE_PATIENTS_ROUTE));

      await test.step('The router rejects the obsolete route', async () => {
        await expect.poll(async () => (await ask(page, ConsoleErrors())).join('\n')).toContain(`Cannot match any routes. URL Segment: '${PROTOTYPE_PATIENTS_ROUTE.slice(1)}'`);
      });

      await test.step('No page is rendered for it', async () => {
        expect(await ask(page, NumberOf.the(AppShell.RENDERED_PAGES))).toBe(0);
        expect(await ask(page, IsDisplayed.the(Dashboard.PAGE))).toBe(false);
        expect(await ask(page, IsDisplayed.the(PeopleList.PAGE))).toBe(false);
      });
    });
  });
});
