import { interaction } from '../screenplay/core';

/** Name of the flag stored on the current document to detect page reloads. */
export const DOCUMENT_MARKER = 'qaDocumentMarker';

/** Marks the current document, so a later question can tell whether the page was reloaded. */
export const MarkTheCurrentDocument = () =>
  interaction('Mark the current document', async (page) => {
    await page.evaluate((marker) => {
      (window as unknown as Record<string, boolean>)[marker] = true;
    }, DOCUMENT_MARKER);
  });
