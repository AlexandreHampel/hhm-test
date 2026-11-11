import { ModuleCleanup } from './module-cleanup';

/**
 * Patient Visits (REQ-VIS-001). Visits and movements are append-only and the
 * API exposes no deletion for them (rule 15), so their test data is removed in
 * the database. `attendingProfessionalId` is not listed on purpose: a visit
 * belongs to its patient, not to the professional who attended it.
 */
export const VISITS_CLEANUP: ModuleCleanup = {
  module: 'Patient Visits',
  collection: 'visits',
  personFields: ['patientId'],
  children: [{ collection: 'visit_movements', parentField: 'visitId' }],
};

/** Every module whose test data has to be removed in the database. */
export const MODULE_CLEANUPS: ModuleCleanup[] = [VISITS_CLEANUP];
