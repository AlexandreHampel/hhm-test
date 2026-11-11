/**
 * Single source of truth for every frontend route used by the automation.
 * Specs and tasks must never build routes inline.
 */
export const UI_ROUTES = {
  landing: '/',
  dashboard: '/app',
  people: '/people',
  visits: '/visits',
  newVisit: '/visits/new',
  visitDetails: (visitId: string) => `/visits/id/${visitId}`,
} as const;

/** Prototype route kept here only to assert that it is no longer served. */
export const PROTOTYPE_PATIENTS_ROUTE = '/patients';
