import { Page } from '@playwright/test';
import { interaction } from '../screenplay/core';

const recorded = new WeakMap<Page, string[]>();

/** Starts recording the errors the application writes to the browser console. */
export const RecordConsoleErrors = () =>
  interaction('Record console errors', async (page) => {
    if (recorded.has(page)) {
      return;
    }

    const errors: string[] = [];
    recorded.set(page, errors);
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
  });

/** Console errors recorded so far for the page. */
export function recordedConsoleErrors(page: Page): string[] {
  return [...(recorded.get(page) ?? [])];
}
