import { interaction } from '../screenplay/core';
import { Target } from '../screenplay/target';

/** Chooses an option of a dropdown by its value. */
export const Select = {
  option: (value: string) => ({
    from: (target: Target) =>
      interaction(`Select "${value}" from the ${target}`, async (page) => {
        await target.resolveFor(page).selectOption(value);
      }),
  }),
};
