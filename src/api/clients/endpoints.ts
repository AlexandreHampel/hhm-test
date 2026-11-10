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