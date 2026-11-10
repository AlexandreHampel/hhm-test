import { expect } from '@playwright/test';
import { interaction } from '../screenplay/core';
import { Target } from '../screenplay/target';

/** Synchronises with the interface by waiting for an element to appear or disappear. */
export const Wait = {
  until: (target: Target) => ({
    isVisible: () =>
      interaction(`Wait until the ${target} is visible`, async (page) => {
        await expect(target.resolveFor(page)).toBeVisible();
      }),
    isHidden: () =>
      interaction(`Wait until the ${target} is hidden`, async (page) => {
        await expect(target.resolveFor(page)).toBeHidden();
      }),
  }),
};
