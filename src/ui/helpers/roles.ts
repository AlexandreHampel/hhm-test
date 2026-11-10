import { Role } from './models';

/** Presentation metadata for each supported role, as expected on the screen. */
export interface RoleOption {
  value: Role;
  label: string;
  key: string;
}

export const ROLE_OPTIONS: readonly RoleOption[] = Object.freeze([
  { value: 'DOCTOR', label: 'Doctor', key: 'doctor' },
  { value: 'NURSE', label: 'Nurse', key: 'nurse' },
  { value: 'NURSING_TECHNICIAN', label: 'Nursing Technician', key: 'nursing-technician' },
  { value: 'PATIENT', label: 'Patient', key: 'patient' },
  { value: 'OTHER', label: 'Other', key: 'other' },
]);

export function roleOption(role: Role): RoleOption {
  const option = ROLE_OPTIONS.find((candidate) => candidate.value === role);

  if (!option) {
    throw new Error(`Unknown role: ${role}`);
  }

  return option;
}

export function roleKey(role: Role): string {
  return roleOption(role).key;
}

export function roleLabel(role: Role): string {
  return roleOption(role).label;
}
