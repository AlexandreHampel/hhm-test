import { interaction } from '../screenplay/core';

/** Opens a route of the application. */
export const Navigate = {
  to: (route: string) =>
    interaction(`Navigate to ${route}`, async (page) => {
      await page.goto(route);
    }),
};
