import { Target } from '../screenplay/target';

/** Application module dashboard. */
export const Dashboard = {
  PAGE: Target.the('Module dashboard').locatedByTestId('app-page'),
  TITLE: Target.the('Dashboard title').locatedByTestId('app-title'),
  MODULES_LIST: Target.the('Module list').locatedByTestId('app-modules-list'),
  MODULE_CARDS: Target.the('Module cards').locatedBy((page) => page.getByTestId('app-modules-list').locator(':scope > [data-testid]')),
  card: (moduleId: string) => Target.the(`${moduleId} module card`).locatedByTestId(`app-module-${moduleId}`),
  name: (moduleId: string) => Target.the(`${moduleId} module name`).locatedByTestId(`app-module-name-${moduleId}`),
  description: (moduleId: string) => Target.the(`${moduleId} module description`).locatedByTestId(`app-module-description-${moduleId}`),
  openButton: (moduleId: string) => Target.the(`${moduleId} open action`).locatedByTestId(`app-module-open-${moduleId}`),
};

/**
 * Landing page. It predates the test ID contract, so its heading is located
 * by accessible role instead.
 */
export const Landing = {
  MAIN_HEADING: Target.the('Landing page main heading').locatedBy((page) => page.getByRole('heading', { level: 1 })),
};

/** Application shell, used to check whether any page is rendered at all. */
export const AppShell = {
  RENDERED_PAGES: Target.the('Rendered pages').locatedBy((page) => page.locator('app-root > :not(router-outlet)')),
};
