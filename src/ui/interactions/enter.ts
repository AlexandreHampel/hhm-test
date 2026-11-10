import { interaction } from '../screenplay/core';
import { Target } from '../screenplay/target';

/** Types a value into an input, replacing what it held. */
export const Enter = {
  theValue: (value: string) => ({
    into: (target: Target) =>
      interaction(`Enter "${value}" into the ${target}`, async (page) => {
        await target.resolveFor(page).fill(value);
      }),
  }),
};

/** Empties an input. */
export const Clear = {
  theValueOf: (target: Target) =>
    interaction(`Clear the ${target}`, async (page) => {
      await target.resolveFor(page).clear();
    }),
};
