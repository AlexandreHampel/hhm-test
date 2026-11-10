import { Locator, Page } from '@playwright/test';

/**
 * A named element of the interface. Targets only describe where an element is;
 * interactions act on them and questions read them.
 */
export class Target {
  private constructor(
    readonly description: string,
    private readonly locate: (page: Page) => Locator,
  ) {}

  /** Starts the definition of a target with a human-readable name. */
  static the(description: string) {
    return {
      /** Locates the element by its stable test ID, the preferred automation contract. */
      locatedByTestId: (testId: string): Target => new Target(description, (page) => page.getByTestId(testId)),

      /** Locates the element with a custom strategy, for elements outside the test ID contract. */
      locatedBy: (locate: (page: Page) => Locator): Target => new Target(description, locate),
    };
  }

  resolveFor(page: Page): Locator {
    return this.locate(page);
  }

  toString(): string {
    return this.description;
  }
}
