import { uniqueSuffix } from '../helpers/unique';
import { MovementFormData, MovementType, VisitFormData } from '../helpers/visits';
import { TEST_DATA_PREFIX } from './person';

/**
 * Standard visit entered through the New Visit form. Frozen so builders always
 * work on a copy; the patient, professional and admission are set per scenario.
 */
export const STANDARD_VISIT_FORM: Readonly<Omit<VisitFormData, 'patientName' | 'admission'>> = Object.freeze({
  type: 'OUTPATIENT',
  professionalName: '',
  chiefComplaint: 'Persistent headache',
  notes: 'Symptoms for three days',
});

/** Builds valid form data for the patient, admitted at the given browser-local date-time. */
export function buildVisitForm(patientName: string, admission: string, overrides: Partial<VisitFormData> = {}): VisitFormData {
  return {
    ...structuredClone(STANDARD_VISIT_FORM),
    patientName,
    admission,
    chiefComplaint: `${TEST_DATA_PREFIX} ${STANDARD_VISIT_FORM.chiefComplaint} ${uniqueSuffix()}`,
    ...structuredClone(overrides),
  };
}

/**
 * Builds a valid movement of the given type, filling the context-sensitive
 * fields the form requires: the destination of a transfer and the description
 * of an OTHER movement.
 */
export function buildMovementForm(type: MovementType, overrides: Partial<MovementFormData> = {}): MovementFormData {
  const movement: MovementFormData = { type };

  if (type === 'DEPARTMENT_TRANSFER') {
    movement.departmentTo = 'Cardiology';
  }

  if (type === 'OTHER') {
    movement.description = `${TEST_DATA_PREFIX} Family meeting ${uniqueSuffix()}`;
  }

  return { ...movement, ...structuredClone(overrides) };
}
