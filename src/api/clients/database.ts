import { Db, MongoClient, ObjectId } from 'mongodb';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/** A collection whose records reference the parent records through `foreignKey`. */
export interface DependentCollection {
  name: string;
  foreignKey: string;
  dependents?: readonly DependentCollection[];
}

/**
 * A collection holding test data that cannot be deleted through the API.
 * `ownerFields` reference the `people` record the data belongs to, and
 * `dependents` are deleted before their parents so no reference is left dangling.
 */
export interface CleanableCollection {
  name: string;
  ownerFields: readonly string[];
  dependents?: readonly DependentCollection[];
}

/** Records to purge: by their own identifier and/or by the person owning them. */
export interface PurgeCriteria {
  ids?: readonly string[];
  ownerIds?: readonly string[];
}

/**
 * Generic database access used only to remove test data that the API cannot
 * delete. It knows nothing about HHM modules: what to remove is described by
 * the collection definitions in `collections.ts`.
 */
export class DatabaseClient {
  private constructor(private readonly client: MongoClient, private readonly db: Db) {}

  static async connect(uri: string): Promise<DatabaseClient> {
    try {
      const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 10_000 });

      return new DatabaseClient(client, client.db());
    } catch (error) {
      const masked = uri.replace(/\/\/[^@/]+@/, '//***:***@');

      throw new Error(
        `Could not connect to the test data cleanup database ${masked}: ${(error as Error).message.replace(/\.$/, '')}. ` +
        'Check that MongoDB is reachable from this machine with the configured host, port, database, user and password.',
      );
    }
  }

  /**
   * Deletes the records of the collection matching the criteria, after deleting
   * their dependents recursively. Returns the number of deleted records of the
   * collection itself.
   */
  async purge(collection: CleanableCollection, { ids = [], ownerIds = [] }: PurgeCriteria): Promise<number> {
    const filter = {
      $or: [
        { _id: { $in: toObjectIds(ids) } },
        ...collection.ownerFields.map((field) => ({ [field]: { $in: toObjectIds(ownerIds) } })),
      ],
    };

    return this.deleteWithDependents(collection.name, collection.dependents ?? [], await this.findIds(collection.name, filter));
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private async deleteWithDependents(name: string, dependents: readonly DependentCollection[], ids: ObjectId[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    for (const dependent of dependents) {
      const dependentIds = await this.findIds(dependent.name, { [dependent.foreignKey]: { $in: ids } });
      await this.deleteWithDependents(dependent.name, dependent.dependents ?? [], dependentIds);
    }

    const { deletedCount } = await this.db.collection(name).deleteMany({ _id: { $in: ids } });

    return deletedCount;
  }

  private async findIds(name: string, filter: object): Promise<ObjectId[]> {
    const records = await this.db.collection(name).find(filter, { projection: { _id: 1 } }).toArray();

    return records.map((record) => record._id as ObjectId);
  }
}

function toObjectIds(ids: readonly string[]): ObjectId[] {
  return ids.filter((id) => OBJECT_ID_PATTERN.test(id)).map((id) => new ObjectId(id));
}
