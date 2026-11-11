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

/** Formats a browser-local `YYYY-MM-DDTHH:mm` date-time as the visit pages display it: day/month/year hours:minutes. */
export function formatDateTime(localDateTime: string): string {
  const [date, time] = localDateTime.split('T');

  return `${formatBirthDate(date)} ${time.slice(0, 5)}`;
}

/** Shifts a browser-local `YYYY-MM-DDTHH:mm` date-time by whole minutes, without any timezone conversion. */
export function shiftDateTime(localDateTime: string, minutes: number): string {
  const date = new Date(`${localDateTime.slice(0, 16)}:00.000Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);

  return date.toISOString().slice(0, 16);
}

/** Reads a displayed `dd/MM/yyyy HH:mm` date-time back into the sortable `YYYY-MM-DDTHH:mm` shape, or null when it is not one. */
export function parseDisplayedDateTime(displayed: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(displayed.trim());

  return match ? `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}` : null;
}
