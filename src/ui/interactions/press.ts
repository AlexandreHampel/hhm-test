import { interaction } from '../screenplay/core';
import { Target } from '../screenplay/target';

/** Presses a keyboard key, on the focused element or, with `in`, on a given one. */
export const Press = {
  key: (key: string) =>
    Object.assign(
      interaction(`Press ${key}`, async (page) => {
        await page.keyboard.press(key);
      }),
      {
        in: (target: Target) =>
          interaction(`Press ${key} in the ${target}`, async (page) => {
            await target.resolveFor(page).press(key);
          }),
      },
    ),
};
