import { interaction } from '../screenplay/core';
import { Target } from '../screenplay/target';

/** Clicks an element. */
export const Click = {
  on: (target: Target) =>
    interaction(`Click the ${target}`, async (page) => {
      await target.resolveFor(page).click();
    }),
};
