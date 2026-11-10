import { interaction } from '../screenplay/core';
import { Target } from '../screenplay/target';

/** Checks a checkbox. */
export const Check = {
  the: (target: Target) =>
    interaction(`Check the ${target}`, async (page) => {
      await target.resolveFor(page).check();
    }),
};

/** Unchecks a checkbox. */
export const Uncheck = {
  the: (target: Target) =>
    interaction(`Uncheck the ${target}`, async (page) => {
      await target.resolveFor(page).uncheck();
    }),
};
