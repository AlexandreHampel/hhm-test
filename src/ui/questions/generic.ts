import { recordedConsoleErrors } from '../interactions/console';
import { DOCUMENT_MARKER } from '../interactions/document';
import { question } from '../screenplay/core';
import { Target } from '../screenplay/target';

/**
 * Generic questions about any target. They answer immediately with the current
 * state, returning null when the element is absent, so callers can poll them.
 */

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export const TextOf = {
  the: (target: Target) =>
    question(`Text of the ${target}`, async (page) => {
      const texts = await target.resolveFor(page).allInnerTexts();
      return texts.length ? normalise(texts.join(' ')) : null;
    }),
};

export const ValueOf = {
  the: (target: Target) =>
    question(`Value of the ${target}`, async (page) => {
      const locator = target.resolveFor(page);
      return (await locator.count()) ? locator.inputValue() : null;
    }),
};

export const IsDisplayed = {
  the: (target: Target) => question(`Whether the ${target} is displayed`, (page) => target.resolveFor(page).isVisible()),
};

export const IsEnabled = {
  the: (target: Target) =>
    question(`Whether the ${target} is enabled`, async (page) => {
      const locator = target.resolveFor(page);
      return (await locator.count()) ? locator.isEnabled() : null;
    }),
};

export const IsChecked = {
  the: (target: Target) =>
    question(`Whether the ${target} is checked`, async (page) => {
      const locator = target.resolveFor(page);
      return (await locator.count()) ? locator.isChecked() : null;
    }),
};

export const NumberOf = {
  the: (target: Target) => question(`Number of ${target}`, (page) => target.resolveFor(page).count()),
};

export const AttributeOf = {
  the: (name: string) => ({
    of: (target: Target) =>
      question(`${name} attribute of the ${target}`, async (page) => {
        const locator = target.resolveFor(page);
        return (await locator.count()) ? locator.getAttribute(name) : null;
      }),
  }),
};

export const CurrentPath = () => question('Current path', async (page) => new URL(page.url()).pathname);

/** Every data-testid currently rendered on the page. */
export const RenderedTestIds = () =>
  question('Rendered test IDs', (page) =>
    page.locator('[data-testid]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? '')),
  );

/** Whether the document marked earlier is still the one displayed, meaning no reload happened. */
export const IsTheMarkedDocument = () =>
  question('Whether the marked document is still displayed', (page) =>
    page.evaluate((marker) => (window as unknown as Record<string, boolean>)[marker] === true, DOCUMENT_MARKER),
  );

/** Today's calendar date in the browser timezone, the reference the form uses for birth dates. */
export const TodayInTheBrowser = () =>
  question('Today in the browser timezone', (page) =>
    page.evaluate(() => {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }),
  );

/** Console errors recorded since console recording started. */
export const ConsoleErrors = () => question('Console errors', async (page) => recordedConsoleErrors(page));
