/**
 * Expected HTTP status codes for the People API.
 *
 * The guide document asks for appropriate status codes without fixing exact
 * values. Where the behaviour is explicit, or where HHM controllers already
 * follow a convention, a single code is expected. Where more than one code is
 * reasonable, the accepted set is declared here so the contract can be
 * tightened in one place once the product owner decides.
 */
export const HTTP_STATUS = {
  OK: [200],
  CREATED: [201],
  DELETED: [200, 204],
  NOT_FOUND: [404],
  VALIDATION_ERROR: [400, 422],
  DUPLICATE_CPF: [400, 409],
  MALFORMED_ID: [400, 404],
  UNSUPPORTED_ROLE_FILTER: [400, 404],
  MALFORMED_JSON: [400],
} as const satisfies Record<string, readonly number[]>;
