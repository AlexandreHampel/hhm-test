/** Person contract as defined by the person data model. */

export const STANDARD_ROLES = ['DOCTOR', 'NURSE', 'NURSING_TECHNICIAN', 'PATIENT'] as const;
export const OTHER_ROLE = 'OTHER' as const;
export const SUPPORTED_ROLES = [...STANDARD_ROLES, OTHER_ROLE] as const;

export type StandardRole = (typeof STANDARD_ROLES)[number];
export type Role = (typeof SUPPORTED_ROLES)[number];

/** Request body accepted by the create and update endpoints. */
export interface PersonPayload {
  name: string;
  cpf: string;
  birthDate: string;
  email?: string;
  phone?: string;
  roles: Role[];
  custom_roles?: string[];
}

/** Resource returned by the People API. */
export interface Person extends PersonPayload {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

/** Error body convention used by HHM controllers. */
export interface ApiError {
  message: string;
}
