import { Click } from '../interactions/click';
import { Navigate } from '../interactions/navigate';
import { Wait } from '../interactions/wait';
import { task } from '../screenplay/core';
import { Dashboard, Landing } from '../targets/dashboard';
import { PeopleList } from '../targets/people';
import { UI_ROUTES } from '../targets/routes';

export const OpenTheLandingPage = () =>
  task('Open the landing page', Navigate.to(UI_ROUTES.landing), Wait.until(Landing.MAIN_HEADING).isVisible());

/**
 * Application pages can only be reached from inside the application: opening
 * their URL directly redirects to the landing page. Every page is therefore
 * opened the way a user reaches it, starting from Access System.
 */
export const OpenTheDashboard = () =>
  task('Open the module dashboard', OpenTheLandingPage(), Click.on(Landing.ACCESS_SYSTEM_BUTTON), Wait.until(Dashboard.PAGE).isVisible());

/** Opens a module by clicking its dashboard card, which is the card's open action. */
export const OpenTheModule = {
  withId: (moduleId: string) => task(`Open the ${moduleId} module from the dashboard`, Click.on(Dashboard.card(moduleId))),
};

export const OpenGeneralRegistration = () =>
  task('Open General Registration', OpenTheDashboard(), OpenTheModule.withId('general-registration'), Wait.until(PeopleList.PAGE).isVisible());

export const ReturnToTheDashboard = () =>
  task('Return to the module dashboard', Click.on(PeopleList.BACK_LINK), Wait.until(Dashboard.PAGE).isVisible());
