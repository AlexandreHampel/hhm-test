import { generateCpf } from '../helpers/cpf';
import { PersonFormData } from '../helpers/models';
import { uniqueSuffix } from '../helpers/unique';

/** Prefix that identifies records created by the UI automation. */
export const TEST_DATA_PREFIX = 'QA-UI';

/**
 * Standard person entered through the registration form.
 *
 * It is frozen on purpose: builders always work on a copy, so a scenario can
 * never change the defaults used by the other scenarios.
 */
export const STANDARD_PERSON_FORM: Readonly<PersonFormData> = Object.freeze({
  name: 'Standard Person',
  cpf: 'replaced-by-builder',
  birthDate: '1990-05-15',
  email: 'standard.person@example.com',
  phone: '47999990000',
  roles: ['PATIENT'] as PersonFormData['roles'],
  customRoles: [],
});

/** Returns an editable deep copy of the standard form with a unique identity. */
function copyStandardPersonForm(): PersonFormData {
  const copy = structuredClone(STANDARD_PERSON_FORM) as PersonFormData;
  const suffix = uniqueSuffix();

  copy.name = `${TEST_DATA_PREFIX} ${copy.name} ${suffix}`;
  copy.cpf = generateCpf();
  copy.email = `qa.ui.${suffix}@example.com`;

  return copy;
}

/** Builds valid form data, applying the given changes to a copy of the standard form. */
export function buildPersonForm(overrides: Partial<PersonFormData> = {}): PersonFormData {
  return { ...copyStandardPersonForm(), ...structuredClone(overrides) };
}

/** Builds form data holding the OTHER role and the given custom roles. */
export function buildPersonFormWithCustomRoles(customRoles: readonly string[]): PersonFormData {
  return buildPersonForm({ roles: ['OTHER'], customRoles: [...customRoles] });
}

/** Builds form data containing only the fields the form marks as required. */
export function buildRequiredOnlyPersonForm(overrides: Partial<PersonFormData> = {}): PersonFormData {
  return buildPersonForm({ email: '', phone: '', ...structuredClone(overrides) });
}
