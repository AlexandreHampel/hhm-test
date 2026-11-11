/**
 * Single source of truth for every API path used by the automation.
 * Specs and clients must never build URLs inline.
 */
export const HEALTH_ENDPOINT = '/api/health';

export const PEOPLE_ENDPOINTS = {
  root: '/api/people',
  byId: (id: string) => `/api/people/id/${encodeURIComponent(id)}`,
  byCpf: (cpf: string) => `/api/people/cpf/${encodeURIComponent(cpf)}`,
  byRole: (role: string) => `/api/people/role/${encodeURIComponent(role)}`,
} as const;

export const VISITS_ENDPOINTS = {
  root: '/api/visits',
  byId: (id: string) => `/api/visits/id/${encodeURIComponent(id)}`,
  byPatient: (patientId: string) => `/api/visits/patient/${encodeURIComponent(patientId)}`,
  movements: (visitId: string) => `/api/visits/id/${encodeURIComponent(visitId)}/movements`,
  /** Not part of the contract: used only to prove single movements cannot be edited or deleted. */
  movementById: (visitId: string, movementId: string) => `/api/visits/id/${encodeURIComponent(visitId)}/movements/${encodeURIComponent(movementId)}`,
} as const;
