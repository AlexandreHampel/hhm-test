/**
 * Data the automation enters through the registration form. The UI layer
 * keeps its own model so it never depends on the API layer.
 */

export const STANDARD_ROLES = ['DOCTOR', 'NURSE', 'NURSING_TECHNICIAN', 'PATIENT'] as const;
export const OTHER_ROLE = 'OTHER' as const;
export const SUPPORTED_ROLES = [...STANDARD_ROLES, OTHER_ROLE] as const;

export type Role = (typeof SUPPORTED_ROLES)[number];

export interface PersonFormData {
  name: string;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  roles: Role[];
  customRoles: string[];
}

/** Validated form fields, as named by the validation message test IDs. */
export type ValidatedField = 'name' | 'cpf' | 'birth-date' | 'email' | 'phone' | 'roles';
