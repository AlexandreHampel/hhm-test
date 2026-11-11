import { test as base, Page } from '@playwright/test';
import * as UI_SETTINGS from '../config/ui-settings';

type UiFixtures = {
  anotherSession: Page;
};

export const test = base.extend<UiFixtures>({
  /** A second, independent browser session, for scenarios where another user acts at the same time. */
  anotherSession: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: UI_SETTINGS.APP_BASE_URL });
    const page = await context.newPage();

    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';

/** Common tags for the General Registration UI scenarios. */
export const UI_TAGS = ['@UI', '@People'] as const;

/** Common tags for the module dashboard UI scenarios. */
export const DASHBOARD_TAGS = ['@UI', '@Dashboard'] as const;

/** Common tags for the Patient Visits UI scenarios. */
export const VISIT_UI_TAGS = ['@UI', '@Visits'] as const;
