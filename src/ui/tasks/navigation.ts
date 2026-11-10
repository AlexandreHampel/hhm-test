import { Click } from '../interactions/click';
import { Navigate } from '../interactions/navigate';
import { Wait } from '../interactions/wait';
import { task } from '../screenplay/core';
import { Dashboard, Landing } from '../targets/dashboard';
import { PeopleList } from '../targets/people';
import { UI_ROUTES } from '../targets/routes';

export const OpenTheLandingPage = () =>
  task('Open the landing page', Navigate.to(UI_ROUTES.landing), Wait.until(Landing.MAIN_HEADING).isVisible());

export const OpenTheDashboard = () =>
  task('Open the module dashboard', Navigate.to(UI_ROUTES.dashboard), Wait.until(Dashboard.PAGE).isVisible());

export const OpenGeneralRegistration = () =>
  task('Open General Registration', Navigate.to(UI_ROUTES.people), Wait.until(PeopleList.PAGE).isVisible());

export const OpenTheModule = {
  withId: (moduleId: string) => task(`Open the ${moduleId} module from the dashboard`, Click.on(Dashboard.openButton(moduleId))),
};

export const ReturnToTheDashboard = () =>
  task('Return to the module dashboard', Click.on(PeopleList.BACK_LINK), Wait.until(Dashboard.PAGE).isVisible());
