import { test as base, Page } from '@playwright/test';
import * as UI_SETTINGS from '../config/ui-settings';
import { perform } from '../src/ui/screenplay/core';
import { submittedPeople } from '../src/ui/screenplay/memory';
import { RemoveTheSubmittedPerson } from '../src/ui/tasks/cleanup';

type UiFixtures = {
  anotherSession: Page;
  removeSubmittedPeople: void;
};

/**
 * Removes, through the interface, every person submitted from the given pages.
 * It runs on a fresh page so the state left by the scenario cannot interfere,
 * and it never fails the scenario: cleanup must not mask the real result.
 */
async function removePeopleSubmittedFrom(pages: Page[], cleanupPage: Page): Promise<void> {
  for (const person of pages.flatMap((page) => submittedPeople(page))) {
    try {
      await perform(cleanupPage, RemoveTheSubmittedPerson.matching(person));
    } catch (error) {
      console.warn(`Could not remove the person with CPF ${person.cpf}: ${(error as Error).message}`);
    }
  }
}

/**
 * UI fixtures. Every action goes through the interface: scenarios prepare,
 * verify and clean up their data with the same screens a user would use.
 */
export const test = base.extend<UiFixtures>({
  /** A second, independent browser session, for scenarios where another user acts at the same time. */
  anotherSession: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: UI_SETTINGS.APP_BASE_URL });
    const page = await context.newPage();

    await use(page);

    const cleanupPage = await context.newPage();
    await removePeopleSubmittedFrom([page], cleanupPage);
    await context.close();
  },

  removeSubmittedPeople: [
    async ({ page, context }, use) => {
      await use();

      await context.setOffline(false);
      const cleanupPage = await context.newPage();
      await removePeopleSubmittedFrom([page], cleanupPage);
      await cleanupPage.close();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

/** Common tags for the General Registration UI scenarios. */
export const UI_TAGS = ['@UI', '@People'] as const;

/** Common tags for the module dashboard UI scenarios. */
export const DASHBOARD_TAGS = ['@UI', '@Dashboard'] as const;
