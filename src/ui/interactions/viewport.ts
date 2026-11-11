import { interaction } from '../screenplay/core';

/** Resizes the browser viewport, to check the layout on smaller screens. */
export const ResizeTheWindow = {
  to: (width: number, height: number) =>
    interaction(`Resize the window to ${width}x${height}`, async (page) => {
      await page.setViewportSize({ width, height });
    }),
};
