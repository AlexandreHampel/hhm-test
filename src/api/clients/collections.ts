import { CleanableCollection } from './database';

/**
 * Single source of truth for the collections whose test data is removed
 * directly in the database, because the API exposes no deletion for them.
 * The global teardown sweeps every collection listed here, so a new module
 * only needs to declare its collections.
 */
export const COLLECTIONS = {
  /** REQ-VIS-001 section 3: visits belong to a patient; movements belong to a visit (rule 15: no deletion API). */
  visits: {
    name: 'visits',
    ownerFields: ['patientId'],
    dependents: [{ name: 'visit_movements', foreignKey: 'visitId' }],
  },
} as const satisfies Record<string, CleanableCollection>;
