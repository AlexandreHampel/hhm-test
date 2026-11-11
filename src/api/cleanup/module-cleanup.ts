import { Document, Filter } from 'mongodb';
import { Database, toObjectIds } from '../clients/database';

/**
 * Describes the records a module owns, so its test data can be removed without
 * any module-specific code. Modules whose records can be deleted through the
 * API do not need a descriptor: their clients delete their own data.
 */
export interface ModuleCleanup {
  /** Module name, used in cleanup reports. */
  module: string;
  /** Collection holding the records the module owns. */
  collection: string;
  /**
   * Fields of that collection referencing a `people` record, used to remove the
   * data of a person. Only fields that make the record belong to the person
   * should be listed, never fields where the person merely took part.
   */
  personFields: string[];
  /** Collections whose records belong to a record of `collection`. */
  children?: Array<{ collection: string; parentField: string }>;
}

/** Records to remove: the ones created directly, and everything belonging to the given people. */
export interface CleanupTargets {
  recordIds?: readonly string[];
  peopleIds?: readonly string[];
}

/**
 * Removes the records of one module and their children. Returns the number of
 * deleted records of the module collection.
 */
export async function removeModuleData(
  database: Database,
  cleanup: ModuleCleanup,
  targets: CleanupTargets,
): Promise<number> {
  const conditions: Filter<Document>[] = [];
  const recordIds = toObjectIds(targets.recordIds ?? []);
  const peopleIds = toObjectIds(targets.peopleIds ?? []);

  if (recordIds.length > 0) {
    conditions.push({ _id: { $in: recordIds } });
  }

  if (peopleIds.length > 0) {
    conditions.push(...cleanup.personFields.map((field) => ({ [field]: { $in: peopleIds } })));
  }

  if (conditions.length === 0) {
    return 0;
  }

  const ids = await database.findIds(cleanup.collection, { $or: conditions });

  if (ids.length === 0) {
    return 0;
  }

  for (const child of cleanup.children ?? []) {
    await database.deleteMany(child.collection, { [child.parentField]: { $in: ids } });
  }

  return database.deleteMany(cleanup.collection, { _id: { $in: ids } });
}
