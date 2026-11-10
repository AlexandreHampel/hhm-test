import { PersonFormData, SUPPORTED_ROLES } from './models';
import { roleLabel } from './roles';

/**
 * Independent formatters describing how values are expected to be displayed.
 * They act as the test oracle, so they must not reuse application code.
 */

/** Placeholder rendered by the table for optional values that are empty. */
export const EMPTY_CELL = '—';

/** Formats eleven CPF digits with the Brazilian mask. */
export function formatCpf(cpf: string): string {
  return cpf.replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/** Formats an ISO calendar date as day, month and year separated by slashes. */
export function formatBirthDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');

  return `${day}/${month}/${year}`;
}

/** Formats a Brazilian mobile number with area code, the only phone shape used by the payloads. */
export function formatMobilePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

/** What a table row shows for a person. */
export interface DisplayedRow {
  name: string;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  roles: string[];
  customRoles: string[];
}

/** The row the table is expected to show for the given form data. */
export function expectedRowFor(data: PersonFormData): DisplayedRow {
  const holdsOther = data.roles.includes('OTHER');

  return {
    name: data.name.trim(),
    cpf: formatCpf(data.cpf),
    birthDate: formatBirthDate(data.birthDate),
    email: data.email ? data.email.trim().toLowerCase() : EMPTY_CELL,
    phone: data.phone ? formatMobilePhone(data.phone) : EMPTY_CELL,
    roles: SUPPORTED_ROLES.filter((role) => data.roles.includes(role)).map(roleLabel),
    customRoles: holdsOther ? data.customRoles.map((customRole) => customRole.trim()) : [],
  };
}

/** Adds whole days to an ISO calendar date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
