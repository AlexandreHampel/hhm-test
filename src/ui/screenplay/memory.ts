import { Page } from '@playwright/test';
import { Role } from '../helpers/models';

/** A person submitted through the registration form during a scenario. */
export interface SubmittedPerson {
  cpf: string;
  roles: Role[];
}

const submittedByPage = new WeakMap<Page, Map<string, SubmittedPerson>>();

const ELEVEN_DIGITS = /^\d{11}$/;

/**
 * Remembers a person submitted from a page, so it can be removed through the
 * interface once the scenario ends. Only complete CPFs are remembered: a
 * partial value could match other people, and removal must never reach them.
 */
export function rememberSubmittedPerson(page: Page, person: SubmittedPerson): void {
  const cpf = person.cpf.replace(/\D/g, '');

  if (!ELEVEN_DIGITS.test(cpf)) {
    return;
  }

  const submitted = submittedByPage.get(page) ?? new Map<string, SubmittedPerson>();
  const known = submitted.get(cpf);
  const roles = [...new Set([...(known?.roles ?? []), ...person.roles])];

  submitted.set(cpf, { cpf, roles });
  submittedByPage.set(page, submitted);
}

/** Every person submitted from the page during the scenario. */
export function submittedPeople(page: Page): SubmittedPerson[] {
  return [...(submittedByPage.get(page)?.values() ?? [])];
}
